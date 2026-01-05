/**
 * Performance Capture Utility
 * Captures Core Web Vitals and other performance metrics
 */

/**
 * Core Web Vitals metrics
 */
export interface CoreWebVitals {
  /**
   * Largest Contentful Paint (ms)
   * Good: < 2500ms, Needs Improvement: 2500-4000ms, Poor: > 4000ms
   */
  LCP?: number;

  /**
   * First Input Delay (ms)
   * Good: < 100ms, Needs Improvement: 100-300ms, Poor: > 300ms
   */
  FID?: number;

  /**
   * Cumulative Layout Shift
   * Good: < 0.1, Needs Improvement: 0.1-0.25, Poor: > 0.25
   */
  CLS?: number;

  /**
   * Interaction to Next Paint (ms)
   * Good: < 200ms, Needs Improvement: 200-500ms, Poor: > 500ms
   */
  INP?: number;

  /**
   * Time to First Byte (ms)
   * Good: < 800ms, Needs Improvement: 800-1800ms, Poor: > 1800ms
   */
  TTFB?: number;

  /**
   * First Contentful Paint (ms)
   * Good: < 1800ms, Needs Improvement: 1800-3000ms, Poor: > 3000ms
   */
  FCP?: number;
}

/**
 * Resource timing entry summary
 */
export interface ResourceTiming {
  name: string;
  type: string;
  duration: number;
  size: number;
  startTime: number;
}

/**
 * Memory info (Chrome only)
 */
export interface MemoryInfo {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

/**
 * Complete performance data
 */
export interface PerformanceData {
  coreWebVitals: CoreWebVitals;
  timing: {
    domContentLoaded: number;
    loadComplete: number;
    timeToInteractive?: number;
  };
  resources: {
    total: number;
    byType: Record<string, { count: number; totalSize: number; totalDuration: number }>;
    slowest: ResourceTiming[];
    largest: ResourceTiming[];
  };
  memory?: MemoryInfo;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
  timestamp: number;
}

/**
 * Performance capture configuration
 */
export interface PerformanceCaptureConfig {
  /**
   * Enable Core Web Vitals tracking
   * @default true
   */
  trackCoreWebVitals?: boolean;

  /**
   * Enable resource timing tracking
   * @default true
   */
  trackResources?: boolean;

  /**
   * Maximum number of slow/large resources to track
   * @default 5
   */
  maxResourceEntries?: number;

  /**
   * Enable memory tracking (Chrome only)
   * @default true
   */
  trackMemory?: boolean;

  /**
   * Callback when a metric is captured
   */
  onMetric?: (name: string, value: number) => void;
}

// Module state
let isInitialized = false;
let config: Required<PerformanceCaptureConfig>;
let metrics: CoreWebVitals = {};
let observers: PerformanceObserver[] = [];

const DEFAULT_CONFIG: Required<PerformanceCaptureConfig> = {
  trackCoreWebVitals: true,
  trackResources: true,
  maxResourceEntries: 5,
  trackMemory: true,
  onMetric: () => {},
};

/**
 * Get rating for a metric value
 */
function getMetricRating(
  name: keyof CoreWebVitals,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<keyof CoreWebVitals, [number, number]> = {
    LCP: [2500, 4000],
    FID: [100, 300],
    CLS: [0.1, 0.25],
    INP: [200, 500],
    TTFB: [800, 1800],
    FCP: [1800, 3000],
  };

  const [good, poor] = thresholds[name] ?? [0, 0];

  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Creates and registers a PerformanceObserver
 */
function createObserver(
  type: string,
  callback: (entries: PerformanceEntryList) => void
): PerformanceObserver | null {
  try {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
    });

    observer.observe({ type, buffered: true });
    observers.push(observer);
    return observer;
  } catch {
    // Observer type not supported
    return null;
  }
}

/**
 * Initialize LCP tracking
 */
function initLCP(): void {
  createObserver('largest-contentful-paint', (entries) => {
    const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
      startTime: number;
    };
    if (lastEntry) {
      metrics.LCP = Math.round(lastEntry.startTime);
      config.onMetric('LCP', metrics.LCP);
    }
  });
}

/**
 * Initialize FID tracking
 */
function initFID(): void {
  createObserver('first-input', (entries) => {
    const firstEntry = entries[0] as PerformanceEntry & {
      processingStart: number;
      startTime: number;
    };
    if (firstEntry) {
      metrics.FID = Math.round(firstEntry.processingStart - firstEntry.startTime);
      config.onMetric('FID', metrics.FID);
    }
  });
}

/**
 * Initialize CLS tracking
 */
