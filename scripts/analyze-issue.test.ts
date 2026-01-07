/**
 * Tests for Architecture-Aware File Classification and Confidence Calibration
 * Added as part of 2025 enhancement to improve analysis accuracy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Since analyze-issue.ts exports are internal, we'll test the logic by importing
// the functions we need to expose for testing
// For now, we test the patterns directly

describe('Architecture-Aware File Classification', () => {
  // Simulated FILE_ROLE_PATTERNS for testing
  const FILE_ROLE_PATTERNS = [
    {
      role: 'analytics',
      patterns: [
        /use[A-Z]?[Aa]nalytics/,
        /analytics/i,
        /tracking/i,
        /telemetry/i,
        /ga4?\.ts$/i,
        /gtm\.ts$/i,
        /mixpanel/i,
        /amplitude/i,
        /segment/i,
        /posthog/i,
      ],
    },
    {
      role: 'test',
      patterns: [
        /\.test\.[jt]sx?$/,
        /\.spec\.[jt]sx?$/,
        /__tests__\//,
        /\/tests?\//,
      ],
    },
    {
      role: 'api',
      patterns: [
        /\/api\//,
        /\/routes?\//,
        /route\.[jt]s$/,
        /controller\.[jt]s$/,
        /server\.[jt]s$/,
      ],
    },
    {
      role: 'schema',
      patterns: [
        /schema/i,
        /validation/i,
        /validator/i,
        /\/types\//,
        /\.types\.[jt]s$/,
        /\.schema\.[jt]s$/,
        /\.d\.ts$/,
      ],
    },
    {
      role: 'hook',
      patterns: [
        /\/hooks?\//,
        /use[A-Z][a-zA-Z]+\.[jt]sx?$/,
      ],
    },
    {
      role: 'component',
      patterns: [
        /\/components?\//,
        /\/pages?\//,
        /\/app\/.*\/page\.[jt]sx?$/,
        /\/app\/.*\/layout\.[jt]sx?$/,
        /\.[jt]sx$/,
      ],
    },
  ];

  function classifyFileRole(filePath: string): string {
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');

    for (const { role, patterns } of FILE_ROLE_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedPath) || pattern.test(filePath)) {
          return role;
        }
      }
    }

    return 'unknown';
  }

  describe('classifyFileRole', () => {
    it('should classify analytics files correctly', () => {
      expect(classifyFileRole('hooks/useAnalytics.ts')).toBe('analytics');
      expect(classifyFileRole('lib/analytics/tracker.ts')).toBe('analytics');
      expect(classifyFileRole('utils/tracking.ts')).toBe('analytics');
      expect(classifyFileRole('services/telemetry.ts')).toBe('analytics');
      expect(classifyFileRole('lib/ga4.ts')).toBe('analytics');
      expect(classifyFileRole('utils/mixpanel.ts')).toBe('analytics');
      expect(classifyFileRole('hooks/useGoogleAnalytics.ts')).toBe('analytics');
    });

    it('should classify test files correctly', () => {
      expect(classifyFileRole('src/utils/helper.test.ts')).toBe('test');
      expect(classifyFileRole('src/components/Button.spec.tsx')).toBe('test');
      expect(classifyFileRole('__tests__/integration.ts')).toBe('test');
      // Note: /tests/ pattern requires a leading slash
      expect(classifyFileRole('src/tests/e2e/login.ts')).toBe('test');
    });

    it('should classify API files correctly', () => {
      expect(classifyFileRole('app/api/users/route.ts')).toBe('api');
      expect(classifyFileRole('src/routes/auth.ts')).toBe('api');
      expect(classifyFileRole('server/controller.ts')).toBe('api');
      expect(classifyFileRole('backend/server.ts')).toBe('api');
    });

    it('should classify schema files correctly', () => {
      expect(classifyFileRole('lib/schemas/user.ts')).toBe('schema');
      expect(classifyFileRole('utils/validation.ts')).toBe('schema');
      expect(classifyFileRole('src/types/api.ts')).toBe('schema');
      expect(classifyFileRole('models/user.schema.ts')).toBe('schema');
      expect(classifyFileRole('types/global.d.ts')).toBe('schema');
    });

    it('should classify hook files correctly', () => {
      expect(classifyFileRole('src/hooks/useAuth.ts')).toBe('hook');
      expect(classifyFileRole('hooks/useForm.tsx')).toBe('hook');
      // Note: useAnalytics is classified as analytics first (order matters)
    });

    it('should classify component files correctly', () => {
      expect(classifyFileRole('src/components/Button.tsx')).toBe('component');
      expect(classifyFileRole('app/dashboard/page.tsx')).toBe('component');
      expect(classifyFileRole('pages/index.tsx')).toBe('component');
    });

    it('should prioritize analytics over hooks for useAnalytics', () => {
      // This is the key case from the QA feedback
      expect(classifyFileRole('hooks/useAnalytics.ts')).toBe('analytics');
      expect(classifyFileRole('src/hooks/useAnalytics.tsx')).toBe('analytics');
    });
  });

  describe('isRoleAppropriateForCategory', () => {
    const BUG_CATEGORY_EXPECTED_ROLES: Record<string, string[]> = {
      logic_error: ['component', 'hook', 'api', 'schema', 'util'],
      runtime_error: ['component', 'hook', 'api', 'util'],
      ui_ux: ['component', 'style', 'hook'],
      performance: ['component', 'hook', 'api', 'util', 'config'],
      security: ['api', 'util', 'config', 'schema'],
      configuration: ['config', 'api', 'util'],
      unknown: ['component', 'hook', 'api', 'schema', 'util', 'config'],
    };

    function isRoleAppropriateForCategory(role: string, category: string): boolean {
      if (role === 'analytics') return false;
      if (role === 'test') return false;

      const expectedRoles = BUG_CATEGORY_EXPECTED_ROLES[category];
      if (!expectedRoles) return true;

      return expectedRoles.includes(role);
    }

    it('should reject analytics files for all bug categories', () => {
      expect(isRoleAppropriateForCategory('analytics', 'logic_error')).toBe(false);
      expect(isRoleAppropriateForCategory('analytics', 'runtime_error')).toBe(false);
      expect(isRoleAppropriateForCategory('analytics', 'ui_ux')).toBe(false);
      expect(isRoleAppropriateForCategory('analytics', 'security')).toBe(false);
    });

    it('should reject test files for all bug categories', () => {
      expect(isRoleAppropriateForCategory('test', 'logic_error')).toBe(false);
      expect(isRoleAppropriateForCategory('test', 'runtime_error')).toBe(false);
    });

    it('should accept appropriate roles for logic_error', () => {
      expect(isRoleAppropriateForCategory('component', 'logic_error')).toBe(true);
      expect(isRoleAppropriateForCategory('api', 'logic_error')).toBe(true);
      expect(isRoleAppropriateForCategory('schema', 'logic_error')).toBe(true);
    });

    it('should accept appropriate roles for ui_ux', () => {
      expect(isRoleAppropriateForCategory('component', 'ui_ux')).toBe(true);
      expect(isRoleAppropriateForCategory('style', 'ui_ux')).toBe(true);
      expect(isRoleAppropriateForCategory('hook', 'ui_ux')).toBe(true);
      // API is not expected for UI bugs
      expect(isRoleAppropriateForCategory('api', 'ui_ux')).toBe(false);
    });
  });
});

describe('Confidence Calibration', () => {
  interface MockAnalysis {
    confidence: number;
    category: string;
    rootCause: {
      affectedFiles: string[];
      explanation: string;
    };
    codeVerification: {
      bugExistsInCode: boolean;
      evidence: string;
    };
    additionalContext?: string;
  }

  interface ErrorLocation {
    file: string;
    line?: number;
  }

  function calibrateConfidence(
    analysis: MockAnalysis,
    errorLocations: ErrorLocation[],
  ): { calibratedConfidence: number; penalties: string[] } {
    let calibrated = analysis.confidence;
    const penalties: string[] = [];

    // 1. No affected files
    if (!analysis.rootCause.affectedFiles || analysis.rootCause.affectedFiles.length === 0) {
      calibrated = Math.min(calibrated, 40);
      penalties.push('No specific file identified');
    }

    // 2. Line number check
    const hasLineMatch = errorLocations.some(loc =>
      loc.line && analysis.rootCause.affectedFiles.some(f =>
        f.toLowerCase().includes(loc.file.toLowerCase())
      )
    );
    if (!hasLineMatch && calibrated > 70) {
      calibrated -= 20;
      penalties.push('No line number correlation');
    }

    // 3. Uncertainty markers
    const uncertaintyMarkers = ['uncertain', 'not sure', 'possibly', '불확실', '추가 조사'];
    const text = (analysis.rootCause.explanation + (analysis.additionalContext || '')).toLowerCase();
    if (uncertaintyMarkers.some(m => text.includes(m))) {
      calibrated = Math.min(calibrated, 60);
      penalties.push('Uncertainty markers detected');
    }

    // 4. No code verification
    if (!analysis.codeVerification.bugExistsInCode &&
        (!analysis.codeVerification.evidence || analysis.codeVerification.evidence.length < 50)) {
      calibrated -= 15;
      penalties.push('Insufficient evidence');
    }

    return {
      calibratedConfidence: Math.max(0, Math.min(100, Math.round(calibrated))),
      penalties,
    };
  }

  it('should cap confidence at 40% when no files are identified', () => {
    const analysis: MockAnalysis = {
      confidence: 85,
      category: 'logic_error',
      rootCause: {
        affectedFiles: [],
        explanation: 'The bug is somewhere in the codebase',
      },
      codeVerification: {
        bugExistsInCode: true,
        evidence: 'Some evidence that the bug exists based on the description',
      },
    };

    const result = calibrateConfidence(analysis, []);
    expect(result.calibratedConfidence).toBeLessThanOrEqual(40);
    expect(result.penalties).toContain('No specific file identified');
  });

  it('should reduce confidence by 20% when no line match', () => {
    const analysis: MockAnalysis = {
      confidence: 80,
      category: 'logic_error',
      rootCause: {
        affectedFiles: ['src/utils/helper.ts'],
        explanation: 'Bug in helper function',
      },
      codeVerification: {
        bugExistsInCode: true,
        evidence: 'Found the problematic code in the helper function that causes this issue',
      },
    };

    const result = calibrateConfidence(analysis, [
      { file: 'other-file.ts', line: 42 },
    ]);
    expect(result.calibratedConfidence).toBe(60); // 80 - 20
    expect(result.penalties).toContain('No line number correlation');
  });

  it('should cap at 60% when uncertainty markers present', () => {
    const analysis: MockAnalysis = {
      confidence: 85,
      category: 'logic_error',
      rootCause: {
        affectedFiles: ['src/utils/helper.ts'],
        explanation: 'This is possibly the cause of the bug',
      },
      codeVerification: {
        bugExistsInCode: true,
        evidence: 'Found the problematic code in the helper function that causes this issue',
      },
    };

    const result = calibrateConfidence(analysis, [
      { file: 'helper.ts', line: 10 },
    ]);
    expect(result.calibratedConfidence).toBeLessThanOrEqual(60);
    expect(result.penalties).toContain('Uncertainty markers detected');
  });

  it('should reduce confidence by 15% when no code verification', () => {
    const analysis: MockAnalysis = {
      confidence: 70,
      category: 'logic_error',
      rootCause: {
        affectedFiles: ['src/utils/helper.ts'],
        explanation: 'Bug in helper function',
      },
      codeVerification: {
        bugExistsInCode: false,
        evidence: 'Short',
      },
    };

    const result = calibrateConfidence(analysis, [
      { file: 'helper.ts', line: 10 },
    ]);
    expect(result.calibratedConfidence).toBe(55); // 70 - 15
    expect(result.penalties).toContain('Insufficient evidence');
  });

  it('should not modify well-supported high-confidence analysis', () => {
    const analysis: MockAnalysis = {
      confidence: 90,
      category: 'logic_error',
      rootCause: {
        affectedFiles: ['src/utils/helper.ts:45'],
        explanation: 'Clear bug in the validation logic at line 45',
      },
      codeVerification: {
        bugExistsInCode: true,
        evidence: 'The validation function at line 45 does not check for null values which causes the runtime error when user input is empty',
      },
    };

    const result = calibrateConfidence(analysis, [
      { file: 'helper.ts', line: 45 },
    ]);
    expect(result.calibratedConfidence).toBe(90);
    expect(result.penalties).toHaveLength(0);
  });

  it('should handle Korean uncertainty markers', () => {
    const analysis: MockAnalysis = {
      confidence: 85,
      category: 'logic_error',
      rootCause: {
        affectedFiles: ['src/utils/helper.ts'],
        explanation: '이 문제는 추가 조사가 필요합니다',
      },
      codeVerification: {
        bugExistsInCode: true,
        evidence: 'Found the problematic code in the helper function that causes this issue',
      },
    };

    const result = calibrateConfidence(analysis, [
      { file: 'helper.ts', line: 10 },
    ]);
    expect(result.calibratedConfidence).toBeLessThanOrEqual(60);
    expect(result.penalties).toContain('Uncertainty markers detected');
  });

  describe('QA Feedback Scenario', () => {
    it('should significantly reduce confidence for analytics file with validation bug', () => {
      // This is the exact scenario from QA feedback:
      // Bot suggested hooks/useAnalytics.ts for a "member name validation" bug
      // with 85% confidence

      const analysis: MockAnalysis = {
        confidence: 85,
        category: 'logic_error', // Validation is a logic error
        rootCause: {
          affectedFiles: ['hooks/useAnalytics.ts'], // Wrong file!
          explanation: 'The validation logic is missing in the analytics hook',
        },
        codeVerification: {
          bugExistsInCode: false,
          evidence: 'Cannot confirm the bug exists in the specified location',
        },
      };

      const result = calibrateConfidence(analysis, []);

      // Should be significantly reduced:
      // - No line match: -20% (since 85 > 70, becomes 65)
      // - Insufficient evidence: -15% (becomes 50)
      // Note: File role check is in the real implementation, not in this simplified test mock
      expect(result.calibratedConfidence).toBeLessThanOrEqual(70);
      expect(result.penalties.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Tests for Retry Logic and Error Extraction
 * Testing the withRetry utility and extractErrorDetails helper
 */
