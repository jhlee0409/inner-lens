/**
 * Session Replay Module using rrweb
 *
 * Provides consistent, framework-agnostic session recording
 * that captures DOM state regardless of console logging practices.
 */

import type { eventWithTime, recordOptions } from 'rrweb';
import type { listenerHandler } from '@rrweb/types';

/**
 * Session replay configuration options
 */
export interface SessionReplayConfig {
  /**
   * Maximum duration to keep in buffer (in ms)
   * @default 60000 (1 minute)
   */
  maxBufferDuration?: number;

  /**
   * Checkout interval for creating new snapshots (in ms)
   * @default 30000 (30 seconds)
   */
  checkoutInterval?: number;

  /**
   * Enable/disable input masking for privacy
   * @default true
   */
  maskInputs?: boolean;

  /**
   * CSS selectors for elements to block (hide completely)
   */
  blockSelectors?: string[];

  /**
   * CSS selectors for elements to mask (show placeholder)
   */
  maskSelectors?: string[];

  /**
   * Sampling configuration to reduce data size
   */
  sampling?: {
    mousemove?: boolean | number;
    mouseInteraction?: boolean;
    scroll?: number;
    media?: number;
    input?: 'last' | 'all';
  };

  /**
   * Callback when recording starts
   */
  onStart?: () => void;

  /**
   * Callback when recording stops
   */
  onStop?: () => void;

  /**
   * Callback on error
   */
  onError?: (error: Error) => void;
}

/**
 * Session replay data structure
 */
export interface SessionReplayData {
  /**
   * rrweb events array
   */
  events: eventWithTime[];

  /**
   * Recording start timestamp
   */
  startTime: number;

  /**
   * Recording end timestamp
   */
  endTime: number;

  /**
   * Duration in milliseconds
   */
  duration: number;

  /**
   * Approximate size in bytes
   */
  sizeBytes: number;

  /**
   * Number of events captured
   */
  eventCount: number;
}

/**
 * Session replay state
 */
type ReplayState = 'idle' | 'recording' | 'paused' | 'error';

// Module state
let currentState: ReplayState = 'idle';
let stopFn: listenerHandler | null = null;
let eventsBuffer: eventWithTime[][] = [[]];
let recordingStartTime: number | null = null;
let config: Required<SessionReplayConfig>;

// Default configuration
const DEFAULT_CONFIG: Required<SessionReplayConfig> = {
  maxBufferDuration: 60000,
  checkoutInterval: 30000,
  maskInputs: true,
  blockSelectors: [],
  maskSelectors: ['.sensitive', '[data-sensitive]', '.pii'],
  sampling: {
    mousemove: 50, // Sample every 50ms
    mouseInteraction: true,
    scroll: 150, // Sample every 150ms
    media: 800,
    input: 'last',
  },
  onStart: () => {},
  onStop: () => {},
  onError: () => {},
};

/**
 * Dynamically imports rrweb to support tree-shaking
 */
async function loadRrweb() {
  try {
    const rrweb = await import('rrweb');
    return rrweb;
  } catch (error) {
    throw new Error(
      'Failed to load rrweb. Make sure it is installed: npm install rrweb'
    );
  }
}

/**
 * Initialize and start session recording
 */
export async function startSessionReplay(
  userConfig: SessionReplayConfig = {}
): Promise<void> {
  if (typeof window === 'undefined') {
    console.warn('Session replay is only available in browser environment');
    return;
  }

  if (currentState === 'recording') {
    console.warn('Session replay is already recording');
    return;
  }

  config = { ...DEFAULT_CONFIG, ...userConfig };

  try {
    const { record } = await loadRrweb();

    eventsBuffer = [[]];
    recordingStartTime = Date.now();
    currentState = 'recording';

    const recordOptions: recordOptions<eventWithTime> = {
      emit: (event: eventWithTime, isCheckout?: boolean) => {
        if (isCheckout) {
          // Start new events array on checkout
          eventsBuffer.push([]);
          // Keep only recent buffers based on maxBufferDuration
          const maxBuffers = Math.ceil(
            config.maxBufferDuration / config.checkoutInterval
          );
          if (eventsBuffer.length > maxBuffers + 1) {
            eventsBuffer.shift();
          }
        }
        const currentBuffer = eventsBuffer[eventsBuffer.length - 1];
        if (currentBuffer) {
          currentBuffer.push(event);
        }
      },
      checkoutEveryNms: config.checkoutInterval,
      maskAllInputs: config.maskInputs,
      blockSelector: config.blockSelectors.join(', ') || undefined,
      maskTextSelector: config.maskSelectors.join(', ') || undefined,
      sampling: config.sampling,
      // Privacy: don't record cross-origin iframes
      recordCrossOriginIframes: false,
      // Collect fonts for accurate replay
      collectFonts: true,
      // Inline styles for self-contained replay
      inlineStylesheet: true,
      // Inline images as base64 (careful with size)
      inlineImages: false,
    };

    stopFn = record(recordOptions) ?? null;
    config.onStart();
  } catch (error) {
    currentState = 'error';
    const err = error instanceof Error ? error : new Error(String(error));
    config.onError(err);
    throw err;
  }
}