function initCLS(): void {
  let clsValue = 0;
  let sessionValue = 0;
  let sessionEntries: PerformanceEntry[] = [];

  createObserver('layout-shift', (entries) => {
    for (const entry of entries as Array<
      PerformanceEntry & { hadRecentInput: boolean; value: number }
    >) {
      // Only count if there was no recent input
      if (!entry.hadRecentInput) {
        const firstSessionEntry = sessionEntries[0] as PerformanceEntry | undefined;
        const lastSessionEntry = sessionEntries[sessionEntries.length - 1] as PerformanceEntry | undefined;

        // Start new session if gap > 1s or session > 5s
        if (
          sessionEntries.length > 0 &&
          firstSessionEntry &&
          lastSessionEntry &&
          (entry.startTime - lastSessionEntry.startTime > 1000 ||
           entry.startTime - firstSessionEntry.startTime > 5000)
        ) {
          if (sessionValue > clsValue) {
            clsValue = sessionValue;
          }
          sessionValue = 0;
          sessionEntries = [];
        }

        sessionEntries.push(entry);
        sessionValue += entry.value;
      }
    }

    // Update with max of current session and previous max
    metrics.CLS = Math.round(Math.max(clsValue, sessionValue) * 1000) / 1000;
    config.onMetric('CLS', metrics.CLS);
  });
}

/**
 * Initialize INP tracking
 */
function initINP(): void {
  const interactions: number[] = [];

  createObserver('event', (entries) => {
    for (const entry of entries as Array<
      PerformanceEntry & { duration: number; interactionId?: number }
    >) {
      if (entry.interactionId) {
        interactions.push(entry.duration);
      }
    }

    if (interactions.length > 0) {
      // INP is the 98th percentile of interactions
      interactions.sort((a, b) => a - b);
      const p98Index = Math.floor(interactions.length * 0.98);
      metrics.INP = interactions[p98Index];
      config.onMetric('INP', metrics.INP ?? 0);
    }
  });
}

/**
 * Initialize FCP tracking
 */
function initFCP(): void {
  createObserver('paint', (entries) => {
    for (const entry of entries) {
      if (entry.name === 'first-contentful-paint') {
        metrics.FCP = Math.round(entry.startTime);
        config.onMetric('FCP', metrics.FCP);
      }
    }
  });
}

/**
 * Get TTFB from Navigation Timing
 */
function getTTFB(): number | undefined {
  const navigation = performance.getEntriesByType(
    'navigation'
  )[0] as PerformanceNavigationTiming | undefined;

  if (navigation) {
    const ttfb = Math.round(navigation.responseStart - navigation.requestStart);
    metrics.TTFB = ttfb;
    config.onMetric('TTFB', ttfb);
    return ttfb;
  }

  return undefined;
}

/**
 * Initialize performance capture
 */
export function initPerformanceCapture(
  userConfig: PerformanceCaptureConfig = {}
): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return;
  }

  if (isInitialized) {
    config = { ...config, ...userConfig };
    return;
  }

  config = { ...DEFAULT_CONFIG, ...userConfig };

  if (config.trackCoreWebVitals) {
    initLCP();
    initFID();
    initCLS();
    initINP();
    initFCP();

    // Get TTFB after page load
    if (document.readyState === 'complete') {
      getTTFB();
    } else {
      window.addEventListener('load', () => getTTFB(), { once: true });
    }
  }

  isInitialized = true;
}

/**
 * Get current Core Web Vitals
 */
export function getCoreWebVitals(): CoreWebVitals {
  return { ...metrics };
}

/**
 * Get Core Web Vitals with ratings
 */
export function getCoreWebVitalsWithRatings(): Record<
  string,
  { value: number; rating: string } | null
> {
  const result: Record<string, { value: number; rating: string } | null> = {};

  for (const [key, value] of Object.entries(metrics)) {
    if (value !== undefined) {
      result[key] = {
        value,
        rating: getMetricRating(key as keyof CoreWebVitals, value),
      };
    } else {
      result[key] = null;
    }
  }

  return result;
}

/**
 * Get resource timing data
 */
export function getResourceTiming(): PerformanceData['resources'] {
  if (!config?.trackResources) {
    return {
      total: 0,
      byType: {},
      slowest: [],
      largest: [],
    };
  }

  const resources = performance.getEntriesByType(
    'resource'
  ) as PerformanceResourceTiming[];

  const byType: Record<
    string,
    { count: number; totalSize: number; totalDuration: number }
  > = {};

  const resourceTimings: ResourceTiming[] = [];

  for (const resource of resources) {
    const type = resource.initiatorType || 'other';
    const size = resource.transferSize || 0;
    const duration = resource.duration;

    // Aggregate by type
    if (!byType[type]) {
      byType[type] = { count: 0, totalSize: 0, totalDuration: 0 };
    }
    byType[type].count++;
    byType[type].totalSize += size;
    byType[type].totalDuration += duration;

    resourceTimings.push({
      name: resource.name,
      type,
      duration: Math.round(duration),
      size,
      startTime: Math.round(resource.startTime),
    });
  }

  // Get slowest resources
  const slowest = [...resourceTimings]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, config.maxResourceEntries);

  // Get largest resources
  const largest = [...resourceTimings]
    .sort((a, b) => b.size - a.size)
    .slice(0, config.maxResourceEntries);

  return {
    total: resources.length,
    byType,
    slowest,
    largest,
  };
}