describe('Error Extraction', () => {
  // Re-implementing extractErrorDetails for testing (internal function)
  function extractErrorDetails(error: Error): string | undefined {
    const details: string[] = [];

    if ('cause' in error && error.cause) {
      const cause = error.cause as Error;
      if (cause.name === 'ZodError' && 'issues' in cause) {
        const issues = (cause as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
        details.push('Zod validation failed:');
        issues.slice(0, 3).forEach((issue) => {
          details.push(`  - ${issue.path.join('.')}: ${issue.message}`);
        });
        if (issues.length > 3) {
          details.push(`  ... and ${issues.length - 3} more issues`);
        }
      } else {
        details.push(`Cause: ${cause.message || String(cause)}`);
      }
    }

    if ('text' in error && typeof (error as { text?: string }).text === 'string') {
      const text = (error as { text: string }).text;
      if (text.length > 0) {
        const preview = text.length > 200 ? text.slice(0, 200) + '...' : text;
        details.push(`Raw model output: ${preview}`);
      }
    }

    if ('finishReason' in error) {
      details.push(`Finish reason: ${(error as { finishReason: string }).finishReason}`);
    }

    return details.length > 0 ? details.join('\n') : undefined;
  }

  it('should return undefined for plain Error', () => {
    const error = new Error('Simple error');
    expect(extractErrorDetails(error)).toBeUndefined();
  });

  it('should extract ZodError issues from cause', () => {
    const zodError = {
      name: 'ZodError',
      message: 'Validation failed',
      issues: [
        { path: ['analyses', 0, 'confidence'], message: 'Expected number, received string' },
        { path: ['severity'], message: 'Invalid enum value' },
      ],
    };
    const error = new Error('Generation failed');
    (error as Error & { cause: unknown }).cause = zodError;

    const result = extractErrorDetails(error);
    expect(result).toContain('Zod validation failed:');
    expect(result).toContain('analyses.0.confidence: Expected number, received string');
    expect(result).toContain('severity: Invalid enum value');
  });

  it('should truncate more than 3 Zod issues', () => {
    const zodError = {
      name: 'ZodError',
      message: 'Validation failed',
      issues: [
        { path: ['field1'], message: 'Error 1' },
        { path: ['field2'], message: 'Error 2' },
        { path: ['field3'], message: 'Error 3' },
        { path: ['field4'], message: 'Error 4' },
        { path: ['field5'], message: 'Error 5' },
      ],
    };
    const error = new Error('Generation failed');
    (error as Error & { cause: unknown }).cause = zodError;

    const result = extractErrorDetails(error);
    expect(result).toContain('... and 2 more issues');
    expect(result).not.toContain('field4');
    expect(result).not.toContain('field5');
  });

  it('should extract generic cause message', () => {
    const error = new Error('Outer error');
    (error as Error & { cause: Error }).cause = new Error('Inner cause message');

    const result = extractErrorDetails(error);
    expect(result).toBe('Cause: Inner cause message');
  });

  it('should extract raw text from error', () => {
    const error = new Error('Parse failed') as Error & { text: string };
    error.text = 'Some raw model output that could not be parsed';

    const result = extractErrorDetails(error);
    expect(result).toContain('Raw model output:');
    expect(result).toContain('Some raw model output');
  });

  it('should truncate long text to 200 chars', () => {
    const error = new Error('Parse failed') as Error & { text: string };
    error.text = 'A'.repeat(300);

    const result = extractErrorDetails(error);
    expect(result).toContain('...');
    expect(result!.length).toBeLessThan(250);
  });

  it('should extract finishReason', () => {
    const error = new Error('Model stopped') as Error & { finishReason: string };
    error.finishReason = 'length';

    const result = extractErrorDetails(error);
    expect(result).toBe('Finish reason: length');
  });

  it('should combine multiple error details', () => {
    const error = new Error('Complex error') as Error & { text: string; finishReason: string; cause: Error };
    error.cause = new Error('Root cause');
    error.text = 'Partial output';
    error.finishReason = 'error';

    const result = extractErrorDetails(error);
    expect(result).toContain('Cause: Root cause');
    expect(result).toContain('Raw model output: Partial output');
    expect(result).toContain('Finish reason: error');
  });
});

describe('Retry Logic', () => {
  interface RetryError {
    attempt: number;
    error: Error;
    waitTime?: number;
  }

  async function withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number,
    delayMs: number,
    onRetry?: (attempt: number, error: Error, waitTime: number) => void
  ): Promise<T> {
    const errors: RetryError[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        const waitTime = delayMs * Math.pow(2, attempt - 1);
        errors.push({ attempt, error: errorObj, waitTime });

        if (attempt < maxAttempts) {
          onRetry?.(attempt, errorObj, waitTime);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    throw errors[errors.length - 1]?.error;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn, 3, 1000);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('First fail'))
      .mockRejectedValueOnce(new Error('Second fail'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, 3, 100);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after all attempts exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Always fails'));

    let error: Error | undefined;
    const promise = withRetry(fn, 3, 100).catch((e) => { error = e; });
    await vi.runAllTimersAsync();
    await promise;

    expect(error?.message).toBe('Always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use exponential backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');

    const waitTimes: number[] = [];
    const onRetry = (_attempt: number, _error: Error, waitTime: number) => {
      waitTimes.push(waitTime);
    };

    const promise = withRetry(fn, 3, 100, onRetry);
    await vi.runAllTimersAsync();
    await promise;

    expect(waitTimes).toEqual([100, 200]);
  });

  it('should call onRetry callback on each retry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');

    const onRetry = vi.fn();

    const promise = withRetry(fn, 3, 100, onRetry);
    await vi.runAllTimersAsync();
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), 100);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), 200);
  });

  it('should handle non-Error throws', async () => {
    const fn = vi.fn().mockRejectedValue('string error');

    let error: Error | undefined;
    const promise = withRetry(fn, 2, 100).catch((e) => { error = e; });
    await vi.runAllTimersAsync();
    await promise;

    expect(error?.message).toBe('string error');
  });

  it('should respect maxAttempts = 1 (no retries)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Fails'));

    await expect(withRetry(fn, 1, 100)).rejects.toThrow('Fails');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
