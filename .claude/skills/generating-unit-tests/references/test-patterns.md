# Comprehensive Testing Patterns for inner-lens

This document contains detailed testing patterns extracted from the project's existing test files.

## Table of Contents

1. [Import Conventions](#import-conventions)
2. [Describe Block Organization](#describe-block-organization)
3. [Assertion Patterns](#assertion-patterns)
4. [Fixture Patterns](#fixture-patterns)
5. [Console/Log Testing](#consolelog-testing)
6. [Zod Schema Testing](#zod-schema-testing)
7. [Security Testing](#security-testing)

---

## Import Conventions

### Standard Imports
```typescript
import { describe, it, expect } from 'vitest';
```

### With Setup/Teardown
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
```

### With Mocking
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
```

### Import Source Under Test
```typescript
// Relative import from same directory
import { functionA, functionB } from './source-file';

// Import types separately
import type { TypeA, TypeB } from './types';
```

---

## Describe Block Organization

### Single Function
```typescript
describe('functionName', () => {
  it('description of behavior', () => {
    // test
  });
});
```

### Multiple Related Functions
```typescript
describe('maskSensitiveData', () => {
  it('masks email addresses', () => { /* ... */ });
  it('masks Bearer tokens', () => { /* ... */ });
});

describe('maskSensitiveObject', () => {
  it('masks nested object values', () => { /* ... */ });
});

describe('validateMasking', () => {
  it('returns true for safe text', () => { /* ... */ });
});
```

### Nested Describes for Complex Modules
```typescript
describe('log-capture', () => {
  beforeEach(() => {
    clearCapturedLogs();
    restoreConsole();
  });

  afterEach(() => {
    restoreConsole();
    clearCapturedLogs();
  });

  describe('initLogCapture', () => {
    it('hooks into console.error', () => { /* ... */ });
  });

  describe('getCapturedLogs', () => {
    it('returns empty array when no logs', () => { /* ... */ });
  });
});
```

---

## Assertion Patterns

### Equality
```typescript
expect(result).toBe(expected);           // Strict equality
expect(result).toEqual(expected);        // Deep equality
expect(result).not.toBe(unexpected);     // Negation
```

### Truthiness
```typescript
expect(result).toBe(true);
expect(result).toBe(false);
expect(result).toBeDefined();
expect(result).toBeUndefined();
expect(result).toBeNull();
```

### Strings
```typescript
expect(result).toContain('substring');
expect(result).not.toContain('excluded');
expect(result).toMatch(/regex/);
```

### Arrays
```typescript
expect(logs).toHaveLength(3);
expect(logs).toEqual([]);
expect(logs[0]!.level).toBe('error');    // Note the ! for strict index access
```

### Objects
```typescript
expect(masked.config.apiKey).toBe('[REDACTED]');
expect(result.data.description).toBe(validPayload.description);
```

### Type Narrowing in Tests
```typescript
const result = validateBugReport(validPayload);
expect(result.success).toBe(true);
if (result.success) {
  expect(result.data.description).toBe(validPayload.description);
}
```

---

## Fixture Patterns

### Complete Valid Fixture
```typescript
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
```

### Spread for Variations
```typescript
// Add optional field
const payloadWithMetadata = {
  ...validPayload,
  metadata: {
    repository: 'owner/repo',
    labels: ['bug', 'urgent'],
  },
};

// Remove required field
const { timestamp, ...payloadWithoutTimestamp } = validPayload;

// Override field
const emptyLogsPayload = { ...validPayload, logs: [] };
```

---

## Console/Log Testing

### Capture Console Output
```typescript
describe('log-capture', () => {
  beforeEach(() => {
    clearCapturedLogs();
    restoreConsole();
  });

  afterEach(() => {
    restoreConsole();
    clearCapturedLogs();
  });

  it('hooks into console.error', () => {
    initLogCapture();
    console.error('test error');

    const logs = getCapturedLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]!.level).toBe('error');
    expect(logs[0]!.message).toBe('test error');
  });
});
```

### Test Log Entry Structure
```typescript
it('captures Error objects with stack', () => {
  initLogCapture();
  const error = new Error('Test error');
  console.error(error);

  const logs = getCapturedLogs();
  expect(logs[0]!.message).toContain('Error: Test error');
  expect(logs[0]!.stack).toBeDefined();
});
```

---

## Zod Schema Testing

### Test All Valid Enum Values
```typescript
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
```

### Test Optional Fields
```typescript
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
```

### Test Validation Errors
```typescript
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
```

---

## Security Testing

### Test Sensitive Data Masking
```typescript
describe('maskSensitiveData', () => {
  it('masks email addresses', () => {
    expect(maskSensitiveData('Contact john@example.com')).toBe(
      'Contact [EMAIL_REDACTED]'
    );
  });

  it('masks multiple patterns in one string', () => {
    const input = 'User john@test.com with key sk-abcdefghij1234567890 failed';
    const result = maskSensitiveData(input);
    expect(result).toContain('[EMAIL_REDACTED]');
    expect(result).toContain('[OPENAI_KEY_REDACTED]');
    expect(result).not.toContain('john@test.com');
    expect(result).not.toContain('sk-');
  });

  it('preserves text without sensitive data', () => {
    const text = 'This is a normal log message without secrets';
    expect(maskSensitiveData(text)).toBe(text);
  });
});
```

### Test Masking Validation
```typescript
describe('validateMasking', () => {
  it('returns true for safe text', () => {
    expect(validateMasking('This is a normal log message')).toBe(true);
    expect(validateMasking('[EMAIL_REDACTED] sent a message')).toBe(true);
  });

  it('returns false for unmasked emails', () => {
    expect(validateMasking('Contact user@example.com')).toBe(false);
  });
});
```

---

## Common Anti-Patterns to Avoid

### Don't Use Magic Strings
```typescript
// Bad
expect(result).toBe('some magic value that appears nowhere else');

// Good
const EXPECTED_REDACTED = '[EMAIL_REDACTED]';
expect(result).toBe(EXPECTED_REDACTED);
```

### Don't Forget Type Assertions for Index Access
```typescript
// Bad (TypeScript error with noUncheckedIndexedAccess)
expect(logs[0].level).toBe('error');

// Good
expect(logs[0]!.level).toBe('error');
```

### Don't Skip Cleanup
```typescript
// Bad
describe('test', () => {
  it('modifies global state', () => {
    initLogCapture();
    // ... test runs but doesn't clean up
  });
});

// Good
describe('test', () => {
  afterEach(() => {
    restoreConsole();
    clearCapturedLogs();
  });

  it('modifies global state', () => {
    initLogCapture();
    // ... test runs and cleanup happens
  });
});
```
