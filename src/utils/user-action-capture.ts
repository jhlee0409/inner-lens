/**
 * User Action Capture Utility
 * Lightweight tracking of user interactions for AI analysis
 * More efficient than full session replay for bug analysis context
 */

import { maskSensitiveData } from './masking';

/**
 * Types of user actions that can be captured
 */
export type UserActionType =
  | 'click'
  | 'dblclick'
  | 'input'
  | 'change'
  | 'focus'
  | 'blur'
  | 'scroll'
  | 'keydown'
  | 'submit'
  | 'copy'
  | 'paste'
  | 'select';

/**
 * Captured user action entry
 */
export interface UserAction {
  type: UserActionType;
  target: string;
  timestamp: number;
  value?: string;
  position?: { x: number; y: number };
  key?: string;
  metadata?: Record<string, unknown>;
}

/**
 * User action capture configuration
 */
export interface UserActionCaptureConfig {
  /**
   * Maximum number of actions to keep in buffer
   * @default 50
   */
  maxActions?: number;

  /**
   * Enable/disable sensitive data masking
   * @default true
   */
  maskSensitiveData?: boolean;

  /**
   * Actions to capture
   * @default ['click', 'dblclick', 'input', 'change', 'submit', 'scroll']
   */
  captureActions?: UserActionType[];

  /**
   * Scroll throttle interval in ms
   * @default 250
   */
  scrollThrottleMs?: number;

  /**
   * Input debounce interval in ms
   * @default 300
   */
  inputDebounceMs?: number;

  /**
   * CSS selectors for elements to ignore
   * @default []
   */
  ignoreSelectors?: string[];
}

// Module state
let isInitialized = false;
let capturedActions: UserAction[] = [];
let config: Required<UserActionCaptureConfig>;
let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
let inputTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
let lastScrollTime = 0;

// Event listeners for cleanup
const eventListeners: Array<{
  target: EventTarget;
  type: string;
  handler: EventListener;
  options?: AddEventListenerOptions;
}> = [];

const DEFAULT_CONFIG: Required<UserActionCaptureConfig> = {
  maxActions: 50,
  maskSensitiveData: true,
  captureActions: ['click', 'dblclick', 'input', 'change', 'submit', 'scroll'],
  scrollThrottleMs: 250,
  inputDebounceMs: 300,
  ignoreSelectors: [],
};

/**
 * Generates a CSS selector path for an element
 */
function getElementSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    // Add id if present
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break; // ID is unique, no need to go further
    }

    // Add meaningful class names (filter out utility classes)
    const meaningfulClasses = Array.from(current.classList)
      .filter((cls) => !cls.match(/^(p-|m-|w-|h-|flex|grid|text-|bg-|border-)/))
      .slice(0, 2);

    if (meaningfulClasses.length > 0) {
      selector += `.${meaningfulClasses.join('.')}`;
    }

    // Add data attributes for better identification
    const dataTestId =
      current.getAttribute('data-testid') ||
      current.getAttribute('data-test-id');
    if (dataTestId) {
      selector += `[data-testid="${dataTestId}"]`;
    }

    // Add name attribute for form elements
    const name = current.getAttribute('name');
    if (name && ['input', 'select', 'textarea'].includes(current.tagName.toLowerCase())) {
      selector += `[name="${name}"]`;
    }

    // Add aria-label for accessibility-labeled elements
    const ariaLabel = current.getAttribute('aria-label');
    if (ariaLabel) {
      selector += `[aria-label="${ariaLabel.slice(0, 30)}"]`;
    }

    parts.unshift(selector);
    current = current.parentElement;

    // Limit depth
    if (parts.length >= 4) break;
  }

  return parts.join(' > ') || element.tagName.toLowerCase();
}

/**
 * Checks if element matches any ignore selector
 */
function shouldIgnoreElement(element: Element): boolean {
  return config.ignoreSelectors.some((selector) => {
    try {
      return element.matches(selector) || element.closest(selector) !== null;
    } catch {
      return false;
    }
  });
}

/**
 * Masks input value if needed
 */
function maskValue(value: string, element: Element): string {
  if (!config.maskSensitiveData) return value;

  // Always mask password fields
  if (
    element instanceof HTMLInputElement &&
    (element.type === 'password' || element.type === 'hidden')
  ) {
    return '[HIDDEN]';
  }

  // Check for sensitive field names
  const name = element.getAttribute('name')?.toLowerCase() ?? '';
  const id = element.id?.toLowerCase() ?? '';
  const sensitivePatterns = [
    'password',
    'secret',
    'token',
    'api',
    'key',
    'credit',
    'card',
    'cvv',
    'ssn',
    'social',
  ];

  if (sensitivePatterns.some((p) => name.includes(p) || id.includes(p))) {
    return '[SENSITIVE]';
  }

  // Apply general masking
  return maskSensitiveData(value);
}

