import { describe, it, expect } from 'vitest';
import { validateBugReport, BugReportSchema } from './server';

describe('validateBugReport', () => {
  const validPayload = {
    description: 'Button click throws error',
    logs: [
      {
        level: 'error' as const,
        message: 'TypeError: Cannot read property of undefined',
        timestamp: Date.now(),
        stack: 'Error at line 42',
      },
    ],
    url: 'https://example.com/page',
    userAgent: 'Mozilla/5.0',
    timestamp: Date.now(),
  };

  it('validates a correct payload', () => {
    const result = validateBugReport(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe(validPayload.description);
    }
  });

  it('accepts payload with metadata', () => {
    const payload = {
      ...validPayload,
      metadata: {
        repository: 'owner/repo',
        labels: ['bug', 'urgent'],
      },
    };
    const result = validateBugReport(payload);
    expect(result.success).toBe(true);
  });

  it('accepts empty logs array', () => {
    const payload = { ...validPayload, logs: [] };
    const result = validateBugReport(payload);
    expect(result.success).toBe(true);
  });

  it('accepts empty url string', () => {
    const payload = { ...validPayload, url: '' };
    const result = validateBugReport(payload);
    expect(result.success).toBe(true);
  });

  it('rejects missing description', () => {
    const payload = { ...validPayload, description: undefined };
    const result = validateBugReport(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty description', () => {
    const payload = { ...validPayload, description: '' };
    const result = validateBugReport(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Description is required');
    }
  });

  it('rejects description over 10000 chars', () => {
    const payload = { ...validPayload, description: 'a'.repeat(10001) };
    const result = validateBugReport(payload);
    expect(result.success).toBe(false);
  });

  it('rejects invalid log level', () => {
    const payload = {
      ...validPayload,
      logs: [
        {
          level: 'debug' as 'error', // invalid level
          message: 'test',
          timestamp: Date.now(),
        },
      ],
    };
    const result = validateBugReport(payload);
    expect(result.success).toBe(false);
  });

  it('rejects invalid url format', () => {
    const payload = { ...validPayload, url: 'not-a-valid-url' };
    const result = validateBugReport(payload);
    expect(result.success).toBe(false);
  });

  it('rejects missing timestamp', () => {
    const { timestamp, ...rest } = validPayload;
    const result = validateBugReport(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing userAgent', () => {
    const { userAgent, ...rest } = validPayload;
    const result = validateBugReport(rest);
    expect(result.success).toBe(false);
  });

  it('rejects non-object payload', () => {
    expect(validateBugReport(null).success).toBe(false);
    expect(validateBugReport('string').success).toBe(false);
    expect(validateBugReport(123).success).toBe(false);
  });
});

describe('BugReportSchema', () => {
  it('parses valid log levels', () => {
    const levels = ['error', 'warn', 'info', 'log'] as const;
    for (const level of levels) {
      const result = BugReportSchema.safeParse({
        description: 'test',
        logs: [{ level, message: 'msg', timestamp: 123 }],
        url: '',
        userAgent: 'test',
        timestamp: 123,
      });
      expect(result.success).toBe(true);
    }
  });

  it('allows optional stack in logs', () => {
    const result = BugReportSchema.safeParse({
      description: 'test',
      logs: [
        { level: 'error', message: 'with stack', timestamp: 123, stack: 'trace' },
        { level: 'warn', message: 'no stack', timestamp: 123 },
      ],
      url: '',
      userAgent: 'test',
      timestamp: 123,
    });
    expect(result.success).toBe(true);
  });
});
