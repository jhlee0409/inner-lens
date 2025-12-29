import type { ReactNode } from 'react';

/**
 * AI Provider options for bug analysis
 */
export type AIProvider = 'anthropic' | 'openai' | 'google';

/**
 * Configuration for the InnerLens Widget
 */
export interface InnerLensConfig {
  /**
   * API endpoint to submit bug reports
   * @default '/api/inner-lens/report'
   */
  endpoint?: string;

  /**
   * GitHub repository in format "owner/repo"
   * Required for creating issues
   */
  repository?: string;

  /**
   * Custom labels to add to created issues
   * @default ['bug', 'inner-lens']
   */
  labels?: string[];

  /**
   * Enable/disable console log capture
   * @default true
   */
  captureConsoleLogs?: boolean;

  /**
   * Maximum number of log entries to capture
   * @default 50
   */
  maxLogEntries?: number;

  /**
   * Enable/disable sensitive data masking
   * @default true
   */
  maskSensitiveData?: boolean;

  /**
   * Custom CSS styles for the widget
   */
  styles?: {
    buttonColor?: string;
    buttonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  };

  /**
   * Callback when report is successfully submitted
   */
  onSuccess?: (issueUrl?: string) => void;

  /**
   * Callback when report submission fails
   */
  onError?: (error: Error) => void;

  /**
   * Custom trigger element (replaces default button)
   */
  trigger?: ReactNode;

  /**
   * Disable the widget entirely
   * @default false
   */
  disabled?: boolean;

  /**
   * Only show widget in development environment (NODE_ENV !== 'production')
   * @default true
   */
  devOnly?: boolean;
}

/**
 * Captured log entry
 */
export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'log';
  message: string;
  timestamp: number;
  stack?: string;
}

/**
 * Bug report payload sent to the server
 */
export interface BugReportPayload {
  description: string;
  logs: LogEntry[];
  url: string;
  userAgent: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Server response from bug report submission
 */
export interface BugReportResponse {
  success: boolean;
  issueUrl?: string;
  issueNumber?: number;
  message?: string;
}

/**
 * GitHub Issue creation payload
 */
export interface GitHubIssuePayload {
  title: string;
  body: string;
  labels: string[];
  repository: string;
}
