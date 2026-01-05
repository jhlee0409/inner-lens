/**
 * Navigation Capture Utility
 * Tracks page navigations, route changes, and browser history events
 */

import { maskSensitiveData } from './masking';

/**
 * Types of navigation events
 */
export type NavigationType =
  | 'pageload'
  | 'pushstate'
  | 'replacestate'
  | 'popstate'
  | 'hashchange'
  | 'beforeunload';

/**
 * Navigation entry
 */
export interface NavigationEntry {
  type: NavigationType;
  timestamp: number;
  from: string;
  to: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Navigation capture configuration
 */
export interface NavigationCaptureConfig {
  /**
   * Maximum number of navigation entries to keep
   * @default 20
   */
  maxEntries?: number;

  /**
   * Enable/disable URL masking (removes query params with sensitive data)
   * @default true
   */
  maskSensitiveData?: boolean;

  /**
   * Query parameters to always mask
   * @default ['token', 'key', 'secret', 'password', 'auth', 'session']
   */
  sensitiveParams?: string[];

  /**
   * Track hash changes
   * @default true
   */
  trackHashChanges?: boolean;

  /**
   * Callback on navigation
   */
  onNavigation?: (entry: NavigationEntry) => void;
}

// Module state
let isInitialized = false;
let capturedNavigations: NavigationEntry[] = [];
let config: Required<NavigationCaptureConfig>;
let currentUrl: string = '';
let pageLoadTime: number = 0;

// Store original methods for restoration
let originalPushState: typeof history.pushState | null = null;
let originalReplaceState: typeof history.replaceState | null = null;

const DEFAULT_CONFIG: Required<NavigationCaptureConfig> = {
  maxEntries: 20,
  maskSensitiveData: true,
  sensitiveParams: ['token', 'key', 'secret', 'password', 'auth', 'session', 'api_key', 'apikey', 'access_token'],
  trackHashChanges: true,
  onNavigation: () => {},
};

/**
 * Masks sensitive data in URL
 */
function maskUrl(url: string): string {
  if (!config.maskSensitiveData) return url;

  try {
    const urlObj = new URL(url, window.location.origin);

    // Mask sensitive query parameters by name
    for (const param of config.sensitiveParams) {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
      }
    }

    // Also check for sensitive values in query params (e.g., JWT tokens, API keys)
    for (const [key, value] of urlObj.searchParams.entries()) {
      // Only mask if value looks like a secret (skip already redacted)
      if (value !== '[REDACTED]') {
        const maskedValue = maskSensitiveData(value);
        if (maskedValue !== value) {
          // Use the properly masked value to preserve pattern-specific redaction
          urlObj.searchParams.set(key, maskedValue);
        }
      }
    }

    return urlObj.toString();
  } catch {
    // If URL parsing fails, apply general masking
    return maskSensitiveData(url);
  }
}

/**
 * Adds a navigation entry
 */
function addNavigation(entry: NavigationEntry): void {
  capturedNavigations.push(entry);

  if (capturedNavigations.length > config.maxEntries) {
    capturedNavigations = capturedNavigations.slice(-config.maxEntries);
  }

  config.onNavigation(entry);
}

/**
 * Handles pushState/replaceState
 */
function createHistoryHandler(
  type: 'pushstate' | 'replacestate',
  original: typeof history.pushState
): typeof history.pushState {
  return function (
    this: History,
    data: unknown,
    unused: string,
    url?: string | URL | null
  ): void {
    const from = maskUrl(currentUrl);

    // Call original method
    original.call(this, data, unused, url);

    const to = maskUrl(window.location.href);
    currentUrl = window.location.href;

    if (from !== to) {
      addNavigation({
        type,
        timestamp: Date.now(),
        from,
        to,
        metadata: {
          stateData: typeof data === 'object' ? '[state object]' : data,
        },
      });
    }
  };
}

/**
 * Handles popstate events (back/forward navigation)
 */
function handlePopState(_event: PopStateEvent): void {
  const from = maskUrl(currentUrl);
  const to = maskUrl(window.location.href);
  currentUrl = window.location.href;

  if (from !== to) {
    addNavigation({
      type: 'popstate',
      timestamp: Date.now(),
      from,
      to,
      metadata: {
        historyLength: history.length,
      },
    });
  }
}

/**
 * Handles hash changes
 */
