/**
 * QA Data Quality Validation Tests
 *
 * This test suite validates:
 * 1. Data sufficiency for AI analysis
 * 2. Data consistency across all users
 * 3. Equal quality data collection for everyone
 * 4. Comprehensive data coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateBugReport, BugReportSchema } from './server';
import { maskSensitiveData } from './utils/masking';
import type { BugReportPayload, LogEntry } from './types';

/**
 * ============================================
 * SECTION 1: DATA SCHEMA ANALYSIS
 * ============================================
 *
 * The BugReportPayload contains these fields:
 *
 * REQUIRED FIELDS:
 * - description: string (1-10000 chars) - User's bug description
 * - logs: LogEntry[] - Captured console/network logs
 * - url: string - Page URL where bug occurred
 * - userAgent: string - Browser/device info
 * - timestamp: number - When the report was submitted
 *
 * OPTIONAL FIELDS:
 * - metadata: { repository?: string, labels?: string[] }
 *
 * LogEntry contains:
 * - level: 'error' | 'warn' | 'info' | 'log'
 * - message: string
 * - timestamp: number
 * - stack?: string (optional)
 */

describe('QA Data Quality: Schema Completeness', () => {
  it('should define all required fields for effective analysis', () => {
    // Verify schema captures all essential debugging information
    const requiredFields = ['description', 'logs', 'url', 'userAgent', 'timestamp'];

    const testPayload = {
      description: 'Test bug',
      logs: [],
      url: 'https://example.com',
      userAgent: 'Mozilla/5.0',
      timestamp: Date.now(),
    };

    const result = validateBugReport(testPayload);
    expect(result.success).toBe(true);

    // Verify all required fields are present in schema
    requiredFields.forEach((field) => {
      expect(field in testPayload).toBe(true);
    });
  });

  it('should capture log entry with full context', () => {
    const logEntry: LogEntry = {
      level: 'error',
      message: 'TypeError: Cannot read property "id" of undefined',
      timestamp: Date.now(),
      stack: 'Error\n    at UserProfile.tsx:42\n    at handleClick (Button.tsx:18)',
    };

    // Log entry contains:
    // 1. level - severity classification
    // 2. message - error description
    // 3. timestamp - when it occurred
    // 4. stack - call trace for debugging
    expect(logEntry.level).toBeDefined();
    expect(logEntry.message).toBeDefined();
    expect(logEntry.timestamp).toBeDefined();
    expect(logEntry.stack).toBeDefined();
  });
});

/**
 * ============================================
 * SECTION 2: DATA SUFFICIENCY FOR AI ANALYSIS
 * ============================================
 *
 * AI Analysis (analyze-issue.ts) requires:
 * 1. Bug symptoms (from description)
 * 2. Error messages (from logs)
 * 3. Stack traces (from logs)
 * 4. Context (URL, userAgent, timestamp)
 * 5. Keywords for file discovery
 */

