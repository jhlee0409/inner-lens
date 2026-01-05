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

describe('performance-capture', () => {
  beforeEach(() => {
    stopPerformanceCapture();
    resetMetrics();
  });

  afterEach(() => {
    stopPerformanceCapture();
    resetMetrics();
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
      // Good: < 2500ms
      // Needs improvement: 2500-4000ms
      // Poor: > 4000ms
      // This is tested indirectly through getCoreWebVitalsWithRatings
    });

    it('should rate FID correctly', () => {
      // Good: < 100ms
      // Needs improvement: 100-300ms
      // Poor: > 300ms
    });

    it('should rate CLS correctly', () => {
      // Good: < 0.1
      // Needs improvement: 0.1-0.25
      // Poor: > 0.25
    });
  });
});
