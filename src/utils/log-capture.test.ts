import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initLogCapture,
  getCapturedLogs,
  clearCapturedLogs,
  restoreConsole,
  addCustomLog,
} from './log-capture';

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
    it('hooks into console.error', () => {
      initLogCapture();
      console.error('test error');

      const logs = getCapturedLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.level).toBe('error');
      expect(logs[0]!.message).toBe('test error');
    });

    it('hooks into console.warn', () => {
      initLogCapture();
      console.warn('test warning');

      const logs = getCapturedLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.level).toBe('warn');
      expect(logs[0]!.message).toBe('test warning');
    });

    it('captures multiple logs', () => {
      initLogCapture();
      console.error('error 1');
      console.warn('warning 1');
      console.error('error 2');

      const logs = getCapturedLogs();
      expect(logs).toHaveLength(3);
    });

    it('respects maxEntries option', () => {
      initLogCapture({ maxEntries: 2 });
      console.error('error 1');
      console.error('error 2');
      console.error('error 3');

      const logs = getCapturedLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0]!.message).toBe('error 2');
      expect(logs[1]!.message).toBe('error 3');
    });

    it('masks sensitive data by default', () => {
      initLogCapture();
      console.error('User email: john@example.com');

      const logs = getCapturedLogs();
      expect(logs[0]!.message).toContain('[EMAIL_REDACTED]');
      expect(logs[0]!.message).not.toContain('john@example.com');
    });

    it('can disable sensitive data masking', () => {
      initLogCapture({ maskSensitiveData: false });
      console.error('User email: john@example.com');

      const logs = getCapturedLogs();
      expect(logs[0]!.message).toContain('john@example.com');
    });

    it('captures Error objects with stack', () => {
      initLogCapture();
      const error = new Error('Test error');
      console.error(error);

      const logs = getCapturedLogs();
      expect(logs[0]!.message).toContain('Error: Test error');
      expect(logs[0]!.stack).toBeDefined();
    });

    it('handles object arguments', () => {
      initLogCapture();
      console.error('Error:', { code: 500, message: 'Internal' });

      const logs = getCapturedLogs();
      expect(logs[0]!.message).toContain('code');
      expect(logs[0]!.message).toContain('500');
    });

    it('handles null and undefined', () => {
      initLogCapture();
      console.error(null, undefined);

      const logs = getCapturedLogs();
      expect(logs[0]!.message).toBe('null undefined');
    });
  });

  describe('getCapturedLogs', () => {
    it('returns empty array when no logs', () => {
      expect(getCapturedLogs()).toEqual([]);
    });

    it('returns a copy of logs', () => {
      initLogCapture();
      console.error('test');

      const logs1 = getCapturedLogs();
      const logs2 = getCapturedLogs();
      expect(logs1).not.toBe(logs2);
      expect(logs1).toEqual(logs2);
    });
  });

  describe('clearCapturedLogs', () => {
    it('clears all captured logs', () => {
      initLogCapture();
      console.error('test');
      expect(getCapturedLogs()).toHaveLength(1);

      clearCapturedLogs();
      expect(getCapturedLogs()).toHaveLength(0);
    });
  });

  describe('restoreConsole', () => {
    it('stops capturing logs', () => {
      initLogCapture();
      console.error('captured');
      expect(getCapturedLogs()).toHaveLength(1);

      restoreConsole();
      clearCapturedLogs();
      console.error('not captured');
      expect(getCapturedLogs()).toHaveLength(0);
    });
  });

  describe('addCustomLog', () => {
    it('adds a custom log entry', () => {
      addCustomLog('error', 'Custom error message');

      const logs = getCapturedLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.level).toBe('error');
      expect(logs[0]!.message).toBe('Custom error message');
    });

    it('adds custom log with stack', () => {
      addCustomLog('error', 'Error', 'at line 42');

      const logs = getCapturedLogs();
      expect(logs[0]!.stack).toBe('at line 42');
    });

    it('masks sensitive data in custom logs', () => {
      initLogCapture({ maskSensitiveData: true });
      addCustomLog('warn', 'Key: sk-1234567890abcdefghij');

      const logs = getCapturedLogs();
      expect(logs[0]!.message).not.toContain('sk-1234567890abcdefghij');
      expect(logs[0]!.message).toContain('REDACTED');
    });
  });

  describe('network interceptor', () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      restoreConsole();
      clearCapturedLogs();
      globalThis.fetch = originalFetch;
    });

    it('captures successful fetch requests', async () => {
      const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      initLogCapture();

      await fetch('https://api.example.com/data');

      const logs = getCapturedLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.level).toBe('info');
      expect(logs[0]!.message).toContain('[NETWORK]');
      expect(logs[0]!.message).toContain('GET https://api.example.com/data');
      expect(logs[0]!.message).toContain('Status: 200');
    });

    it('captures POST requests with body', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 201,
      });
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      initLogCapture();

      await fetch('https://api.example.com/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'John' }),
      });

      const logs = getCapturedLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.message).toContain('POST https://api.example.com/users');
      expect(logs[0]!.message).toContain('Request Body:');
      expect(logs[0]!.message).toContain('John');
    });

    it('logs error status codes as errors', async () => {
      const mockResponse = new Response('Not Found', {
        status: 404,
      });
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      initLogCapture();

      await fetch('https://api.example.com/missing');

      const logs = getCapturedLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.level).toBe('error');
      expect(logs[0]!.message).toContain('Status: 404');
    });

    it('logs 500 errors as error level', async () => {
      const mockResponse = new Response('Server Error', {
        status: 500,
      });
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      initLogCapture();

      await fetch('https://api.example.com/error');

      const logs = getCapturedLogs();
      expect(logs[0]!.level).toBe('error');
      expect(logs[0]!.message).toContain('Status: 500');
    });

    it('captures network errors', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      initLogCapture();

      await expect(fetch('https://api.example.com/fail')).rejects.toThrow(
        'Network failure'
      );

      const logs = getCapturedLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.level).toBe('error');
      expect(logs[0]!.message).toContain('[Network Error: Network failure]');
    });

    it('masks sensitive data in request bodies', async () => {
      const mockResponse = new Response('OK', { status: 200 });
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      initLogCapture({ maskSensitiveData: true });

      await fetch('https://api.example.com/auth', {
        method: 'POST',
        body: JSON.stringify({ email: 'secret@example.com', apiKey: 'sk-12345678901234567890' }),
      });

      const logs = getCapturedLogs();
      expect(logs[0]!.message).toContain('[EMAIL_REDACTED]');
      expect(logs[0]!.message).not.toContain('secret@example.com');
      expect(logs[0]!.message).not.toContain('sk-12345678901234567890');
      expect(logs[0]!.message).toContain('REDACTED');
    });

    it('masks sensitive data in response bodies', async () => {
      const mockResponse = new Response(
        JSON.stringify({ user: { email: 'private@example.com' } }),
        { status: 200 }
      );
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      initLogCapture({ maskSensitiveData: true });

      await fetch('https://api.example.com/user');

      const logs = getCapturedLogs();
      expect(logs[0]!.message).toContain('[EMAIL_REDACTED]');
      expect(logs[0]!.message).not.toContain('private@example.com');
    });

    it('truncates long response bodies', async () => {
      const longBody = 'x'.repeat(2000);
      const mockResponse = new Response(longBody, { status: 200 });
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      initLogCapture();

      await fetch('https://api.example.com/large');

      const logs = getCapturedLogs();
      expect(logs[0]!.message).toContain('[TRUNCATED]');
      expect(logs[0]!.message.length).toBeLessThan(longBody.length + 500);
    });

    it('handles Request objects', async () => {
      const mockResponse = new Response('OK', { status: 200 });
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      initLogCapture();

      const request = new Request('https://api.example.com/resource', {
        method: 'PUT',
      });
      await fetch(request);

      const logs = getCapturedLogs();
      expect(logs[0]!.message).toContain('PUT https://api.example.com/resource');
    });

    it('handles URL objects', async () => {
      const mockResponse = new Response('OK', { status: 200 });
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      initLogCapture();

      await fetch(new URL('https://api.example.com/url-object'));

      const logs = getCapturedLogs();
      expect(logs[0]!.message).toContain('GET https://api.example.com/url-object');
    });

    it('captures duration in milliseconds', async () => {
      const mockResponse = new Response('OK', { status: 200 });
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      initLogCapture();

      await fetch('https://api.example.com/timed');

      const logs = getCapturedLogs();
      expect(logs[0]!.message).toMatch(/Duration: \d+ms/);
    });

    it('restores original fetch on restoreConsole', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('OK'));
      globalThis.fetch = mockFetch;

      initLogCapture();
      restoreConsole();

      // After restore, fetch should work but not capture logs
      clearCapturedLogs();
      await fetch('https://api.example.com/test');

      const logs = getCapturedLogs();
      expect(logs).toHaveLength(0);
    });

    it('does not break app when fetch fails', async () => {
      const networkError = new Error('Connection refused');
      globalThis.fetch = vi.fn().mockRejectedValue(networkError);

      initLogCapture();

      // Should throw the original error
      await expect(fetch('https://api.example.com/fail')).rejects.toThrow(
        'Connection refused'
      );

      // But still capture the log
      const logs = getCapturedLogs();
      expect(logs).toHaveLength(1);
    });
  });
});