/**
 * Get memory info (Chrome only)
 */
export function getMemoryInfo(): MemoryInfo | undefined {
  if (!config?.trackMemory) return undefined;

  // Chrome-specific memory API
  const memory = (performance as Performance & { memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } }).memory;

  if (memory) {
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }

  return undefined;
}

/**
 * Get connection info
 */
export function getConnectionInfo(): PerformanceData['connection'] {
  const nav = navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
      saveData?: boolean;
    };
  };

  if (nav.connection) {
    return {
      effectiveType: nav.connection.effectiveType,
      downlink: nav.connection.downlink,
      rtt: nav.connection.rtt,
      saveData: nav.connection.saveData,
    };
  }

  return undefined;
}

/**
 * Get navigation timing data
 */
export function getNavigationTiming(): PerformanceData['timing'] {
  const navigation = performance.getEntriesByType(
    'navigation'
  )[0] as PerformanceNavigationTiming | undefined;

  if (navigation) {
    return {
      domContentLoaded: Math.round(navigation.domContentLoadedEventEnd),
      loadComplete: Math.round(navigation.loadEventEnd),
      timeToInteractive: Math.round(navigation.domInteractive),
    };
  }

  // Fallback to legacy timing API
  const timing = performance.timing;
  if (timing) {
    const navStart = timing.navigationStart;
    return {
      domContentLoaded: timing.domContentLoadedEventEnd - navStart,
      loadComplete: timing.loadEventEnd - navStart,
      timeToInteractive: timing.domInteractive - navStart,
    };
  }

  return {
    domContentLoaded: 0,
    loadComplete: 0,
  };
}

/**
 * Get complete performance data snapshot
 */
export function getPerformanceData(): PerformanceData {
  return {
    coreWebVitals: getCoreWebVitals(),
    timing: getNavigationTiming(),
    resources: getResourceTiming(),
    memory: getMemoryInfo(),
    connection: getConnectionInfo(),
    timestamp: Date.now(),
  };
}

/**
 * Get performance summary for AI analysis
 */
export function getPerformanceSummary(): {
  vitals: Record<string, { value: number; rating: string } | null>;
  issues: string[];
  score: number;
  summary: string;
} {
  const vitals = getCoreWebVitalsWithRatings();
  const issues: string[] = [];
  let totalScore = 0;
  let metricCount = 0;

  // Check each metric and identify issues
  for (const [name, data] of Object.entries(vitals)) {
    if (data) {
      metricCount++;
      if (data.rating === 'good') {
        totalScore += 100;
      } else if (data.rating === 'needs-improvement') {
        totalScore += 50;
        issues.push(`${name} needs improvement (${data.value})`);
      } else {
        issues.push(`${name} is poor (${data.value})`);
      }
    }
  }

  // Check for slow resources
  const resources = getResourceTiming();
  const slowResources = resources.slowest.filter((r) => r.duration > 1000);
  if (slowResources.length > 0) {
    issues.push(
      `${slowResources.length} slow resource(s) (>1s): ${slowResources.map((r) => r.name.split('/').pop()).join(', ')}`
    );
  }

  // Check memory (Chrome)
  const memory = getMemoryInfo();
  if (memory && memory.usedJSHeapSize && memory.jsHeapSizeLimit) {
    const memoryUsagePercent =
      (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    if (memoryUsagePercent > 80) {
      issues.push(`High memory usage (${Math.round(memoryUsagePercent)}%)`);
    }
  }

  const score = metricCount > 0 ? Math.round(totalScore / metricCount) : 0;

  // Generate summary
  const timing = getNavigationTiming();
  const summary = [
    `Performance Score: ${score}/100`,
    `Load Time: ${timing.loadComplete}ms`,
    `DOM Interactive: ${timing.timeToInteractive ?? 'N/A'}ms`,
    `Resources: ${resources.total} (${Object.entries(resources.byType).map(([t, d]) => `${t}: ${d.count}`).join(', ')})`,
    issues.length > 0 ? `Issues: ${issues.join('; ')}` : 'No major issues',
  ].join('\n');

  return {
    vitals,
    issues,
    score,
    summary,
  };
}

/**
 * Stop capturing and cleanup observers
 */
export function stopPerformanceCapture(): void {
  if (!isInitialized) return;

  for (const observer of observers) {
    observer.disconnect();
  }
  observers = [];

  isInitialized = false;
}

/**
 * Reset metrics
 */
export function resetMetrics(): void {
  metrics = {};
}