/**
 * Adds an action to the buffer
 */
function addAction(action: UserAction): void {
  capturedActions.push(action);

  if (capturedActions.length > config.maxActions) {
    capturedActions = capturedActions.slice(-config.maxActions);
  }
}

/**
 * Registers an event listener with cleanup tracking
 */
function addEventListener<K extends keyof DocumentEventMap>(
  target: EventTarget,
  type: K,
  handler: (event: DocumentEventMap[K]) => void,
  options?: AddEventListenerOptions
): void {
  target.addEventListener(type, handler as EventListener, options);
  eventListeners.push({
    target,
    type,
    handler: handler as EventListener,
    options,
  });
}

/**
 * Click/Double-click handler
 */
function handleClick(event: MouseEvent): void {
  const target = event.target as Element;
  if (!target || shouldIgnoreElement(target)) return;

  const action: UserAction = {
    type: event.type === 'dblclick' ? 'dblclick' : 'click',
    target: getElementSelector(target),
    timestamp: Date.now(),
    position: { x: event.clientX, y: event.clientY },
  };

  // Add button text or aria-label for context
  const textContent = (target as HTMLElement).innerText?.slice(0, 50)?.trim();
  const ariaLabel = target.getAttribute('aria-label');
  if (textContent || ariaLabel) {
    action.metadata = { label: textContent || ariaLabel };
  }

  addAction(action);
}

/**
 * Input handler with debounce
 */
function handleInput(event: Event): void {
  const target = event.target as Element;
  if (!target || shouldIgnoreElement(target)) return;

  const selector = getElementSelector(target);

  // Clear existing timeout for this element
  const existingTimeout = inputTimeouts.get(selector);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Debounce input events
  const timeout = setTimeout(() => {
    const value =
      (target as HTMLInputElement | HTMLTextAreaElement).value ?? '';
    const maskedValue = maskValue(value, target);

    addAction({
      type: 'input',
      target: selector,
      timestamp: Date.now(),
      value: maskedValue.slice(0, 100), // Limit value length
    });

    inputTimeouts.delete(selector);
  }, config.inputDebounceMs);

  inputTimeouts.set(selector, timeout);
}

/**
 * Change handler (for select, checkbox, radio)
 */
function handleChange(event: Event): void {
  const target = event.target as Element;
  if (!target || shouldIgnoreElement(target)) return;

  let value: string = '';

  if (target instanceof HTMLSelectElement) {
    value = target.options[target.selectedIndex]?.text ?? '';
  } else if (target instanceof HTMLInputElement) {
    if (target.type === 'checkbox' || target.type === 'radio') {
      value = target.checked ? 'checked' : 'unchecked';
    } else {
      value = maskValue(target.value, target);
    }
  }

  addAction({
    type: 'change',
    target: getElementSelector(target),
    timestamp: Date.now(),
    value: value.slice(0, 100),
  });
}

/**
 * Scroll handler with throttle
 */
function handleScroll(): void {
  const now = Date.now();

  if (now - lastScrollTime < config.scrollThrottleMs) {
    // Throttle: schedule update at end of scroll
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      addScrollAction();
    }, config.scrollThrottleMs);
    return;
  }

  addScrollAction();
  lastScrollTime = now;
}

function addScrollAction(): void {
  addAction({
    type: 'scroll',
    target: 'window',
    timestamp: Date.now(),
    position: {
      x: window.scrollX,
      y: window.scrollY,
    },
    metadata: {
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      scrollPercent: Math.round(
        (window.scrollY /
          (document.documentElement.scrollHeight - window.innerHeight)) *
          100
      ),
    },
  });
}

/**
 * Submit handler
 */
function handleSubmit(event: Event): void {
  const target = event.target as Element;
  if (!target || shouldIgnoreElement(target)) return;

  addAction({
    type: 'submit',
    target: getElementSelector(target),
    timestamp: Date.now(),
    metadata: {
      formAction: (target as HTMLFormElement).action,
      formMethod: (target as HTMLFormElement).method,
    },
  });
}

/**
 * Focus handler
 */
function handleFocus(event: FocusEvent): void {
  const target = event.target as Element;
  if (!target || shouldIgnoreElement(target)) return;

  // Only track focus on interactive elements
  const interactiveElements = ['input', 'textarea', 'select', 'button', 'a'];
  if (!interactiveElements.includes(target.tagName.toLowerCase())) return;

  addAction({
    type: 'focus',
    target: getElementSelector(target),
    timestamp: Date.now(),
  });
}

