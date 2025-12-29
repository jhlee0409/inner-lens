/**
 * Console Log Capture Utility
 * Hooks into console methods to capture error and warning logs
 */

import type { LogEntry } from '../types';
import { maskSensitiveData } from './masking';

type LogLevel = 'error' | 'warn' | 'info' | 'log';

interface LogCaptureOptions {
  maxEntries: number;
  maskSensitiveData: boolean;
}

// Store for captured logs
let capturedLogs: LogEntry[] = [];
let isInitialized = false;
let originalConsole: Pick<Console, 'error' | 'warn' | 'info' | 'log'> | null = null;
let captureOptions: LogCaptureOptions = {
  maxEntries: 50,
  maskSensitiveData: true,
};

/**
 * Formats console arguments into a string message
 */
function formatLogMessage(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}`;
      }
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

/**
 * Extracts stack trace if available
 */
function extractStack(args: unknown[]): string | undefined {
  for (const arg of args) {
    if (arg instanceof Error && arg.stack) {
      return arg.stack;
    }
  }
  return undefined;
}

/**
 * Creates a log entry from console arguments
 */
function createLogEntry(level: LogLevel, args: unknown[]): LogEntry {
  let message = formatLogMessage(args);
  let stack = extractStack(args);

  if (captureOptions.maskSensitiveData) {
    message = maskSensitiveData(message);
    if (stack) {
      stack = maskSensitiveData(stack);
    }
  }

  return {
    level,
    message,
    timestamp: Date.now(),
    stack,
  };
}

/**
 * Adds a log entry to the captured logs
 */
function addLogEntry(entry: LogEntry): void {
  capturedLogs.push(entry);

  // Keep only the most recent entries
  if (capturedLogs.length > captureOptions.maxEntries) {
    capturedLogs = capturedLogs.slice(-captureOptions.maxEntries);
  }
}

/**
 * Initializes log capture by hooking into console methods
 */
export function initLogCapture(options?: Partial<LogCaptureOptions>): void {
  if (typeof window === 'undefined') {
    // Skip in SSR
    return;
  }

  if (isInitialized) {
    // Already initialized, just update options
    if (options) {
      captureOptions = { ...captureOptions, ...options };
    }
    return;
  }

  if (options) {
    captureOptions = { ...captureOptions, ...options };
  }

  // Store original console methods
  originalConsole = {
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
    log: console.log.bind(console),
  };

  // Override console.error
  console.error = (...args: unknown[]) => {
    const entry = createLogEntry('error', args);
    addLogEntry(entry);
    originalConsole?.error(...args);
  };

  // Override console.warn
  console.warn = (...args: unknown[]) => {
    const entry = createLogEntry('warn', args);
    addLogEntry(entry);
    originalConsole?.warn(...args);
  };

  // Global error handler for uncaught errors
  window.addEventListener('error', (event) => {
    const entry = createLogEntry('error', [
      `Uncaught Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
    ]);
    if (event.error?.stack) {
      entry.stack = captureOptions.maskSensitiveData
        ? maskSensitiveData(event.error.stack)
        : event.error.stack;
    }
    addLogEntry(entry);
  });

  // Global handler for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    let message = 'Unhandled Promise Rejection';

    if (reason instanceof Error) {
      message = `Unhandled Promise Rejection: ${reason.message}`;
    } else if (typeof reason === 'string') {
      message = `Unhandled Promise Rejection: ${reason}`;
    } else {
      try {
        message = `Unhandled Promise Rejection: ${JSON.stringify(reason)}`;
      } catch {
        message = `Unhandled Promise Rejection: ${String(reason)}`;
      }
    }

    const entry = createLogEntry('error', [message]);
    if (reason instanceof Error && reason.stack) {
      entry.stack = captureOptions.maskSensitiveData
        ? maskSensitiveData(reason.stack)
        : reason.stack;
    }
    addLogEntry(entry);
  });

  isInitialized = true;
}

/**
 * Gets all captured logs
 */
export function getCapturedLogs(): LogEntry[] {
  return [...capturedLogs];
}

/**
 * Clears all captured logs
 */
export function clearCapturedLogs(): void {
  capturedLogs = [];
}

/**
 * Restores original console methods and removes listeners
 */
export function restoreConsole(): void {
  if (!isInitialized || !originalConsole) {
    return;
  }

  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.log = originalConsole.log;

  originalConsole = null;
  isInitialized = false;
}

/**
 * Manually adds a log entry (for custom integrations)
 */
export function addCustomLog(
  level: LogLevel,
  message: string,
  stack?: string
): void {
  const entry: LogEntry = {
    level,
    message: captureOptions.maskSensitiveData
      ? maskSensitiveData(message)
      : message,
    timestamp: Date.now(),
    stack: stack
      ? captureOptions.maskSensitiveData
        ? maskSensitiveData(stack)
        : stack
      : undefined,
  };
  addLogEntry(entry);
}