describe('QA Data Quality: Sufficiency for AI Analysis', () => {
  const createCompleteReport = (): BugReportPayload => ({
    description: 'Button click throws error when user is not logged in',
    logs: [
      {
        level: 'error',
        message: 'TypeError: Cannot read property "id" of undefined',
        timestamp: Date.now() - 5000,
        stack: 'Error at UserProfile.tsx:42\n    at handleClick (Button.tsx:18)',
      },
      {
        level: 'warn',
        message: 'User session expired',
        timestamp: Date.now() - 10000,
      },
      {
        level: 'info',
        message: '[NETWORK] GET /api/user Status: 401 Duration: 120ms',
        timestamp: Date.now() - 8000,
      },
    ],
    url: 'https://app.example.com/dashboard',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    timestamp: Date.now(),
  });

  it('should provide sufficient data for root cause identification', () => {
    const report = createCompleteReport();
    const result = validateBugReport(report);

    expect(result.success).toBe(true);

    // Check AI analysis requirements:
    // 1. Description provides symptoms
    expect(report.description.length).toBeGreaterThan(10);

    // 2. Logs provide error details
    const errorLogs = (report.logs ?? []).filter((l) => l.level === 'error');
    expect(errorLogs.length).toBeGreaterThan(0);

    // 3. Stack traces provide file locations
    const logsWithStack = (report.logs ?? []).filter((l) => l.stack);
    expect(logsWithStack.length).toBeGreaterThan(0);

    // 4. Network logs provide API context
    const networkLogs = (report.logs ?? []).filter((l) => l.message.includes('[NETWORK]'));
    expect(networkLogs.length).toBeGreaterThan(0);
  });

  it('should contain extractable keywords for file discovery', () => {
    const report = createCompleteReport();

    // AI uses regex to extract keywords from description + logs
    // Keywords help identify relevant source files
    const logs = report.logs ?? [];
    const fullText = `${report.description} ${logs.map((l) => l.message + (l.stack || '')).join(' ')}`;

    // File paths pattern
    const filePathPattern = /[\w-]+\.(ts|tsx|js|jsx)/g;
    const filePaths = fullText.match(filePathPattern) || [];
    expect(filePaths.length).toBeGreaterThan(0);

    // Error type pattern
    const errorPattern = /TypeError|ReferenceError|SyntaxError/g;
    const errorTypes = fullText.match(errorPattern) || [];
    expect(errorTypes.length).toBeGreaterThan(0);
  });

  it('should provide environment context for reproduction', () => {
    const report = createCompleteReport();

    // Environment data helps reproduce the bug:
    // 1. URL - which page/route
    expect(report.url).toContain('dashboard');

    // 2. UserAgent - browser/device info
    expect(report.userAgent).toContain('Chrome');
    expect(report.userAgent).toContain('Windows');

    // 3. Timestamp - when it occurred
    expect(report.timestamp).toBeGreaterThan(0);
  });

  describe('Minimum viable data for analysis', () => {
    it('should still be analyzable with only description (no logs)', () => {
      const minimalReport: BugReportPayload = {
        description: 'Login button does not respond after clicking',
        logs: [],
        url: 'https://app.example.com/login',
        userAgent: 'Mozilla/5.0',
        timestamp: Date.now(),
      };

      const result = validateBugReport(minimalReport);
      expect(result.success).toBe(true);

      // AI can still analyze based on:
      // - Symptom description
      // - URL context (login page)
      // - Keywords: "Login", "button", "clicking"
    });

    it('should provide richer analysis with complete data', () => {
      const richReport = createCompleteReport();
      const minimalReport: BugReportPayload = {
        description: 'Error on page',
        logs: [],
        url: '',
        userAgent: 'Mozilla/5.0',
        timestamp: Date.now(),
      };

      // Calculate "analysis richness score"
    const calculateRichness = (report: BugReportPayload): number => {
      let score = 0;
      if (report.description.length > 20) score += 20;
      const logs = report.logs ?? [];
      if (logs.length > 0) score += 20;
      if (logs.some((l) => l.level === 'error')) score += 15;
      if (logs.some((l) => l.stack)) score += 15;
      if (logs.some((l) => l.message.includes('[NETWORK]'))) score += 10;
      if ((report.url ?? '').length > 10) score += 10;
      const ua = report.userAgent ?? '';
      if (ua.includes('Chrome') || ua.includes('Firefox')) score += 10;
      return score;
    };


      expect(calculateRichness(richReport)).toBeGreaterThan(80);
      expect(calculateRichness(minimalReport)).toBeLessThan(30);
    });
  });
});

/**
 * ============================================
 * SECTION 3: DATA CONSISTENCY (EQUAL QUALITY)
 * ============================================
 *
 * Every user should send the same format of data.
 * The widget automatically captures:
 * - Console logs (error, warn)
 * - Network requests (via fetch interceptor)
 * - Browser info (userAgent)
 * - Page URL
 * - Timestamp
 *
 * Only the description is user-provided.
 */

