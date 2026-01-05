import { eventWithTime } from 'rrweb';
export { eventWithTime } from 'rrweb';

/**
 * Session Replay Module using rrweb
 *
 * Provides consistent, framework-agnostic session recording
 * that captures DOM state regardless of console logging practices.
 */

/**
 * Session replay configuration options
 */
interface SessionReplayConfig {
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
interface SessionReplayData {
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
/**
 * Initialize and start session recording
 */
declare function startSessionReplay(userConfig?: SessionReplayConfig): Promise<void>;
/**
 * Stop session recording and return captured data
 */
declare function stopSessionReplay(): SessionReplayData | null;
/**
 * Get current session replay data without stopping
 */
declare function getSessionReplaySnapshot(): SessionReplayData | null;
/**
 * Check if session replay is currently recording
 */
declare function isRecording(): boolean;
/**
 * Get current recording state
 */
declare function getRecordingState(): ReplayState;
/**
 * Compress events data for transmission
 * Uses browser's built-in CompressionStream if available
 */
declare function compressReplayData(data: SessionReplayData): Promise<Blob>;
/**
 * Create a replay player URL (for debugging)
 * Encodes events as base64 in URL hash
 */
declare function createReplayUrl(data: SessionReplayData): string;
/**
 * Estimate quality score based on captured data
 */
declare function calculateReplayQualityScore(data: SessionReplayData): {
    score: number;
    factors: Record<string, {
        value: number;
        weight: number;
    }>;
};

export { type SessionReplayConfig, type SessionReplayData, calculateReplayQualityScore, compressReplayData, createReplayUrl, getRecordingState, getSessionReplaySnapshot, isRecording, startSessionReplay, stopSessionReplay };
