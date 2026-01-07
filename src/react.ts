'use client';

/**
 * inner-lens React Module
 * React components and hooks for bug reporting
 *
 * @packageDocumentation
 *
 * @example
 * ```tsx
 * import { InnerLensWidget } from 'inner-lens/react';
 *
 * function App() {
 *   return (
 *     <div>
 *       <YourApp />
 *       <InnerLensWidget />
 *     </div>
 *   );
 * }
 * ```
 */

// Main Widget Component
export { InnerLensWidget } from './components/InnerLensWidget';

// Hook for programmatic control
export { useInnerLens } from './hooks/useInnerLens';

// Re-export types
export type {
  AIProvider,
  InnerLensConfig,
  LogEntry,
  BugReportPayload,
  BugReportResponse,
  GitHubIssuePayload,
  WidgetLanguage,
  Reporter,
  UserAction,
  UserActionType,
  NavigationEntry,
  NavigationType,
  PerformanceSummary,
  CoreWebVitals,
  PageContext,
} from './types';

// Re-export utilities
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