function handleHashChange(event: HashChangeEvent): void {
  addNavigation({
    type: 'hashchange',
    timestamp: Date.now(),
    from: maskUrl(event.oldURL),
    to: maskUrl(event.newURL),
  });
}

/**
 * Handles page unload
 */
function handleBeforeUnload(): void {
  addNavigation({
    type: 'beforeunload',
    timestamp: Date.now(),
    from: maskUrl(currentUrl),
    to: '[leaving page]',
    duration: Date.now() - pageLoadTime,
    metadata: {
      timeOnPage: Date.now() - pageLoadTime,
    },
  });
}

/**
 * Initialize navigation capture
 */
export function initNavigationCapture(
  userConfig: NavigationCaptureConfig = {}
): void {
  if (typeof window === 'undefined') return;

  if (isInitialized) {
    config = { ...config, ...userConfig };
    return;
  }

  config = { ...DEFAULT_CONFIG, ...userConfig };
  currentUrl = window.location.href;
  pageLoadTime = Date.now();

  // Record initial page load
  addNavigation({
    type: 'pageload',
    timestamp: pageLoadTime,
    from: document.referrer ? maskUrl(document.referrer) : '[direct]',
    to: maskUrl(currentUrl),
    metadata: {
      referrer: document.referrer ? maskUrl(document.referrer) : null,
      documentReadyState: document.readyState,
    },
  });

  // Intercept pushState
  originalPushState = history.pushState.bind(history);
  history.pushState = createHistoryHandler('pushstate', originalPushState);

  // Intercept replaceState
  originalReplaceState = history.replaceState.bind(history);
  history.replaceState = createHistoryHandler('replacestate', originalReplaceState);

  // Listen for popstate (back/forward)
  window.addEventListener('popstate', handlePopState);

  // Listen for hash changes
  if (config.trackHashChanges) {
    window.addEventListener('hashchange', handleHashChange);
  }

  // Listen for page unload
  window.addEventListener('beforeunload', handleBeforeUnload);

  isInitialized = true;
}

/**
 * Get all captured navigations
 */
export function getCapturedNavigations(): NavigationEntry[] {
  return [...capturedNavigations];
}

/**
 * Get navigation summary for AI analysis
 */
export function getNavigationSummary(): {
  total: number;
  pageLoadTime: number;
  currentTimeOnPage: number;
  navigationPath: string[];
  byType: Record<string, number>;
  timeline: string;
} {
  const byType: Record<string, number> = {};

  for (const nav of capturedNavigations) {
    byType[nav.type] = (byType[nav.type] ?? 0) + 1;
  }

  // Build navigation path (simplified)
  const navigationPath = capturedNavigations.map((nav) => {
    try {
      const url = new URL(nav.to, window.location.origin);
      return url.pathname + url.hash;
    } catch {
      return nav.to;
    }
  });

  // Create timeline
  const timeline = capturedNavigations
    .map((nav) => {
      const time = new Date(nav.timestamp).toISOString().slice(11, 19);
      return `[${time}] ${nav.type}: ${nav.from} → ${nav.to}`;
    })
    .join('\n');

  return {
    total: capturedNavigations.length,
    pageLoadTime,
    currentTimeOnPage: Date.now() - pageLoadTime,
    navigationPath,
    byType,
    timeline,
  };
}

/**
 * Clear all captured navigations
 */
export function clearCapturedNavigations(): void {
  capturedNavigations = [];
}

/**
 * Stop capturing and restore original methods
 */
export function stopNavigationCapture(): void {
  if (!isInitialized) return;

  // Restore original history methods
  if (originalPushState) {
    history.pushState = originalPushState;
    originalPushState = null;
  }

  if (originalReplaceState) {
    history.replaceState = originalReplaceState;
    originalReplaceState = null;
  }

  // Remove event listeners
  window.removeEventListener('popstate', handlePopState);
  window.removeEventListener('hashchange', handleHashChange);
  window.removeEventListener('beforeunload', handleBeforeUnload);

  isInitialized = false;
}

/**
 * Get current page info
 */
export function getCurrentPageInfo(): {
  url: string;
  path: string;
  hash: string;
  search: string;
  timeOnPage: number;
  referrer: string | null;
} {
  return {
    url: maskUrl(window.location.href),
    path: window.location.pathname,
    hash: window.location.hash,
    search: maskUrl(window.location.search),
    timeOnPage: Date.now() - pageLoadTime,
    referrer: document.referrer ? maskUrl(document.referrer) : null,
  };
}