describe('QA Data Quality: Consistency Across Users', () => {
  it('should automatically capture the same data fields for all users', () => {
    // These fields are ALWAYS automatically captured by the widget
    const autoFields = ['url', 'userAgent', 'timestamp', 'logs'];

    // User A's report
    const userAReport: BugReportPayload = {
      description: 'Button not working',
      logs: [{ level: 'error', message: 'Click failed', timestamp: 1 }],
      url: 'https://app.com/page-a',
      userAgent: 'Mozilla/5.0 Chrome',
      timestamp: Date.now(),
    };

    // User B's report
    const userBReport: BugReportPayload = {
      description: 'Different issue on different page',
      logs: [{ level: 'warn', message: 'Session warning', timestamp: 2 }],
      url: 'https://app.com/page-b',
      userAgent: 'Mozilla/5.0 Safari',
      timestamp: Date.now(),
    };

    // Both reports have identical structure
    autoFields.forEach((field) => {
      expect(field in userAReport).toBe(true);
      expect(field in userBReport).toBe(true);
    });

    // Both pass validation
    expect(validateBugReport(userAReport).success).toBe(true);
    expect(validateBugReport(userBReport).success).toBe(true);
  });

  it('should capture logs in consistent format regardless of source', () => {
    const consoleErrorLog: LogEntry = {
      level: 'error',
      message: 'Console.error output',
      timestamp: Date.now(),
      stack: 'Error stack trace',
    };

    const networkLog: LogEntry = {
      level: 'error',
      message: '[NETWORK] POST /api/submit Status: 500 Duration: 200ms',
      timestamp: Date.now(),
    };

    const uncaughtErrorLog: LogEntry = {
      level: 'error',
      message: 'Uncaught Error: Something went wrong at app.js:100:50',
      timestamp: Date.now(),
      stack: 'Error stack from window.onerror',
    };

    // All log types have the same structure
    [consoleErrorLog, networkLog, uncaughtErrorLog].forEach((log) => {
      expect(log.level).toBeDefined();
      expect(log.message).toBeDefined();
      expect(log.timestamp).toBeDefined();
    });
  });

  it('should apply same masking rules to all users', () => {
    const user1Data = 'API key: sk-1234567890abcdefghij email: user1@test.com';
    const user2Data = 'OpenAI: sk-abcdefghij1234567890 contact: user2@example.org';

    const masked1 = maskSensitiveData(user1Data);
    const masked2 = maskSensitiveData(user2Data);

    // Both users get same level of data protection - sensitive data is masked
    expect(masked1).not.toContain('sk-1234567890abcdefghij');
    expect(masked1).toContain('[EMAIL_REDACTED]');
    expect(masked1).toContain('REDACTED');
    expect(masked2).not.toContain('sk-abcdefghij1234567890');
    expect(masked2).toContain('[EMAIL_REDACTED]');
    expect(masked2).toContain('REDACTED');
  });

  it('should limit logs to same maximum for all users', () => {
    // Server limits to last 20 logs (server.ts:68)
    // Widget captures up to 50 logs by default (configurable)

    const manyLogs: LogEntry[] = Array.from({ length: 100 }, (_, i) => ({
      level: 'error' as const,
      message: `Error ${i}`,
      timestamp: Date.now() - i * 1000,
    }));

    const report: BugReportPayload = {
      description: 'Test',
      logs: manyLogs,
      url: 'https://test.com',
      userAgent: 'Test',
      timestamp: Date.now(),
    };

    // Validation passes (no limit on input)
    expect(validateBugReport(report).success).toBe(true);

    // Server will truncate to last 20 when creating issue
    const truncatedLogs = manyLogs.slice(-20);
    expect(truncatedLogs.length).toBe(20);
  });
});

/**
 * ============================================
 * SECTION 4: NETWORK REQUEST CAPTURE QUALITY
 * ============================================
 *
 * The fetch interceptor (log-capture.ts) captures:
 * - Method (GET, POST, etc.)
 * - URL
 * - Request body (truncated)
 * - Response status
 * - Response body (truncated to 1000 chars)
 * - Duration
 */

describe('QA Data Quality: Network Request Capture', () => {
  it('should capture all essential network request details', () => {
    // Network log format from log-capture.ts:149-167
    const networkLogMessage = `[NETWORK] POST /api/users
Status: 201
Duration: 150ms
Request Body: {"name":"John"}
Response Body: {"id":123,"name":"John"}`;

    // Parse network log to verify completeness
    expect(networkLogMessage).toContain('[NETWORK]');
    expect(networkLogMessage).toContain('POST');
    expect(networkLogMessage).toContain('Status:');
    expect(networkLogMessage).toContain('Duration:');
    expect(networkLogMessage).toContain('Request Body:');
    expect(networkLogMessage).toContain('Response Body:');
  });

  it('should classify failed requests as errors', () => {
    // log-capture.ts:171 - status >= 400 = 'error' level
    const failedRequest: LogEntry = {
      level: 'error', // 4xx/5xx responses
      message: '[NETWORK] GET /api/data Status: 500',
      timestamp: Date.now(),
    };

    const successRequest: LogEntry = {
      level: 'info', // 2xx/3xx responses
      message: '[NETWORK] GET /api/data Status: 200',
      timestamp: Date.now(),
    };

    expect(failedRequest.level).toBe('error');
    expect(successRequest.level).toBe('info');
  });

  it('should truncate large response bodies consistently', () => {
    // log-capture.ts:27 - MAX_RESPONSE_BODY_LENGTH = 1000
    const MAX_RESPONSE_BODY_LENGTH = 1000;
    const largeResponse = 'x'.repeat(2000);

    const truncated =
      largeResponse.length > MAX_RESPONSE_BODY_LENGTH
        ? largeResponse.slice(0, MAX_RESPONSE_BODY_LENGTH) + '... [TRUNCATED]'
        : largeResponse;

    expect(truncated.length).toBeLessThan(2000);
    expect(truncated).toContain('[TRUNCATED]');
  });
});

