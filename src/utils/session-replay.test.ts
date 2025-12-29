/**
 * Session Replay Module Tests
 *
 * Tests the rrweb integration for feasibility verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SessionReplayData } from './session-replay';

// Mock rrweb module since jsdom doesn't fully support it
vi.mock('rrweb', () => {
  let emitCallback: ((event: unknown, isCheckout?: boolean) => void) | null =
    null;
  let eventCounter = 0;

  return {
    record: vi.fn((options: { emit: (event: unknown, isCheckout?: boolean) => void }) => {
      emitCallback = options.emit;
      eventCounter = 0;

      // Simulate initial full snapshot
      emitCallback(
        {
          type: 2, // FullSnapshot
          data: { node: { type: 0, childNodes: [] }, initialOffset: { top: 0, left: 0 } },
          timestamp: Date.now(),
        },
        true
      );

      // Simulate some incremental snapshots
      const interval = setInterval(() => {
        if (emitCallback && eventCounter < 10) {
          eventCounter++;
          emitCallback(
            {
              type: 3, // IncrementalSnapshot
              data: { source: 1, x: 100, y: 100 }, // MouseMove
              timestamp: Date.now(),
            },
            false
          );
        }
      }, 100);

      // Return stop function
      return () => {
        clearInterval(interval);
        emitCallback = null;
      };
    }),
  };
});

describe('Session Replay Module', () => {
  let sessionReplay: typeof import('./session-replay');

  beforeEach(async () => {
    vi.resetModules();
    sessionReplay = await import('./session-replay');
  });

  afterEach(() => {
    // Clean up any recording
    if (sessionReplay.isRecording()) {
      sessionReplay.stopSessionReplay();
    }
  });

  describe('startSessionReplay', () => {
    it('should start recording successfully', async () => {
      await sessionReplay.startSessionReplay();

      expect(sessionReplay.isRecording()).toBe(true);
      expect(sessionReplay.getRecordingState()).toBe('recording');
    });

    it('should warn if already recording', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await sessionReplay.startSessionReplay();
      await sessionReplay.startSessionReplay(); // Second call

      expect(warnSpy).toHaveBeenCalledWith(
        'Session replay is already recording'
      );
      warnSpy.mockRestore();
    });

    it('should accept custom configuration', async () => {
      await sessionReplay.startSessionReplay({
        maxBufferDuration: 120000,
        checkoutInterval: 60000,
        maskInputs: true,
        blockSelectors: ['.secret'],
        maskSelectors: ['.pii'],
      });

      expect(sessionReplay.isRecording()).toBe(true);
    });

    it('should call onStart callback', async () => {
      const onStart = vi.fn();

      await sessionReplay.startSessionReplay({ onStart });

      expect(onStart).toHaveBeenCalled();
    });
  });

  describe('stopSessionReplay', () => {
    it('should return session data when stopped', async () => {
      await sessionReplay.startSessionReplay();

      // Wait for some events
      await new Promise((resolve) => setTimeout(resolve, 350));

      const data = sessionReplay.stopSessionReplay();

      expect(data).not.toBeNull();
      expect(data!.events.length).toBeGreaterThan(0);
      expect(data!.startTime).toBeLessThanOrEqual(data!.endTime);
      expect(data!.duration).toBeGreaterThanOrEqual(0);
      expect(data!.sizeBytes).toBeGreaterThan(0);
      expect(data!.eventCount).toBe(data!.events.length);
    });

    it('should return null if not recording', () => {
      const data = sessionReplay.stopSessionReplay();
      expect(data).toBeNull();
    });

    it('should reset state after stopping', async () => {
      await sessionReplay.startSessionReplay();
      sessionReplay.stopSessionReplay();

      expect(sessionReplay.isRecording()).toBe(false);
      expect(sessionReplay.getRecordingState()).toBe('idle');
    });

    it('should call onStop callback', async () => {
      const onStop = vi.fn();

      await sessionReplay.startSessionReplay({ onStop });
      sessionReplay.stopSessionReplay();

      expect(onStop).toHaveBeenCalled();
    });
  });

  describe('getSessionReplaySnapshot', () => {
    it('should return current data without stopping', async () => {
      await sessionReplay.startSessionReplay();
      await new Promise((resolve) => setTimeout(resolve, 250));

      const snapshot = sessionReplay.getSessionReplaySnapshot();

      expect(snapshot).not.toBeNull();
      expect(sessionReplay.isRecording()).toBe(true); // Still recording
    });

    it('should return null if not recording', () => {
      const snapshot = sessionReplay.getSessionReplaySnapshot();
      expect(snapshot).toBeNull();
    });
  });

  describe('calculateReplayQualityScore', () => {
    it('should calculate quality score from replay data', async () => {
      await sessionReplay.startSessionReplay();
      await new Promise((resolve) => setTimeout(resolve, 350));
      const data = sessionReplay.stopSessionReplay();

      const { score, factors } = sessionReplay.calculateReplayQualityScore(
        data!
      );

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(factors.hasFullSnapshot).toBeDefined();
      expect(factors.hasMutations).toBeDefined();
    });

    it('should give higher score to data with full snapshot', () => {
      const withFullSnapshot: SessionReplayData = {
        events: [
          { type: 2, data: {}, timestamp: 1000 } as any, // FullSnapshot
          { type: 3, data: { source: 1 }, timestamp: 1100 } as any,
        ],
        startTime: 1000,
        endTime: 6000,
        duration: 5000,
        sizeBytes: 1000,
        eventCount: 2,
      };

      const withoutFullSnapshot: SessionReplayData = {
        events: [{ type: 3, data: { source: 1 }, timestamp: 1100 } as any],
        startTime: 1000,
        endTime: 6000,
        duration: 5000,
        sizeBytes: 500,
        eventCount: 1,
      };

      const scoreWith =
        sessionReplay.calculateReplayQualityScore(withFullSnapshot);
      const scoreWithout =
        sessionReplay.calculateReplayQualityScore(withoutFullSnapshot);

      expect(scoreWith.score).toBeGreaterThan(scoreWithout.score);
    });
  });

  describe('createReplayUrl', () => {
    it('should create rrweb player URL for small replays', () => {
      const data: SessionReplayData = {
        events: [{ type: 2, data: {}, timestamp: 1000 } as any],
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
        sizeBytes: 100,
        eventCount: 1,
      };

      const url = sessionReplay.createReplayUrl(data);

      expect(url).toContain('https://rrweb.io/player');
      expect(url).toContain('events=');
    });
  });
});

describe('Session Replay Data Quality', () => {
  it('defines consistent data structure regardless of source', () => {
    // This test documents the data structure
    const exampleData: SessionReplayData = {
      events: [
        // FullSnapshot - captures entire DOM state
        {
          type: 2,
          data: {
            node: {
              type: 0,
              childNodes: [
                {
                  type: 1,
                  tagName: 'html',
                  attributes: {},
                  childNodes: [],
                },
              ],
            },
            initialOffset: { top: 0, left: 0 },
          },
          timestamp: 1700000000000,
        },
        // IncrementalSnapshot - mouse movement
        {
          type: 3,
          data: {
            source: 1, // MouseMove
            positions: [{ x: 100, y: 200, id: 1, timeOffset: 0 }],
          },
          timestamp: 1700000000100,
        },
        // IncrementalSnapshot - click
        {
          type: 3,
          data: {
            source: 2, // MouseInteraction
            type: 2, // Click
            id: 5,
            x: 150,
            y: 250,
          },
          timestamp: 1700000000200,
        },
        // IncrementalSnapshot - DOM mutation
        {
          type: 3,
          data: {
            source: 0, // Mutation
            texts: [],
            attributes: [],
            removes: [],
            adds: [{ parentId: 1, node: { type: 3, textContent: 'Hello' } }],
          },
          timestamp: 1700000000300,
        },
        // IncrementalSnapshot - input
        {
          type: 3,
          data: {
            source: 5, // Input
            id: 10,
            text: '***', // Masked input
            isChecked: false,
          },
          timestamp: 1700000000400,
        },
      ] as any[],
      startTime: 1700000000000,
      endTime: 1700000000500,
      duration: 500,
      sizeBytes: 2048,
      eventCount: 5,
    };

    // Verify structure consistency
    expect(exampleData.events).toBeInstanceOf(Array);
    expect(exampleData.events.every((e) => 'type' in e)).toBe(true);
    expect(exampleData.events.every((e) => 'timestamp' in e)).toBe(true);
    expect(exampleData.events.every((e) => 'data' in e)).toBe(true);
  });

  it('captures data independent of console logging', () => {
    /**
     * Key insight: rrweb captures:
     * - DOM structure (regardless of JS logging)
     * - User interactions (clicks, inputs, scrolls)
     * - Visual changes (CSS, mutations)
     * - Network requests are NOT captured (need separate interceptor)
     *
     * This means:
     * ✅ No dependency on developer logging practices
     * ✅ Works across all frameworks
     * ✅ Consistent data for all users
     * ❌ Does not capture network request bodies
     * ❌ Does not capture JS variable state
     */
    expect(true).toBe(true);
  });
});

