import { describe, it, expect } from 'vitest';
import {
  validateHostedBugReport,
  formatIssueBody,
  maskSensitiveData,
  MAX_LOG_ENTRIES,
  MAX_PAYLOAD_SIZE,
  MAX_SESSION_REPLAY_SIZE,
} from './_shared';

describe('api/_shared', () => {
  describe('validateHostedBugReport', () => {
    it('should validate valid payload', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'Test bug description',
      };

      const result = validateHostedBugReport(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.owner).toBe('test-owner');
        expect(result.data.repo).toBe('test-repo');
        expect(result.data.description).toBe('Test bug description');
      }
    });

    it('should validate payload with all optional fields', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'Test description',
        logs: [
          { level: 'error' as const, message: 'Test error', timestamp: Date.now() },
        ],
        url: 'https://example.com',
        userAgent: 'Mozilla/5.0',
        timestamp: Date.now(),
        userActions: [
          { type: 'click' as const, target: 'button', timestamp: Date.now() },
        ],
        navigations: [
          { type: 'pageload' as const, timestamp: Date.now(), from: '/', to: '/page' },
        ],
        performance: {
          coreWebVitals: { LCP: 1000, CLS: 0.1 },
          timing: { domContentLoaded: 500, loadComplete: 1000 },
          resourceCount: 50,
        },
        pageContext: {
          route: '/page',
          pathname: '/page',
          hash: '',
          title: 'Test Page',
          timeOnPage: 5000,
        },
        reporter: { name: 'Test User', email: 'test@example.com' },
      };

      const result = validateHostedBugReport(payload);
      expect(result.success).toBe(true);
    });

    it('should reject missing owner', () => {
      const payload = {
        repo: 'test-repo',
        description: 'Test description',
      };

      const result = validateHostedBugReport(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('owner');
      }
    });

    it('should reject missing repo', () => {
      const payload = {
        owner: 'test-owner',
        description: 'Test description',
      };

      const result = validateHostedBugReport(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('repo');
      }
    });

    it('should reject missing description', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
      };

      const result = validateHostedBugReport(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('description');
      }
    });

    it('should reject empty owner', () => {
      const payload = {
        owner: '',
        repo: 'test-repo',
        description: 'Test description',
      };

      const result = validateHostedBugReport(payload);
      expect(result.success).toBe(false);
    });

    it('should reject description over 10000 characters', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'a'.repeat(10001),
      };

      const result = validateHostedBugReport(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('too long');
      }
    });

    it('should reject invalid log level', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'Test',
        logs: [
          { level: 'invalid', message: 'Test', timestamp: Date.now() },
        ],
      };

      const result = validateHostedBugReport(payload);
      expect(result.success).toBe(false);
    });

    it('should reject invalid user action type', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'Test',
        userActions: [
          { type: 'invalid', target: 'button', timestamp: Date.now() },
        ],
      };

      const result = validateHostedBugReport(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('formatIssueBody', () => {
    it('should format basic issue body', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'Bug description',
        url: 'https://example.com/page',
        userAgent: 'Mozilla/5.0',
        timestamp: 1704067200000,
      };

      const body = formatIssueBody(payload);
      expect(body).toContain('Bug description');
      expect(body).toContain('https://example.com/page');
      expect(body).toContain('Mozilla/5.0');
    });

    it('should mask sensitive data in description', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'Error with email user@example.com',
      };

      const body = formatIssueBody(payload);
      expect(body).toContain('[EMAIL_REDACTED]');
      expect(body).not.toContain('user@example.com');
    });

    it('should mask sensitive data in logs', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'Test',
        logs: [
          { level: 'error' as const, message: 'API key: sk-1234567890', timestamp: Date.now() },
        ],
      };

      const body = formatIssueBody(payload);
      expect(body).not.toContain('sk-1234567890');
    });

    it('should format user actions', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'Test',
        userActions: [
          { type: 'click' as const, target: '#submit-btn', timestamp: 1704067200000 },
          { type: 'input' as const, target: '#email-input', timestamp: 1704067201000, value: 'test' },
        ],
      };

      const body = formatIssueBody(payload);
      expect(body).toContain('CLICK');
      expect(body).toContain('#submit-btn');
      expect(body).toContain('INPUT');
    });

    it('should format navigations', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'Test',
        navigations: [
          { type: 'pageload' as const, timestamp: 1704067200000, from: '/', to: '/dashboard', duration: 500 },
        ],
      };

      const body = formatIssueBody(payload);
      expect(body).toContain('pageload');
      expect(body).toContain('/dashboard');
      expect(body).toContain('500ms');
    });

    it('should format performance metrics', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'Test',
        performance: {
          coreWebVitals: { LCP: 2500, FID: 100, CLS: 0.1, TTFB: 200 },
          timing: { domContentLoaded: 1000, loadComplete: 2000 },
          resourceCount: 50,
        },
      };

      const body = formatIssueBody(payload);
      expect(body).toContain('LCP: 2500ms');
      expect(body).toContain('FID: 100ms');
      expect(body).toContain('CLS: 0.100');
      expect(body).toContain('Resources: 50');
    });

    it('should format page context', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'Test',
        pageContext: {
          route: '/users/123',
          pathname: '/users/123',
          hash: '#details',
          title: 'User Details',
          timeOnPage: 30000,
          referrer: 'https://google.com',
        },
      };

      const body = formatIssueBody(payload);
      expect(body).toContain('/users/123');
      expect(body).toContain('User Details');
    });

    it('should format reporter info', () => {
      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'Test',
        reporter: {
          name: 'John Doe',
          email: 'john@example.com',
          id: 'user-123',
        },
      };

      const body = formatIssueBody(payload);
      expect(body).toContain('John Doe');
    });

    it('should limit logs to MAX_LOG_ENTRIES', () => {
      const logs = Array.from({ length: 100 }, (_, i) => ({
        level: 'info' as const,
        message: `Log ${i}`,
        timestamp: Date.now() + i,
      }));

      const payload = {
        owner: 'test-owner',
        repo: 'test-repo',
        description: 'Test',
        logs,
      };

      const body = formatIssueBody(payload);
      expect(body).toContain(`Log ${99}`);
      expect(body).not.toContain(`Log ${0}`);
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask email addresses', () => {
      expect(maskSensitiveData('Contact: user@example.com')).toBe('Contact: [EMAIL_REDACTED]');
    });

    it('should mask Bearer tokens', () => {
      expect(maskSensitiveData('Bearer abc123xyz')).toBe('Bearer [TOKEN_REDACTED]');
    });

    it('should mask JWT tokens', () => {
      expect(maskSensitiveData('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature'))
        .toBe('[JWT_REDACTED]');
    });

    it('should mask credit card numbers', () => {
      expect(maskSensitiveData('Card: 4111111111111111')).toBe('Card: [CARD_REDACTED]');
    });

    it('should mask AWS keys', () => {
      expect(maskSensitiveData('AKIAIOSFODNN7EXAMPLE')).toBe('[AWS_KEY_REDACTED]');
    });

    it('should mask GitHub tokens', () => {
      expect(maskSensitiveData('ghp_1234567890abcdefghijklmnopqrstuvwxyz'))
        .toBe('[GITHUB_TOKEN_REDACTED]');
    });

    it('should mask OpenAI keys', () => {
      expect(maskSensitiveData('sk-12345678901234567890abcd'))
        .toBe('[OPENAI_KEY_REDACTED]');
    });
  });

  describe('constants', () => {
    it('should have correct MAX_LOG_ENTRIES', () => {
      expect(MAX_LOG_ENTRIES).toBe(50);
    });

    it('should have correct MAX_PAYLOAD_SIZE', () => {
      expect(MAX_PAYLOAD_SIZE).toBe(10 * 1024 * 1024);
    });

    it('should have correct MAX_SESSION_REPLAY_SIZE', () => {
      expect(MAX_SESSION_REPLAY_SIZE).toBe(5 * 1024 * 1024);
    });
  });
});