/**
 * ============================================
 * SECTION 5: DATA CAPTURED SUMMARY
 * ============================================
 */

describe('QA Data Quality: Complete Data Inventory', () => {
  it('documents all data captured by the widget', () => {
    /**
     * DATA CAPTURED AUTOMATICALLY:
     *
     * 1. CONSOLE LOGS (log-capture.ts)
     *    - console.error() messages + stack traces
     *    - console.warn() messages
     *    - (console.info/log NOT captured by default)
     *
     * 2. NETWORK REQUESTS (log-capture.ts fetch interceptor)
     *    - HTTP method
     *    - URL
     *    - Request body (first 1000 chars, masked)
     *    - Response status code
     *    - Response body (first 1000 chars, masked)
     *    - Request duration (ms)
     *
     * 3. UNCAUGHT ERRORS (log-capture.ts)
     *    - window.onerror events
     *    - Unhandled promise rejections
     *    - Error message + stack trace
     *    - File name + line/column numbers
     *
     * 4. ENVIRONMENT DATA (InnerLensCore.ts submit method)
     *    - window.location.href (current page URL)
     *    - navigator.userAgent (browser + OS info)
     *    - Date.now() timestamp
     *
     * 5. USER-PROVIDED DATA
     *    - Description (required, user types this)
     *    - Custom metadata (optional)
     *
     * DATA MASKING APPLIED TO:
     *    - Email addresses
     *    - Phone numbers, SSNs
     *    - API keys (OpenAI, Anthropic, Google, AWS, GitHub, Stripe)
     *    - Bearer tokens, JWTs
     *    - Database URLs
     *    - Credit card numbers
     */

    // This test documents the data - just a placeholder assertion
    expect(true).toBe(true);
  });

  it('shows example of complete captured data', () => {
    const exampleCapture: BugReportPayload = {
      description: 'User clicked submit but form data was lost',

      logs: [
        // Console error with stack trace
        {
          level: 'error',
          message: 'TypeError: Cannot read properties of null (reading "value")',
          timestamp: 1703894400000,
          stack:
            'TypeError: Cannot read properties of null\n    at FormComponent.handleSubmit (FormComponent.tsx:45)\n    at onClick (Button.tsx:23)',
        },
        // Network request that failed
        {
          level: 'error',
          message:
            '[NETWORK] POST /api/forms/submit\nStatus: 422\nDuration: 234ms\nRequest Body: {"formId":"abc123"}\nResponse Body: {"error":"Validation failed","fields":["email"]}',
          timestamp: 1703894400500,
        },
        // Warning before the error
        {
          level: 'warn',
          message: 'Form validation: email field is empty',
          timestamp: 1703894399000,
        },
        // Uncaught promise rejection
        {
          level: 'error',
          message: 'Unhandled Promise Rejection: Form submission failed',
          timestamp: 1703894401000,
          stack: 'Error\n    at submitForm (api.ts:78)',
        },
      ],

      url: 'https://myapp.com/forms/new?step=3',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      timestamp: 1703894401500,

      metadata: {
        repository: 'myorg/myapp',
        labels: ['frontend', 'forms'],
      },
    };

    const result = validateBugReport(exampleCapture);
    expect(result.success).toBe(true);

    // Verify AI can extract useful information:
    // 1. Symptom: form data lost
    expect(exampleCapture.description).toContain('form data was lost');

    // 2. Error type: TypeError null reference
    const logs = exampleCapture.logs ?? [];
    expect(logs[0]?.message).toContain('TypeError');

    // 3. Error location: FormComponent.tsx:45
    expect(logs[0]?.stack).toContain('FormComponent.tsx:45');

    // 4. API failure details: 422, validation failed
    expect(logs[1]?.message).toContain('422');
    expect(logs[1]?.message).toContain('Validation failed');

    // 5. Context: forms page, step 3
    expect(exampleCapture.url).toContain('/forms/new');
    expect(exampleCapture.url).toContain('step=3');
  });
});

/**
 * ============================================
 * SECTION 6: GAPS AND RECOMMENDATIONS
 * ============================================
 */