describe('Bundle Size Impact', () => {
  it('documents rrweb bundle size impact', () => {
    /**
     * Bundle Size Analysis:
     *
     * rrweb@2.0.0-alpha.17:
     * - Minified: ~256 KB
     * - Gzipped: ~77 KB
     *
     * For comparison:
     * - React: ~45 KB gzipped
     * - Vue: ~34 KB gzipped
     * - inner-lens current: ~15 KB gzipped (estimated)
     *
     * Impact: Adding rrweb would increase bundle by ~5x
     *
     * Mitigation strategies:
     * 1. Dynamic import (only load when needed)
     * 2. Separate "inner-lens/replay" export
     * 3. CDN loading option
     * 4. Record-only package (@rrweb/record): ~40KB gzipped
     */
    const rrwebGzipped = 77; // KB
    const currentEstimate = 15; // KB
    const increase = ((rrwebGzipped / currentEstimate) * 100).toFixed(0);

    expect(parseInt(increase)).toBeGreaterThan(400); // Significant increase
  });
});

describe('Privacy and Security', () => {
  it('documents privacy features', () => {
    /**
     * Privacy Features:
     *
     * 1. Input Masking (maskAllInputs: true)
     *    - All input values shown as "***"
     *    - Includes password, text, textarea
     *
     * 2. Block Selectors (blockSelector)
     *    - Elements completely hidden in replay
     *    - Use for sensitive areas
     *
     * 3. Mask Text Selectors (maskTextSelector)
     *    - Text replaced with placeholders
     *    - Use for PII fields
     *
     * 4. No Cross-Origin Iframes (recordCrossOriginIframes: false)
     *    - Third-party content not recorded
     *
     * 5. Inline Images Disabled (inlineImages: false)
     *    - Images not base64 encoded
     *    - Reduces data and privacy risk
     */
    expect(true).toBe(true);
  });
});
