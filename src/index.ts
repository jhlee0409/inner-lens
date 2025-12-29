'use client';

/**
 * inner-lens
 * Self-Debugging QA Agent for Next.js
 *
 * @packageDocumentation
 */

// Main Widget Component
export { InnerLensWidget } from './components/InnerLensWidget';

// Types
export type {
  AIProvider,
  InnerLensConfig,
  LogEntry,
  BugReportPayload,
  BugReportResponse,
  GitHubIssuePayload,
} from './types';

// Utilities (for advanced usage)
export {
  initLogCapture,
  getCapturedLogs,
  clearCapturedLogs,
  addCustomLog,
  restoreConsole,
} from './utils/log-capture';

export {
  maskSensitiveData,
  maskSensitiveObject,
  validateMasking,
} from './utils/masking';