/**
 * Keydown handler (for special keys only)
 */
function handleKeydown(event: KeyboardEvent): void {
  const target = event.target as Element;
  if (!target || shouldIgnoreElement(target)) return;

  // Only capture special keys, not regular typing
  const specialKeys = ['Enter', 'Escape', 'Tab', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (!specialKeys.includes(event.key)) return;

  addAction({
    type: 'keydown',
    target: getElementSelector(target),
    timestamp: Date.now(),
    key: event.key,
    metadata: {
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    },
  });
}

/**
 * Copy/Paste handler
 */
function handleClipboard(event: ClipboardEvent): void {
  const target = event.target as Element;
  if (!target || shouldIgnoreElement(target)) return;

  addAction({
    type: event.type as 'copy' | 'paste',
    target: getElementSelector(target),
    timestamp: Date.now(),
    // Don't capture clipboard content for privacy
  });
}

/**
 * Initialize user action capture
 */
export function initUserActionCapture(
  userConfig: UserActionCaptureConfig = {}
): void {
  if (typeof window === 'undefined') return;

  if (isInitialized) {
    // Update config if already initialized
    config = { ...config, ...userConfig };
    return;
  }

  config = { ...DEFAULT_CONFIG, ...userConfig };

  const actions = config.captureActions;

  // Register event listeners based on config
  if (actions.includes('click')) {
    addEventListener(document, 'click', handleClick, { capture: true });
  }

  if (actions.includes('dblclick')) {
    addEventListener(document, 'dblclick', handleClick, { capture: true });
  }

  if (actions.includes('input')) {
    addEventListener(document, 'input', handleInput, { capture: true });
  }

  if (actions.includes('change')) {
    addEventListener(document, 'change', handleChange, { capture: true });
  }

  if (actions.includes('scroll')) {
    addEventListener(window, 'scroll', handleScroll, { passive: true });
  }

  if (actions.includes('submit')) {
    addEventListener(document, 'submit', handleSubmit, { capture: true });
  }

  if (actions.includes('focus')) {
    addEventListener(document, 'focusin', handleFocus, { capture: true });
  }

  if (actions.includes('keydown')) {
    addEventListener(document, 'keydown', handleKeydown, { capture: true });
  }

  if (actions.includes('copy')) {
    addEventListener(document, 'copy', handleClipboard, { capture: true });
  }

  if (actions.includes('paste')) {
    addEventListener(document, 'paste', handleClipboard, { capture: true });
  }

  isInitialized = true;
}

/**
 * Get all captured user actions
 */
export function getCapturedUserActions(): UserAction[] {
  return [...capturedActions];
}

/**
 * Get a summary of recent actions (for AI analysis)
 */
export function getUserActionsSummary(): {
  total: number;
  byType: Record<string, number>;
  recentActions: UserAction[];
  timeline: string;
} {
  const byType: Record<string, number> = {};

  for (const action of capturedActions) {
    byType[action.type] = (byType[action.type] ?? 0) + 1;
  }

  // Create a human-readable timeline
  const timeline = capturedActions
    .slice(-10)
    .map((a) => {
      const time = new Date(a.timestamp).toISOString().slice(11, 19);
      let desc = `[${time}] ${a.type}: ${a.target}`;
      if (a.value) desc += ` = "${a.value}"`;
      if (a.key) desc += ` (${a.key})`;
      return desc;
    })
    .join('\n');

  return {
    total: capturedActions.length,
    byType,
    recentActions: capturedActions.slice(-10),
    timeline,
  };
}

/**
 * Clear all captured actions
 */
export function clearCapturedUserActions(): void {
  capturedActions = [];
}

/**
 * Stop capturing and cleanup
 */
export function stopUserActionCapture(): void {
  if (!isInitialized) return;

  // Remove all event listeners
  for (const { target, type, handler, options } of eventListeners) {
    target.removeEventListener(type, handler, options);
  }
  eventListeners.length = 0;

  // Clear timeouts
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
    scrollTimeout = null;
  }

  for (const timeout of inputTimeouts.values()) {
    clearTimeout(timeout);
  }
  inputTimeouts.clear();

  isInitialized = false;
}

/**
 * Manually add a custom user action
 */
export function addCustomUserAction(
  type: UserActionType,
  target: string,
  metadata?: Record<string, unknown>
): void {
  addAction({
    type,
    target,
    timestamp: Date.now(),
    metadata,
  });
}
