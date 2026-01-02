---
name: generating-unit-tests
description: Generate Vitest unit tests following project conventions. Use when user asks to create tests, write test cases, or add test coverage for TypeScript functions.
allowed-tools: [Read, Write, Bash, Grep, Glob, Edit]
---

# Unit Test Generation for inner-lens

Generate comprehensive unit tests for TypeScript functions using Vitest and the project's established patterns.

## Quick Reference

- **Test Framework**: Vitest with jsdom
- **File Naming**: `*.test.ts` alongside source files
- **Run Tests**: `npm run test` or `npm run test:watch`

## Core Workflow

1. Read the source file to understand the function(s) to test
2. Identify exported functions, their parameters, and return types
3. Generate test file with proper imports and describe blocks
4. Include tests for: happy path, edge cases, error handling, type safety

## Test File Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { functionName } from './source-file';

describe('functionName', () => {
  // Setup/teardown if needed
  beforeEach(() => {
    // Reset state
  });

  afterEach(() => {
    // Cleanup
  });

  it('returns expected result for valid input', () => {
    const result = functionName(validInput);
    expect(result).toBe(expected);
  });

  it('handles edge case: empty input', () => {
    expect(functionName('')).toBe(expectedForEmpty);
  });

  it('handles null/undefined gracefully', () => {
    expect(functionName(null as unknown as string)).toBeNull();
  });
});
```

## Test Categories (Always Include)

### 1. Happy Path
Test normal, expected usage with valid inputs.

### 2. Edge Cases
- Empty strings, arrays, objects
- Boundary values (0, -1, MAX_INT)
- Single-element collections

### 3. Error Handling
- Invalid input types
- Missing required parameters
- Malformed data

### 4. Type Safety
Use TypeScript assertions for strict typing:
```typescript
// For functions that narrow types
if (result.success) {
  expect(result.data.field).toBeDefined();
}
```

## Project-Specific Patterns

### Testing Masking Functions
```typescript
it('masks [pattern_name]', () => {
  expect(maskSensitiveData('input with secret')).toBe(
    'input with [REDACTED_LABEL]'
  );
});

it('preserves non-sensitive text', () => {
  const text = 'normal text without secrets';
  expect(maskSensitiveData(text)).toBe(text);
});
```

### Testing Validation Functions
```typescript
const validPayload = {
  // Complete valid fixture
};

it('validates correct payload', () => {
  const result = validateFunction(validPayload);
  expect(result.success).toBe(true);
});

it('rejects missing required field', () => {
  const { requiredField, ...rest } = validPayload;
  const result = validateFunction(rest);
  expect(result.success).toBe(false);
});
```

### Testing Async Functions
```typescript
it('resolves with expected data', async () => {
  const result = await asyncFunction(input);
  expect(result).toEqual(expected);
});

it('handles API errors gracefully', async () => {
  vi.mocked(dependency).mockRejectedValueOnce(new Error('API Error'));
  const result = await asyncFunction(input);
  expect(result.success).toBe(false);
});
```

## Mocking with Vitest

```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('./dependency', () => ({
  dependencyFunction: vi.fn(),
}));

// Mock implementation
vi.mocked(dependencyFunction).mockReturnValue(mockValue);

// Verify calls
expect(dependencyFunction).toHaveBeenCalledWith(expectedArgs);
```

## Detailed Patterns

For comprehensive testing patterns and examples, see:
- [references/test-patterns.md](references/test-patterns.md) - Complete testing patterns
- [templates/test-template.ts](templates/test-template.ts) - Starter template

## Checklist Before Completing

- [ ] All exported functions have tests
- [ ] Edge cases covered (empty, null, boundary)
- [ ] Error paths tested
- [ ] Async functions use async/await
- [ ] Mocks are properly reset in afterEach
- [ ] Test file runs: `npm run test -- path/to/file.test.ts`
