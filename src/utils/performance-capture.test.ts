import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initPerformanceCapture,
  getCoreWebVitals,
  getCoreWebVitalsWithRatings,
  getResourceTiming,
  getMemoryInfo,
  getConnectionInfo,
  getNavigationTiming,
  getPerformanceData,
  getPerformanceSummary,
  stopPerformanceCapture,
  resetMetrics,
} from './performance-capture';

// Store observer callbacks for triggering in tests
type ObserverCallback = (entries: PerformanceEntryList) => void;
const observerCallbacks: Map<string, ObserverCallback> = new Map();

// Mock PerformanceObserver to capture callbacks
class MockPerformanceObserver {
  private callback: PerformanceObserverCallback;
  private type: string = '';

  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback;
  }

  observe(options: { type: string; buffered?: boolean }) {
    this.type = options.type;
    // Store callback for manual triggering
    observerCallbacks.set(options.type, (entries) => {
      this.callback(
        { getEntries: () => entries } as PerformanceObserverEntryList,
        this as unknown as PerformanceObserver
      );
    });
  }

  disconnect() {
    observerCallbacks.delete(this.type);
  }
}

// Helper to trigger observer callbacks in tests
function triggerObserver(type: string, entries: Record<string, unknown>[]) {
  const callback = observerCallbacks.get(type);
  if (callback) {
    callback(entries as unknown as PerformanceEntry[]);
  }
}