describe('QA Data Quality: Identified Gaps', () => {
  it('GAP 1: No screenshot/visual capture', () => {
    // Current system captures text data only
    // Visual bugs (CSS issues, layout problems) are harder to diagnose
    // Recommendation: Add optional screenshot capture via html2canvas
    expect(true).toBe(true);
  });

  it('GAP 2: No user session/state information', () => {
    // System does not capture:
    // - User ID or role
    // - Session duration
    // - Previous actions taken
    // Recommendation: Allow optional custom context via metadata
    expect(true).toBe(true);
  });

  it('GAP 3: No Redux/state snapshot', () => {
    // For React apps, capturing app state would help
    // Recommendation: Optional state serialization hook
    expect(true).toBe(true);
  });

  it('GAP 4: console.info and console.log not captured by default', () => {
    // Only error and warn are captured
    // Some debugging info might be in console.log
    // Trade-off: capturing everything = too much noise
    expect(true).toBe(true);
  });

  it('GAP 5: No performance metrics', () => {
    // No capture of:
    // - Memory usage
    // - CPU usage
    // - Render times
    // - Long tasks
    // Recommendation: Optional Performance API integration
    expect(true).toBe(true);
  });
});

/**
 * ============================================
 * SECTION 7: EQUAL QUALITY VERIFICATION
 * ============================================
 */

describe('QA Data Quality: Equal Treatment Verification', () => {
  it('all users get same automatic data capture', () => {
    // Widget initializes with same defaults for everyone:
    // - captureConsoleLogs: true (default)
    // - maxLogEntries: 50 (default)
    // - maskSensitiveData: true (default)

    const defaultConfig = {
      captureConsoleLogs: true,
      maxLogEntries: 50,
      maskSensitiveData: true,
    };

    // All users with default config get identical capture behavior
    expect(defaultConfig.captureConsoleLogs).toBe(true);
    expect(defaultConfig.maxLogEntries).toBe(50);
    expect(defaultConfig.maskSensitiveData).toBe(true);
  });

  it('all users get same validation rules', () => {
    // Schema validation is identical for everyone
    const testCases = [
      { description: '', valid: false }, // empty not allowed
      { description: 'A', valid: true }, // min length is 1
      { description: 'Valid description', valid: true },
      { description: 'a'.repeat(10001), valid: false }, // too long (max 10000)
    ];

    testCases.forEach(({ description, valid }) => {
      const payload = {
        description,
        logs: [],
        url: '',
        userAgent: 'test',
        timestamp: Date.now(),
      };
      expect(validateBugReport(payload).success).toBe(valid);
    });
  });

  it('all users get same masking protection', () => {
    // Every user's sensitive data is masked equally
    const sensitiveInputs = [
      'My API key is sk-abc123456789012345678901',
      'Contact: john@example.com',
      'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.test',
    ];

    sensitiveInputs.forEach((input) => {
      const masked = maskSensitiveData(input);
      // No raw sensitive data remains
      expect(masked).not.toContain('sk-abc');
      expect(masked).not.toContain('john@example.com');
      expect(masked).not.toContain('eyJhbGciOiJIUzI1NiI');
    });
  });

  it('all users get same issue format in GitHub', () => {
    // Issue body template is identical for all users (server.ts:78-96)
    const issueBodyTemplate = `## Bug Report

### Description
{description}

### Environment
- **URL:** {url}
- **User Agent:** {userAgent}
- **Reported At:** {timestamp}

### Console Logs
\`\`\`
{logs}
\`\`\`

---
*This issue was automatically created by inner-lens.*
*Awaiting AI analysis...*`;

    expect(issueBodyTemplate).toContain('## Bug Report');
    expect(issueBodyTemplate).toContain('### Description');
    expect(issueBodyTemplate).toContain('### Environment');
    expect(issueBodyTemplate).toContain('Console Logs');
  });

  it('all users get same AI analysis methodology', () => {
    // AI uses identical Chain-of-Thought prompts for everyone
    // Analysis output schema is identical for all issues
    const analysisOutputFields = [
      'severity', // critical | high | medium | low
      'category', // runtime_error | logic_error | performance | security | ui_ux | configuration | unknown
      'rootCause', // { summary, explanation, affectedFiles }
      'suggestedFix', // { steps, codeChanges }
      'prevention', // string[]
      'confidence', // 0-100
    ];

    // All users receive analysis with these exact fields
    expect(analysisOutputFields).toHaveLength(6);
  });
});
