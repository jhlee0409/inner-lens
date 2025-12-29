/**
 * inner-lens/replay
 *
 * Session Replay module using rrweb
 * This is a separate export to allow tree-shaking
 *
 * @packageDocumentation
 */

export {
  startSessionReplay,
  stopSessionReplay,
  getSessionReplaySnapshot,
  isRecording,
  getRecordingState,
  compressReplayData,
  createReplayUrl,
  calculateReplayQualityScore,
  type SessionReplayConfig,
  type SessionReplayData,
  type eventWithTime,
} from './utils/session-replay';