/**
 * Stop session recording and return captured data
 */
export function stopSessionReplay(): SessionReplayData | null {
  if (currentState !== 'recording' || !stopFn) {
    console.warn('Session replay is not recording');
    return null;
  }

  stopFn();
  stopFn = null;
  currentState = 'idle';

  const endTime = Date.now();
  const events = eventsBuffer.flat();
  const eventsJson = JSON.stringify(events);

  const data: SessionReplayData = {
    events,
    startTime: recordingStartTime ?? endTime,
    endTime,
    duration: endTime - (recordingStartTime ?? endTime),
    sizeBytes: new Blob([eventsJson]).size,
    eventCount: events.length,
  };

  config.onStop();
  recordingStartTime = null;
  eventsBuffer = [[]];

  return data;
}

/**
 * Get current session replay data without stopping
 */
export function getSessionReplaySnapshot(): SessionReplayData | null {
  if (currentState !== 'recording') {
    return null;
  }

  const now = Date.now();
  const events = eventsBuffer.flat();
  const eventsJson = JSON.stringify(events);

  return {
    events,
    startTime: recordingStartTime ?? now,
    endTime: now,
    duration: now - (recordingStartTime ?? now),
    sizeBytes: new Blob([eventsJson]).size,
    eventCount: events.length,
  };
}

/**
 * Check if session replay is currently recording
 */
export function isRecording(): boolean {
  return currentState === 'recording';
}

/**
 * Get current recording state
 */
export function getRecordingState(): ReplayState {
  return currentState;
}

/**
 * Compress events data for transmission
 * Uses browser's built-in CompressionStream if available
 */
export async function compressReplayData(
  data: SessionReplayData
): Promise<Blob> {
  const jsonString = JSON.stringify(data.events);
  const blob = new Blob([jsonString], { type: 'application/json' });

  // Check for CompressionStream support
  if (typeof CompressionStream !== 'undefined') {
    const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
    return new Response(stream).blob();
  }

  // Fallback: return uncompressed
  return blob;
}

/**
 * Create a replay player URL (for debugging)
 * Encodes events as base64 in URL hash
 */
export function createReplayUrl(data: SessionReplayData): string {
  const eventsJson = JSON.stringify(data.events);

  // For small replays, encode in URL
  if (eventsJson.length < 50000) {
    const encoded = btoa(encodeURIComponent(eventsJson));
    return `https://rrweb.io/player?events=${encoded}`;
  }

  // For larger replays, suggest using the player separately
  return 'https://rrweb.io/player (events too large for URL)';
}

/**
 * Estimate quality score based on captured data
 */
export function calculateReplayQualityScore(data: SessionReplayData): {
  score: number;
  factors: Record<string, { value: number; weight: number }>;
} {
  const factors: Record<string, { value: number; weight: number }> = {
    hasFullSnapshot: {
      value: data.events.some((e) => e.type === 2) ? 100 : 0, // type 2 = FullSnapshot
      weight: 0.3,
    },
    hasMutations: {
      value: data.events.some((e) => e.type === 3) ? 100 : 50, // type 3 = IncrementalSnapshot
      weight: 0.2,
    },
    hasUserInteractions: {
      value:
        data.events.filter(
          (e) =>
            e.type === 3 &&
            (e.data as { source?: number }).source !== undefined &&
            [1, 2, 5].includes((e.data as { source: number }).source) // MouseInteraction, Scroll, Input
        ).length > 0
          ? 100
          : 30,
      weight: 0.25,
    },
    duration: {
      value: Math.min(100, (data.duration / 5000) * 100), // 5+ seconds = full score
      weight: 0.15,
    },
    eventDensity: {
      value: Math.min(100, (data.eventCount / 50) * 100), // 50+ events = full score
      weight: 0.1,
    },
  };

  const score = Object.values(factors).reduce(
    (sum, f) => sum + f.value * f.weight,
    0
  );

  return { score: Math.round(score), factors };
}

// Export types
export type { eventWithTime } from 'rrweb';