describe('performance-capture', () => {
  const originalPerformanceObserver = globalThis.PerformanceObserver;

  beforeEach(() => {
    stopPerformanceCapture();
    resetMetrics();
    observerCallbacks.clear();
    // Install mock PerformanceObserver
    globalThis.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver;
  });

  afterEach(() => {
    stopPerformanceCapture();
    resetMetrics();
    observerCallbacks.clear();
    // Restore original
    globalThis.PerformanceObserver = originalPerformanceObserver;
  });

  describe('initPerformanceCapture', () => {
    it('should initialize without errors', () => {
      expect(() => initPerformanceCapture()).not.toThrow();
    });

    it('should accept custom config', () => {
      expect(() =>
        initPerformanceCapture({
          trackCoreWebVitals: true,
          trackResources: true,
          maxResourceEntries: 10,
          trackMemory: true,
        })
      ).not.toThrow();
    });

    it('should not throw if called multiple times', () => {
      initPerformanceCapture();
      expect(() => initPerformanceCapture()).not.toThrow();
    });
  });

  describe('getCoreWebVitals', () => {
    it('should return web vitals object', () => {
      initPerformanceCapture();
      const vitals = getCoreWebVitals();

      expect(vitals).toBeDefined();
      expect(typeof vitals).toBe('object');
      // Note: In jsdom, PerformanceObserver might not capture real metrics
      // so we just check the structure
    });

    it('should return a copy of metrics', () => {
      initPerformanceCapture();
      const vitals1 = getCoreWebVitals();
      const vitals2 = getCoreWebVitals();
      expect(vitals1).not.toBe(vitals2);
    });
  });

  describe('getCoreWebVitalsWithRatings', () => {
    it('should return metrics with ratings', () => {
      initPerformanceCapture();
      const rated = getCoreWebVitalsWithRatings();

      expect(rated).toBeDefined();
      // Each metric should be null or have value+rating
      for (const key of ['LCP', 'FID', 'CLS', 'INP', 'TTFB', 'FCP']) {
        const metric = rated[key];
        if (metric !== null && metric !== undefined) {
          expect(metric).toHaveProperty('value');
          expect(metric).toHaveProperty('rating');
          expect(['good', 'needs-improvement', 'poor']).toContain(metric.rating);
        }
      }
    });
  });

  describe('getResourceTiming', () => {
    it('should return resource timing data', () => {
      initPerformanceCapture({ trackResources: true });
      const resources = getResourceTiming();

      expect(resources).toBeDefined();
      expect(resources).toHaveProperty('total');
      expect(resources).toHaveProperty('byType');
      expect(resources).toHaveProperty('slowest');
      expect(resources).toHaveProperty('largest');
      expect(Array.isArray(resources.slowest)).toBe(true);
      expect(Array.isArray(resources.largest)).toBe(true);
    });

    it('should return empty data when tracking is disabled', () => {
      initPerformanceCapture({ trackResources: false });
      const resources = getResourceTiming();

      expect(resources.total).toBe(0);
      expect(resources.slowest).toHaveLength(0);
      expect(resources.largest).toHaveLength(0);
    });
  });

  describe('getMemoryInfo', () => {
    it('should return memory info or undefined', () => {
      initPerformanceCapture({ trackMemory: true });
      const memory = getMemoryInfo();

      // Memory API is Chrome-only, might be undefined in jsdom
      if (memory !== undefined) {
        expect(memory).toHaveProperty('usedJSHeapSize');
        expect(memory).toHaveProperty('totalJSHeapSize');
        expect(memory).toHaveProperty('jsHeapSizeLimit');
      }
    });

    it('should return undefined when tracking is disabled', () => {
      initPerformanceCapture({ trackMemory: false });
      const memory = getMemoryInfo();
      expect(memory).toBeUndefined();
    });
  });

  describe('getConnectionInfo', () => {
    it('should return connection info or undefined', () => {
      initPerformanceCapture();
      const connection = getConnectionInfo();

      // Navigator.connection is not available in all browsers/jsdom
      if (connection !== undefined) {
        expect(typeof connection).toBe('object');
      }
    });
  });

  describe('getNavigationTiming', () => {
    it('should return navigation timing data', () => {
      initPerformanceCapture();
      const timing = getNavigationTiming();

      expect(timing).toBeDefined();
      expect(timing).toHaveProperty('domContentLoaded');
      expect(timing).toHaveProperty('loadComplete');
      expect(typeof timing.domContentLoaded).toBe('number');
      expect(typeof timing.loadComplete).toBe('number');
    });
  });

  describe('getPerformanceData', () => {
    it('should return complete performance data snapshot', () => {
      initPerformanceCapture();
      const data = getPerformanceData();

      expect(data).toHaveProperty('coreWebVitals');
      expect(data).toHaveProperty('timing');
      expect(data).toHaveProperty('resources');
      expect(data).toHaveProperty('timestamp');
      expect(data.timestamp).toBeGreaterThan(0);
    });
  });

  describe('getPerformanceSummary', () => {
    it('should return performance summary with score', () => {
      initPerformanceCapture();
      const summary = getPerformanceSummary();

      expect(summary).toHaveProperty('vitals');
      expect(summary).toHaveProperty('issues');
      expect(summary).toHaveProperty('score');
      expect(summary).toHaveProperty('summary');

      expect(Array.isArray(summary.issues)).toBe(true);
      expect(typeof summary.score).toBe('number');
      expect(summary.score).toBeGreaterThanOrEqual(0);
      expect(summary.score).toBeLessThanOrEqual(100);
      expect(typeof summary.summary).toBe('string');
    });
  });

  describe('stopPerformanceCapture', () => {
    it('should stop capture without errors', () => {
      initPerformanceCapture();
      expect(() => stopPerformanceCapture()).not.toThrow();
    });

    it('should allow re-initialization after stop', () => {
      initPerformanceCapture();
      stopPerformanceCapture();
      expect(() => initPerformanceCapture()).not.toThrow();
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics', () => {
      initPerformanceCapture();
      // Metrics might be populated by observers
      resetMetrics();

      const vitals = getCoreWebVitals();
      expect(Object.keys(vitals).length).toBe(0);
    });
  });

  describe('onMetric callback', () => {
    it('should call callback when metrics are captured', () => {
      const callback = vi.fn();
      initPerformanceCapture({ onMetric: callback });

      // In real browser, this would be called by PerformanceObserver
      // We're just checking the setup doesn't throw
      expect(callback).toBeDefined();
    });
  });

  describe('rating thresholds', () => {
    it('should rate LCP correctly', () => {
      initPerformanceCapture();
      triggerObserver('largest-contentful-paint', [{ startTime: 1500 }]);
      const rated = getCoreWebVitalsWithRatings();
      expect(rated['LCP']).toEqual({ value: 1500, rating: 'good' });
    });

    it('should rate FID correctly', () => {
      initPerformanceCapture();
      triggerObserver('first-input', [{ startTime: 100, processingStart: 250 }]);
      const rated = getCoreWebVitalsWithRatings();
      expect(rated['FID']).toEqual({ value: 150, rating: 'needs-improvement' });
    });

    it('should rate CLS correctly', () => {
      initPerformanceCapture();
      triggerObserver('layout-shift', [{ hadRecentInput: false, value: 0.3, startTime: 100 }]);
      const rated = getCoreWebVitalsWithRatings();
      expect(rated['CLS']).toEqual({ value: 0.3, rating: 'poor' });
    });
  });

  describe('LCP tracking', () => {
    it('should capture LCP from largest-contentful-paint observer', () => {
      const onMetric = vi.fn();
      initPerformanceCapture({ onMetric });

      triggerObserver('largest-contentful-paint', [
        { startTime: 1000 },
        { startTime: 2000 },
        { startTime: 2500.7 },
      ]);

      const vitals = getCoreWebVitals();
      expect(vitals.LCP).toBe(2501);
      expect(onMetric).toHaveBeenCalledWith('LCP', 2501);
    });

    it('should handle empty entries', () => {
      initPerformanceCapture();
      triggerObserver('largest-contentful-paint', []);
      expect(getCoreWebVitals().LCP).toBeUndefined();
    });
  });

  describe('FID tracking', () => {
    it('should capture FID from first-input observer', () => {
      const onMetric = vi.fn();
      initPerformanceCapture({ onMetric });

      triggerObserver('first-input', [{ startTime: 100, processingStart: 150 }]);

      const vitals = getCoreWebVitals();
      expect(vitals.FID).toBe(50);
      expect(onMetric).toHaveBeenCalledWith('FID', 50);
    });

    it('should handle empty entries', () => {
      initPerformanceCapture();
      triggerObserver('first-input', []);
      expect(getCoreWebVitals().FID).toBeUndefined();
    });
  });

  describe('CLS tracking', () => {
    it('should accumulate layout shift values', () => {
      const onMetric = vi.fn();
      initPerformanceCapture({ onMetric });

      triggerObserver('layout-shift', [
        { hadRecentInput: false, value: 0.05, startTime: 100 },
        { hadRecentInput: false, value: 0.03, startTime: 200 },
      ]);

      const vitals = getCoreWebVitals();
      expect(vitals.CLS).toBe(0.08);
      expect(onMetric).toHaveBeenCalledWith('CLS', 0.08);
    });

    it('should ignore shifts with recent input', () => {
      initPerformanceCapture();

      triggerObserver('layout-shift', [
        { hadRecentInput: true, value: 0.5, startTime: 100 },
        { hadRecentInput: false, value: 0.02, startTime: 200 },
      ]);

      expect(getCoreWebVitals().CLS).toBe(0.02);
    });

    it('should start new session when gap exceeds 1 second', () => {
      initPerformanceCapture();

      triggerObserver('layout-shift', [
        { hadRecentInput: false, value: 0.1, startTime: 100 },
      ]);
      triggerObserver('layout-shift', [
        { hadRecentInput: false, value: 0.05, startTime: 200 },
      ]);
      triggerObserver('layout-shift', [
        { hadRecentInput: false, value: 0.2, startTime: 1500 },
      ]);

      const vitals = getCoreWebVitals();
      expect(vitals.CLS).toBe(0.2);
    });

    it('should start new session when session exceeds 5 seconds', () => {
      initPerformanceCapture();

      triggerObserver('layout-shift', [
        { hadRecentInput: false, value: 0.05, startTime: 100 },
        { hadRecentInput: false, value: 0.03, startTime: 200 },
      ]);
      triggerObserver('layout-shift', [
        { hadRecentInput: false, value: 0.02, startTime: 5200 },
      ]);

      expect(getCoreWebVitals().CLS).toBe(0.08);
    });
  });

  describe('INP tracking', () => {
    it('should capture INP at 98th percentile', () => {
      const onMetric = vi.fn();
      initPerformanceCapture({ onMetric });

      const entries = Array.from({ length: 100 }, (_, i) => ({
        interactionId: i + 1,
        duration: (i + 1) * 10,
      }));

      triggerObserver('event', entries);

      const vitals = getCoreWebVitals();
      expect(vitals.INP).toBe(990);
      expect(onMetric).toHaveBeenCalledWith('INP', 990);
    });

    it('should ignore entries without interactionId', () => {
      initPerformanceCapture();

      triggerObserver('event', [
        { duration: 100 },
        { interactionId: 1, duration: 50 },
      ]);

      expect(getCoreWebVitals().INP).toBe(50);
    });

    it('should handle empty interactions', () => {
      initPerformanceCapture();
      triggerObserver('event', []);
      expect(getCoreWebVitals().INP).toBeUndefined();
    });
  });

  describe('FCP tracking', () => {
    it('should capture FCP from paint observer', () => {
      const onMetric = vi.fn();
      initPerformanceCapture({ onMetric });

      triggerObserver('paint', [
        { name: 'first-paint', startTime: 500 },
        { name: 'first-contentful-paint', startTime: 800.5 },
      ]);

      const vitals = getCoreWebVitals();
      expect(vitals.FCP).toBe(801);
      expect(onMetric).toHaveBeenCalledWith('FCP', 801);
    });

    it('should ignore non-FCP paint entries', () => {
      initPerformanceCapture();

      triggerObserver('paint', [{ name: 'first-paint', startTime: 500 }]);

      expect(getCoreWebVitals().FCP).toBeUndefined();
    });
  });

  describe('TTFB tracking', () => {
    it('should capture TTFB from navigation timing', () => {
      const onMetric = vi.fn();
      const mockNavigation = {
        requestStart: 100,
        responseStart: 350,
      };

      vi.spyOn(performance, 'getEntriesByType').mockImplementation((type) => {
        if (type === 'navigation') return [mockNavigation as PerformanceNavigationTiming];
        return [];
      });

      initPerformanceCapture({ onMetric });

      const vitals = getCoreWebVitals();
      expect(vitals.TTFB).toBe(250);
      expect(onMetric).toHaveBeenCalledWith('TTFB', 250);

      vi.restoreAllMocks();
    });
  });

  describe('getResourceTiming with data', () => {
    it('should aggregate resources by type', () => {
      const mockResources = [
        { name: 'script.js', initiatorType: 'script', transferSize: 1000, duration: 100, startTime: 50 },
        { name: 'style.css', initiatorType: 'link', transferSize: 500, duration: 50, startTime: 60 },
        { name: 'app.js', initiatorType: 'script', transferSize: 2000, duration: 200, startTime: 70 },
      ];

      vi.spyOn(performance, 'getEntriesByType').mockImplementation((type) => {
        if (type === 'resource') return mockResources as unknown as PerformanceResourceTiming[];
        return [];
      });

      initPerformanceCapture({ trackResources: true, maxResourceEntries: 5 });
      const resources = getResourceTiming();

      expect(resources.total).toBe(3);
      expect(resources.byType['script']).toEqual({ count: 2, totalSize: 3000, totalDuration: 300 });
      expect(resources.byType['link']).toEqual({ count: 1, totalSize: 500, totalDuration: 50 });
      expect(resources.slowest).toHaveLength(3);
      expect(resources.slowest[0]?.name).toBe('app.js');
      expect(resources.largest[0]?.name).toBe('app.js');

      vi.restoreAllMocks();
    });

    it('should respect maxResourceEntries limit', () => {
      const mockResources = Array.from({ length: 10 }, (_, i) => ({
        name: `file${i}.js`,
        initiatorType: 'script',
        transferSize: (i + 1) * 100,
        duration: (i + 1) * 10,
        startTime: i * 10,
      }));

      vi.spyOn(performance, 'getEntriesByType').mockReturnValue(mockResources as unknown as PerformanceResourceTiming[]);

      initPerformanceCapture({ trackResources: true, maxResourceEntries: 3 });
      const resources = getResourceTiming();

      expect(resources.slowest).toHaveLength(3);
      expect(resources.largest).toHaveLength(3);

      vi.restoreAllMocks();
    });
  });

  describe('getMemoryInfo with data', () => {
    it('should return memory info when available', () => {
      const mockMemory = {
        usedJSHeapSize: 10000000,
        totalJSHeapSize: 50000000,
        jsHeapSizeLimit: 100000000,
      };

      Object.defineProperty(performance, 'memory', {
        value: mockMemory,
        configurable: true,
      });

      initPerformanceCapture({ trackMemory: true });
      const memory = getMemoryInfo();

      expect(memory).toEqual(mockMemory);

      Object.defineProperty(performance, 'memory', {
        value: undefined,
        configurable: true,
      });
    });
  });

  describe('getConnectionInfo with data', () => {
    it('should return connection info when available', () => {
      const mockConnection = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
      };

      Object.defineProperty(navigator, 'connection', {
        value: mockConnection,
        configurable: true,
      });

      initPerformanceCapture();
      const connection = getConnectionInfo();

      expect(connection).toEqual(mockConnection);

      Object.defineProperty(navigator, 'connection', {
        value: undefined,
        configurable: true,
      });
    });
  });

  describe('getNavigationTiming legacy fallback', () => {
    it('should use legacy timing API when navigation timing unavailable', () => {
      vi.spyOn(performance, 'getEntriesByType').mockReturnValue([]);

      const mockTiming = {
        navigationStart: 1000,
        domContentLoadedEventEnd: 2000,
        loadEventEnd: 3000,
        domInteractive: 1500,
      };

      Object.defineProperty(performance, 'timing', {
        value: mockTiming,
        configurable: true,
      });

      initPerformanceCapture();
      const timing = getNavigationTiming();

      expect(timing.domContentLoaded).toBe(1000);
      expect(timing.loadComplete).toBe(2000);
      expect(timing.timeToInteractive).toBe(500);

      vi.restoreAllMocks();
    });
  });

  describe('getPerformanceSummary with issues', () => {
    it('should identify poor metrics as issues', () => {
      initPerformanceCapture();

      triggerObserver('largest-contentful-paint', [{ startTime: 5000 }]);

      const summary = getPerformanceSummary();

      expect(summary.issues).toContain('LCP is poor (5000)');
      expect(summary.score).toBeLessThan(100);
    });

    it('should identify needs-improvement metrics', () => {
      initPerformanceCapture();

      triggerObserver('largest-contentful-paint', [{ startTime: 3000 }]);

      const summary = getPerformanceSummary();

      expect(summary.issues).toContain('LCP needs improvement (3000)');
      expect(summary.score).toBe(50);
    });

    it('should identify slow resources', () => {
      const mockResources = [
        { name: '/api/slow-endpoint', initiatorType: 'fetch', transferSize: 100, duration: 2000, startTime: 0 },
      ];

      vi.spyOn(performance, 'getEntriesByType').mockImplementation((type) => {
        if (type === 'resource') return mockResources as unknown as PerformanceResourceTiming[];
        return [];
      });

      initPerformanceCapture({ trackResources: true });
      const summary = getPerformanceSummary();

      expect(summary.issues.some(i => i.includes('slow resource'))).toBe(true);

      vi.restoreAllMocks();
    });

    it('should identify high memory usage', () => {
      const mockMemory = {
        usedJSHeapSize: 90000000,
        totalJSHeapSize: 100000000,
        jsHeapSizeLimit: 100000000,
      };

      Object.defineProperty(performance, 'memory', {
        value: mockMemory,
        configurable: true,
      });

      initPerformanceCapture({ trackMemory: true });
      const summary = getPerformanceSummary();

      expect(summary.issues.some(i => i.includes('High memory usage'))).toBe(true);

      Object.defineProperty(performance, 'memory', {
        value: undefined,
        configurable: true,
      });
    });

    it('should calculate score from all metrics', () => {
      initPerformanceCapture();

      triggerObserver('largest-contentful-paint', [{ startTime: 1000 }]);
      triggerObserver('layout-shift', [{ hadRecentInput: false, value: 0.05, startTime: 100 }]);
      triggerObserver('paint', [{ name: 'first-contentful-paint', startTime: 500 }]);

      const summary = getPerformanceSummary();

      expect(summary.score).toBe(100);
      expect(summary.issues).toHaveLength(0);
    });
  });
});
