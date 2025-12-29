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
let originalFetch: typeof fetch | null = null;
let captureOptions: LogCaptureOptions = {
  maxEntries: 50,
  maskSensitiveData: true,
};

// Maximum characters for response body truncation
const MAX_RESPONSE_BODY_LENGTH = 1000;

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
 * Truncates a string to the specified length
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + '... [TRUNCATED]';
}

/**
 * Safely extracts the request body from fetch input
 */
function extractRequestBody(init?: RequestInit): string | undefined {
  if (!init?.body) {
    return undefined;
  }

  // Handle string body
  if (typeof init.body === 'string') {
    return init.body;
  }

  // Handle JSON-serializable objects (through body being stringified already)
  // URLSearchParams, FormData, Blob, ArrayBuffer are not captured for simplicity
  return undefined;
}

/**
 * Safely reads the response body as text
 */
async function safeReadResponseBody(response: Response): Promise<string> {
  try {
    // Clone to avoid consuming the original stream
    const clonedResponse = response.clone();
    const text = await clonedResponse.text();
    return truncateString(text, MAX_RESPONSE_BODY_LENGTH);
  } catch {
    return '[Unable to read response body]';
  }
}

/**
 * Creates a network log entry
 */
function createNetworkLogEntry(
  method: string,
  url: string,
  requestBody: string | undefined,
  status: number,
  responseBody: string,
  duration: number
): LogEntry {
  const parts: string[] = [
    `[NETWORK] ${method} ${url}`,
    `Status: ${status}`,
    `Duration: ${duration}ms`,
  ];

  if (requestBody) {
    let maskedRequestBody = captureOptions.maskSensitiveData
      ? maskSensitiveData(requestBody)
      : requestBody;
    maskedRequestBody = truncateString(maskedRequestBody, MAX_RESPONSE_BODY_LENGTH);
    parts.push(`Request Body: ${maskedRequestBody}`);
  }

  let maskedResponseBody = captureOptions.maskSensitiveData
    ? maskSensitiveData(responseBody)
    : responseBody;
  parts.push(`Response Body: ${maskedResponseBody}`);

  const message = parts.join('\n');

  return {
    level: status >= 400 ? 'error' : 'info',
    message,
    timestamp: Date.now(),
  };
}

/**
 * Creates an intercepted fetch function
 */
function createFetchInterceptor(): typeof fetch {
  return async function interceptedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const startTime = Date.now();

    // Extract request details
    let method = 'GET';
    let url: string;

    if (input instanceof Request) {
      method = input.method;
      url = input.url;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input;
    }

    if (init?.method) {
      method = init.method;
    }

    const requestBody = extractRequestBody(init);

    try {
      // Call original fetch
      const response = await originalFetch!(input, init);
      const duration = Date.now() - startTime;

      // Read response body (using clone to preserve original)
      const responseBody = await safeReadResponseBody(response);

      // Create and add log entry
      const entry = createNetworkLogEntry(
        method,
        url,
        requestBody,
        response.status,
        responseBody,
        duration
      );
      addLogEntry(entry);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log network errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const entry = createNetworkLogEntry(
        method,
        url,
        requestBody,
        0,
        `[Network Error: ${errorMessage}]`,
        duration
      );
      entry.level = 'error';
      addLogEntry(entry);

      // Re-throw to not break the app
      throw error;
    }
  };
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

  // Store original fetch and install interceptor
  if (typeof window.fetch === 'function') {
    originalFetch = window.fetch.bind(window);
    window.fetch = createFetchInterceptor();
  }

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
 * Restores original console methods, fetch, and removes listeners
 */
export function restoreConsole(): void {
  if (!isInitialized || !originalConsole) {
    return;
  }

  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.log = originalConsole.log;

  // Restore original fetch if it was intercepted
  if (originalFetch && typeof window !== 'undefined') {
    window.fetch = originalFetch;
    originalFetch = null;
  }

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
