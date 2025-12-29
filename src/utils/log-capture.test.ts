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
      expect(logs[0]!.message).toContain('[OPENAI_KEY_REDACTED]');
    });
  });
});
