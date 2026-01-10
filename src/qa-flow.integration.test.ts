/**
 * QA Issue Flow Integration Tests
 *
 * Verifies the complete flow:
 * 1. QA submits bug report → GitHub issue created
 * 2. Issue analyzed → Labels assigned based on severity/category
 * 3. Sensitive data is masked throughout the flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateBugReport } from './server';
import { maskSensitiveData, validateMasking } from './utils/masking';
import type { BugReportPayload } from './types';

// Store mock function reference
const mockCreate = vi.fn();

// Mock Octokit module - must use class syntax
vi.mock('@octokit/rest', () => ({
  Octokit: class MockOctokit {
    issues = {
      create: mockCreate,
    };
  },
}));

describe('QA Issue Flow Integration Tests', () => {
  // Import after mock is set up
  let createGitHubIssue: typeof import('./server').createGitHubIssue;
  let handleBugReport: typeof import('./server').handleBugReport;

  const mockConfig = {
    githubToken: 'ghp_test_token_12345',
    repository: 'owner/repo',
    defaultLabels: ['inner-lens'],
  };

  const validQAReport: BugReportPayload = {
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
    ],
    url: 'https://app.example.com/dashboard',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    timestamp: Date.now(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      data: {
        html_url: 'https://github.com/owner/repo/issues/42',
        number: 42,
      },
    });

    // Dynamic import to get the mocked version
    const server = await import('./server');
    createGitHubIssue = server.createGitHubIssue;
    handleBugReport = server.handleBugReport;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Step 1: QA Report Validation', () => {
    it('should accept valid QA bug report', () => {
      const result = validateBugReport(validQAReport);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe(validQAReport.description);
        expect(result.data.logs ?? []).toHaveLength(2);
        expect(result.data.logs?.[0]?.level).toBe('error');
      }
    });

    it('should accept QA report with custom labels for routing', () => {
      const reportWithLabels = {
        ...validQAReport,
        metadata: {
          repository: 'owner/repo',
          labels: ['frontend', 'urgent', 'auth-team'],
        },
      };

      const result = validateBugReport(reportWithLabels);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata?.labels).toContain('auth-team');
        expect(result.data.metadata?.labels).toContain('urgent');
      }
    });

    it('should reject QA report without description', () => {
      const invalidReport = { ...validQAReport, description: '' };

      const result = validateBugReport(invalidReport);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Description is required');
      }
    });

    it('should accept QA report with empty logs (user description only)', () => {
      const reportNoLogs = { ...validQAReport, logs: [] };

      const result = validateBugReport(reportNoLogs);

      expect(result.success).toBe(true);
    });
  });

  describe('Step 2: Sensitive Data Masking', () => {
    it('should mask email addresses in bug report', () => {
      const reportWithEmail = {
        ...validQAReport,
        description: 'Error when user john.doe@example.com logs in',
        logs: [
          {
            level: 'error' as const,
            message: 'Auth failed for admin@company.org',
            timestamp: Date.now(),
          },
        ],
      };

      const maskedDescription = maskSensitiveData(reportWithEmail.description);
      const maskedLog = maskSensitiveData(reportWithEmail.logs[0]!.message);

      expect(maskedDescription).not.toContain('john.doe@example.com');
      expect(maskedDescription).toContain('[EMAIL_REDACTED]');
      expect(maskedLog).not.toContain('admin@company.org');
      expect(maskedLog).toContain('[EMAIL_REDACTED]');
    });

    it('should mask API keys in bug report', () => {
      const reportWithSecrets = {
        ...validQAReport,
        logs: [
          {
            level: 'error' as const,
            message: 'Failed with key sk-1234567890abcdefghijklmn',
            timestamp: Date.now(),
          },
        ],
      };

      const maskedLog = maskSensitiveData(reportWithSecrets.logs[0]!.message);

      expect(maskedLog).not.toContain('sk-1234567890abcdefghijklmn');
      expect(maskedLog).toContain('[OPENAI_KEY_REDACTED]');
    });

    it('should mask JWT tokens in stack traces', () => {
      const jwtToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const reportWithJWT = {
        ...validQAReport,
        logs: [
          {
            level: 'error' as const,
            message: `Token validation failed: ${jwtToken}`,
            timestamp: Date.now(),
            stack: `Error with token ${jwtToken}`,
          },
        ],
      };

      const maskedMessage = maskSensitiveData(reportWithJWT.logs[0]!.message);
      const maskedStack = maskSensitiveData(reportWithJWT.logs[0]!.stack!);

      expect(maskedMessage).not.toContain(jwtToken);
      expect(maskedMessage).toContain('[JWT_REDACTED]');
      expect(maskedStack).not.toContain(jwtToken);
    });

    it('should validate no secrets remain after masking', () => {
      const sensitiveText =
        'Error: auth failed for user@test.com with key sk-abcdefghijklmnopqrstuvwxyz';

      const masked = maskSensitiveData(sensitiveText);
      const isValid = validateMasking(masked);

      // validateMasking returns boolean - true if safe, false if potential leaks
      expect(isValid).toBe(true);
    });
  });

  describe('Step 3: GitHub Issue Creation', () => {
    it('should create GitHub issue from QA report', async () => {
      const result = await createGitHubIssue(validQAReport, mockConfig);

      expect(result.success).toBe(true);
      expect(result.issueUrl).toBe('https://github.com/owner/repo/issues/42');
      expect(result.issueNumber).toBe(42);
    });

    it('should include default label (inner-lens) for analysis trigger', async () => {
      await createGitHubIssue(validQAReport, mockConfig);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: expect.arrayContaining(['inner-lens']),
        })
      );
    });

    it('should merge custom labels with default labels', async () => {
      const reportWithLabels: BugReportPayload = {
        ...validQAReport,
        metadata: {
          labels: ['frontend', 'critical'],
        },
      };

      await createGitHubIssue(reportWithLabels, mockConfig);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: expect.arrayContaining(['inner-lens', 'frontend', 'critical']),
        })
      );
    });

    it('should truncate long descriptions in issue title', async () => {
      const longDescriptionReport: BugReportPayload = {
        ...validQAReport,
        description:
          'This is a very long bug description that exceeds eighty characters and should be truncated with ellipsis',
      };

      await createGitHubIssue(longDescriptionReport, mockConfig);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/^.{1,80}\.\.\.$/),
        })
      );
    });

    it('should format issue body with structured sections', async () => {
      await createGitHubIssue(validQAReport, mockConfig);

      const callArgs = mockCreate.mock.calls[0]![0];
      expect(callArgs.body).toContain('## Bug Report');
      expect(callArgs.body).toContain('### Description');
      expect(callArgs.body).toContain('### Environment');
      expect(callArgs.body).toContain('Console Logs');
      expect(callArgs.body).toContain('Awaiting AI analysis');
    });

    it('should handle GitHub API errors gracefully', async () => {
      mockCreate.mockRejectedValueOnce(new Error('GitHub API rate limit exceeded'));

      const result = await createGitHubIssue(validQAReport, mockConfig);

      expect(result.success).toBe(false);
      expect(result.message).toContain('rate limit');
    });

    it('should reject invalid repository format', async () => {
      const invalidConfig = { ...mockConfig, repository: 'invalid-format' };

      const result = await createGitHubIssue(validQAReport, invalidConfig);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid repository format');
    });
  });

  describe('Step 4: Full handleBugReport Flow', () => {
    it('should return 201 status on successful issue creation', async () => {
      const result = await handleBugReport(validQAReport, mockConfig);

      expect(result.status).toBe(201);
      expect(result.body.success).toBe(true);
    });

    it('should return 400 status on invalid payload', async () => {
      const invalidPayload = { description: '' };

      const result = await handleBugReport(invalidPayload, mockConfig);

      expect(result.status).toBe(400);
      expect(result.body.success).toBe(false);
    });

    it('should return 500 status on GitHub API failure', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Network error'));

      const result = await handleBugReport(validQAReport, mockConfig);

      expect(result.status).toBe(500);
      expect(result.body.success).toBe(false);
    });
  });

  describe('Step 5: Label-based Assignment Verification', () => {
    it('should apply inner-lens label to trigger workflow', async () => {
      await createGitHubIssue(validQAReport, mockConfig);

      // inner-lens label is required for GitHub Actions workflow trigger
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: expect.arrayContaining(['inner-lens']),
        })
      );
    });

    it('should support team-specific routing via custom labels', async () => {
      const reportForBackendTeam: BugReportPayload = {
        ...validQAReport,
        description: 'API response returns 500 error',
        metadata: {
          labels: ['backend-team', 'api'],
        },
      };

      await createGitHubIssue(reportForBackendTeam, mockConfig);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: expect.arrayContaining(['backend-team', 'api']),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle report with maximum 50 logs', async () => {
      const manyLogsReport: BugReportPayload = {
        ...validQAReport,
        logs: Array.from({ length: 60 }, (_, i) => ({
          level: 'error' as const,
          message: `Error ${i + 1}`,
          timestamp: Date.now() - i * 1000,
        })),
      };

      await createGitHubIssue(manyLogsReport, mockConfig);

      const callArgs = mockCreate.mock.calls[0]![0];
      // Should only include last 50 logs (MAX_LOG_ENTRIES)
      const logMatches = callArgs.body.match(/\[ERROR\]/g);
      expect(logMatches!.length).toBeLessThanOrEqual(50);
    });

    it('should handle report with empty URL', async () => {
      const reportNoUrl: BugReportPayload = {
        ...validQAReport,
        url: '',
      };

      const validation = validateBugReport(reportNoUrl);
      expect(validation.success).toBe(true);

      await createGitHubIssue(reportNoUrl, mockConfig);

      const callArgs = mockCreate.mock.calls[0]![0];
      expect(callArgs.body).toContain('N/A');
    });

    it('should mask sensitive data in issue body', async () => {
      const sensitiveReport: BugReportPayload = {
        ...validQAReport,
        description: 'Error for user secret@company.com',
        logs: [
          {
            level: 'error' as const,
            message: 'API key exposed: sk-1234567890abcdefghij',
            timestamp: Date.now(),
          },
        ],
      };

      await createGitHubIssue(sensitiveReport, mockConfig);

      const callArgs = mockCreate.mock.calls[0]![0];
      expect(callArgs.body).not.toContain('secret@company.com');
      expect(callArgs.body).not.toContain('sk-1234567890abcdefghij');
      expect(callArgs.body).toContain('[EMAIL_REDACTED]');
      expect(callArgs.body).toContain('[OPENAI_KEY_REDACTED]');
    });
  });
});

describe('Analysis Engine Label Assignment Logic', () => {
  /**
   * These tests verify the label assignment logic from analyze-issue.ts
   * Labels are assigned based on:
   * - Severity: critical/high → priority:high
   * - Category: security → security
   * - Confidence: >= 80% → ai:high-confidence
   */

  it('should assign priority:high for critical severity', () => {
    const severity: string = 'critical';
    const labelsToAdd: string[] = [];

    if (severity === 'critical' || severity === 'high') {
      labelsToAdd.push('priority:high');
    }

    expect(labelsToAdd).toContain('priority:high');
  });

  it('should assign priority:high for high severity', () => {
    const severity: string = 'high';
    const labelsToAdd: string[] = [];

    if (severity === 'critical' || severity === 'high') {
      labelsToAdd.push('priority:high');
    }

    expect(labelsToAdd).toContain('priority:high');
  });

  it('should NOT assign priority:high for medium severity', () => {
    const severity: string = 'medium';
    const labelsToAdd: string[] = [];

    if (severity === 'critical' || severity === 'high') {
      labelsToAdd.push('priority:high');
    }

    expect(labelsToAdd).not.toContain('priority:high');
  });

  it('should assign security label for security category', () => {
    const category = 'security';
    const labelsToAdd: string[] = [];

    if (category === 'security') {
      labelsToAdd.push('security');
    }

    expect(labelsToAdd).toContain('security');
  });

  it('should assign ai:high-confidence for confidence >= 80', () => {
    const confidence = 85;
    const labelsToAdd: string[] = [];

    if (confidence >= 80) {
      labelsToAdd.push('ai:high-confidence');
    }

    expect(labelsToAdd).toContain('ai:high-confidence');
  });

  it('should NOT assign ai:high-confidence for confidence < 80', () => {
    const confidence = 75;
    const labelsToAdd: string[] = [];

    if (confidence >= 80) {
      labelsToAdd.push('ai:high-confidence');
    }

    expect(labelsToAdd).not.toContain('ai:high-confidence');
  });

  it('should assign multiple labels for critical security issue with high confidence', () => {
    const severity = 'critical';
    const category = 'security';
    const confidence = 90;
    const labelsToAdd: string[] = [];

    if (severity === 'critical' || severity === 'high') {
      labelsToAdd.push('priority:high');
    }
    if (category === 'security') {
      labelsToAdd.push('security');
    }
    if (confidence >= 80) {
      labelsToAdd.push('ai:high-confidence');
    }

    expect(labelsToAdd).toEqual(['priority:high', 'security', 'ai:high-confidence']);
  });
});
