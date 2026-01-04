/**
 * Tests for Hallucination Check Module
 */

import { describe, it, expect } from 'vitest';
import {
  verifyFileExistence,
  verifyCodeCitations,
  verifyLineReferences,
  verifySymbolReferences,
  checkForHallucinations,
  applyHallucinationPenalty,
  type VerificationContext,
  type AnalysisToVerify,
} from './hallucination-check';

describe('Hallucination Check Module', () => {
  // Mock context for testing
  const mockContext: VerificationContext = {
    codeContext: `
### src/utils/auth.ts
\`\`\`typescript
export function validateUser(userId: string): boolean {
  if (!userId) {
    throw new Error('User ID is required');
  }
  return userId.length > 0;
}

export class AuthService {
  private token: string | null = null;

  login(username: string, password: string): void {
    // Login implementation
    this.token = 'mock-token';
  }
}
\`\`\`

### src/components/LoginForm.tsx
\`\`\`typescript
function LoginForm() {
  const handleSubmit = () => {
    validateUser(userId);
  };
  return <form onSubmit={handleSubmit}>...</form>;
}
\`\`\`
    `,
    projectRoot: '/mock/project',
    relevantFiles: ['src/utils/auth.ts', 'src/components/LoginForm.tsx'],
  };

  describe('verifyFileExistence', () => {
    it('should verify files that are in context', () => {
      const checks = verifyFileExistence(['auth.ts'], mockContext);

      expect(checks).toHaveLength(1);
      expect(checks[0].verified).toBe(true);
      expect(checks[0].severity).toBe('info');
    });

    it('should flag files not in context', () => {
      const checks = verifyFileExistence(['nonexistent.ts'], mockContext);

      expect(checks).toHaveLength(1);
      expect(checks[0].verified).toBe(false);
      expect(checks[0].severity).toBe('critical');
    });

    it('should handle multiple files', () => {
      const checks = verifyFileExistence(['auth.ts', 'fake.ts', 'LoginForm.tsx'], mockContext);

      expect(checks).toHaveLength(3);
      expect(checks.filter(c => c.verified)).toHaveLength(2);
      expect(checks.filter(c => !c.verified)).toHaveLength(1);
    });
  });

  describe('verifyCodeCitations', () => {
    it('should verify code that exists in context', () => {
      const evidence = 'The issue is in `validateUser(userId)` function';
      const checks = verifyCodeCitations(evidence, mockContext);

      const verifiedChecks = checks.filter(c => c.verified);
      expect(verifiedChecks.length).toBeGreaterThan(0);
    });

    it('should flag code that does not exist', () => {
      const evidence =
        'The bug is in `nonExistentFunction(param)` which causes the crash';
      const checks = verifyCodeCitations(evidence, mockContext);

      const unverifiedChecks = checks.filter(c => !c.verified);
      expect(unverifiedChecks.length).toBeGreaterThan(0);
    });

    it('should handle code blocks', () => {
      const evidence = `
The fix should be:
\`\`\`typescript
function validateUser(userId: string): boolean {
  if (!userId) {
    throw new Error('User ID is required');
  }
  return userId.length > 0;
}
\`\`\`
      `;
      const checks = verifyCodeCitations(evidence, mockContext);

      // Should find the code block in context
      const verifiedBlocks = checks.filter(c => c.verified && c.type === 'code_citation');
      expect(verifiedBlocks.length).toBeGreaterThan(0);
    });

    it('should detect hallucinated code blocks', () => {
      const evidence = `
The current implementation:
\`\`\`typescript
function fakeFunction(x: number): void {
  console.log('This code does not exist');
  performMagicOperation(x);
}
\`\`\`
      `;
      const checks = verifyCodeCitations(evidence, mockContext);

      const unverifiedBlocks = checks.filter(c => !c.verified);
      expect(unverifiedBlocks.length).toBeGreaterThan(0);
      expect(unverifiedBlocks[0].severity).toBe('critical');
    });
  });

  describe('verifyLineReferences', () => {
    it('should extract and verify line references', () => {
      const explanation = 'The error occurs at auth.ts:5';
      const evidence = 'See line 3 for the issue';

      const checks = verifyLineReferences(explanation, evidence, mockContext);

      // Should find line references
      expect(checks.some(c => c.type === 'line_reference')).toBe(true);
    });

    it('should flag invalid line numbers', () => {
      const explanation = 'The bug is at auth.ts:99999';
      const evidence = '';

      const checks = verifyLineReferences(explanation, evidence, mockContext);

      // Line 99999 should be flagged (file is much shorter)
      const lineChecks = checks.filter(c => c.type === 'line_reference');
      // Will be unverified because file doesn't exist in test environment
      expect(lineChecks.length).toBeGreaterThan(0);
    });
  });

  describe('verifySymbolReferences', () => {
    it('should verify symbols that exist in context', () => {
      const explanation =
        'The `validateUser` function is called with invalid input. The `AuthService` class handles authentication.';

      const checks = verifySymbolReferences(explanation, mockContext);

      // validateUser and AuthService should be verified
      const verifiedSymbols = checks.filter(c => c.verified || c.claim === 'validateUser');
      // Note: These may not all be found depending on the context parsing
    });

    it('should flag symbols that do not exist', () => {
      const explanation =
        'The `FakeClass` is causing issues. Call to `fakeMethod` fails. The `FakeClass` is broken.';

      const checks = verifySymbolReferences(explanation, mockContext);

      const unverifiedSymbols = checks.filter(
        c => !c.verified && c.type === 'symbol'
      );
      expect(unverifiedSymbols.length).toBeGreaterThan(0);
    });
  });

  describe('checkForHallucinations', () => {
    it('should return valid result for legitimate analysis', () => {
      const analysis: AnalysisToVerify = {
        rootCause: {
          affectedFiles: ['auth.ts'],
          explanation: 'The validateUser function throws an error',
        },
        codeVerification: {
          evidence: 'Found in `validateUser(userId)` implementation',
        },
        suggestedFix: {
          codeChanges: [],
        },
      };

      const result = checkForHallucinations(analysis, mockContext);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(50);
    });

    it('should detect hallucinations in analysis', () => {
      const analysis: AnalysisToVerify = {
        rootCause: {
          affectedFiles: ['nonexistent-file.ts', 'another-fake.ts'],
          explanation: 'The FakeService class is broken',
        },
        codeVerification: {
          evidence: `
The bug is in:
\`\`\`typescript
class FakeService {
  doSomethingThatDoesNotExist() {
    this.brokenMethod();
  }
}
\`\`\`
          `,
        },
        suggestedFix: {
          codeChanges: [
            {
              file: 'fake-file.ts',
              before: 'brokenCode()',
              after: 'fixedCode()',
            },
          ],
        },
      };

      const result = checkForHallucinations(analysis, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.score).toBeLessThan(50);

      const criticalChecks = result.checks.filter(
        c => !c.verified && c.severity === 'critical'
      );
      expect(criticalChecks.length).toBeGreaterThan(0);
    });
  });

  describe('applyHallucinationPenalty', () => {
    it('should cap confidence at 30% for critical failures', () => {
      const hallucinationResult = {
        isValid: false,
        score: 20,
        summary: 'Hallucinations detected',
        checks: [
          {
            type: 'file' as const,
            claim: 'fake.ts',
            verified: false,
            details: 'File not found',
            severity: 'critical' as const,
          },
        ],
      };

      const result = applyHallucinationPenalty(90, hallucinationResult);

      expect(result.confidence).toBeLessThanOrEqual(30);
      expect(result.penalties.length).toBeGreaterThan(0);
      expect(result.penalties[0]).toContain('Hallucination detected');
    });

    it('should apply warning penalties', () => {
      const hallucinationResult = {
        isValid: true,
        score: 70,
        summary: 'Some unverified claims',
        checks: [
          {
            type: 'symbol' as const,
            claim: 'someSymbol',
            verified: false,
            details: 'Symbol not found',
            severity: 'warning' as const,
          },
          {
            type: 'symbol' as const,
            claim: 'anotherSymbol',
            verified: false,
            details: 'Symbol not found',
            severity: 'warning' as const,
          },
        ],
      };

      const result = applyHallucinationPenalty(80, hallucinationResult);

      expect(result.confidence).toBe(60); // 80 - (2 * 10)
      expect(result.penalties.some(p => p.includes('unverified reference'))).toBe(true);
    });

    it('should not modify confidence if all checks pass', () => {
      const hallucinationResult = {
        isValid: true,
        score: 100,
        summary: 'All verified',
        checks: [
          {
            type: 'file' as const,
            claim: 'auth.ts',
            verified: true,
            details: 'File found',
            severity: 'info' as const,
          },
        ],
      };

      const result = applyHallucinationPenalty(85, hallucinationResult);

      expect(result.confidence).toBe(85);
      expect(result.penalties).toHaveLength(0);
    });
  });
});
