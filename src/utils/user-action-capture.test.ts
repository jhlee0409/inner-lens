import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initUserActionCapture,
  getCapturedUserActions,
  clearCapturedUserActions,
  stopUserActionCapture,
  getUserActionsSummary,
  addCustomUserAction,
} from './user-action-capture';

describe('user-action-capture', () => {
  beforeEach(() => {
    // Reset state before each test
    stopUserActionCapture();
    clearCapturedUserActions();
  });

  afterEach(() => {
    // Cleanup after each test
    stopUserActionCapture();
    clearCapturedUserActions();
  });

  describe('initUserActionCapture', () => {
    it('should initialize without errors', () => {
      expect(() => initUserActionCapture()).not.toThrow();
    });

    it('should accept custom config', () => {
      expect(() =>
        initUserActionCapture({
          maxActions: 100,
          maskSensitiveData: false,
          captureActions: ['click', 'scroll'],
        })
      ).not.toThrow();
    });

    it('should not throw if called multiple times', () => {
      initUserActionCapture();
      expect(() => initUserActionCapture()).not.toThrow();
    });
  });

  describe('getCapturedUserActions', () => {
    it('should return empty array initially', () => {
      initUserActionCapture();
      const actions = getCapturedUserActions();
      expect(actions).toEqual([]);
    });

    it('should return a copy of actions array', () => {
      initUserActionCapture();
      const actions1 = getCapturedUserActions();
      const actions2 = getCapturedUserActions();
      expect(actions1).not.toBe(actions2);
    });
  });

  describe('addCustomUserAction', () => {
    it('should add custom action', () => {
      initUserActionCapture();
      addCustomUserAction('click', 'button#test', { custom: 'data' });

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);

      const action = actions[0];
      expect(action).toBeDefined();
      expect(action?.type).toBe('click');
      expect(action?.target).toBe('button#test');
      expect(action?.metadata).toEqual({ custom: 'data' });
      expect(action?.timestamp).toBeDefined();
    });

    it('should respect maxActions limit', () => {
      initUserActionCapture({ maxActions: 3 });

      addCustomUserAction('click', 'button1');
      addCustomUserAction('click', 'button2');
      addCustomUserAction('click', 'button3');
      addCustomUserAction('click', 'button4');
      addCustomUserAction('click', 'button5');

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(3);
      expect(actions[0]?.target).toBe('button3');
      expect(actions[2]?.target).toBe('button5');
    });
  });

  describe('clearCapturedUserActions', () => {
    it('should clear all captured actions', () => {
      initUserActionCapture();
      addCustomUserAction('click', 'button1');
      addCustomUserAction('click', 'button2');

      expect(getCapturedUserActions()).toHaveLength(2);

      clearCapturedUserActions();

      expect(getCapturedUserActions()).toHaveLength(0);
    });
  });

  describe('getUserActionsSummary', () => {
    it('should return summary with counts', () => {
      initUserActionCapture();
      addCustomUserAction('click', 'button1');
      addCustomUserAction('click', 'button2');
      addCustomUserAction('scroll', 'window');
      addCustomUserAction('input', 'input#email');

      const summary = getUserActionsSummary();

      expect(summary.total).toBe(4);
      expect(summary.byType).toEqual({
        click: 2,
        scroll: 1,
        input: 1,
      });
      expect(summary.recentActions).toHaveLength(4);
      expect(summary.timeline).toContain('click');
      expect(summary.timeline).toContain('scroll');
    });

    it('should limit recent actions to 10', () => {
      initUserActionCapture({ maxActions: 20 });

      for (let i = 0; i < 15; i++) {
        addCustomUserAction('click', `button${i}`);
      }

      const summary = getUserActionsSummary();
      expect(summary.recentActions).toHaveLength(10);
    });
  });

  describe('stopUserActionCapture', () => {
    it('should stop capturing without errors', () => {
      initUserActionCapture();
      expect(() => stopUserActionCapture()).not.toThrow();
    });

    it('should allow re-initialization after stop', () => {
      initUserActionCapture();
      stopUserActionCapture();
      expect(() => initUserActionCapture()).not.toThrow();
    });
  });

  describe('click event capture', () => {
    it('should capture click events', () => {
      initUserActionCapture({ captureActions: ['click'] });

      const button = document.createElement('button');
      button.id = 'test-button';
      button.textContent = 'Click me';
      document.body.appendChild(button);

      button.click();

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('click');
      expect(actions[0]?.target).toContain('button');

      document.body.removeChild(button);
    });
  });

  describe('input event capture', () => {
    it('should capture input events with debounce', async () => {
      vi.useFakeTimers();
      initUserActionCapture({ captureActions: ['input'], inputDebounceMs: 100 });

      const input = document.createElement('input');
      input.id = 'test-input';
      document.body.appendChild(input);

      input.value = 'test value';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Should not capture immediately due to debounce
      expect(getCapturedUserActions()).toHaveLength(0);

      // Fast-forward past debounce
      vi.advanceTimersByTime(150);

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('input');
      expect(actions[0]?.value).toBe('test value');

      document.body.removeChild(input);
      vi.useRealTimers();
    });

    it('should mask sensitive input values', async () => {
      vi.useFakeTimers();
      initUserActionCapture({
        captureActions: ['input'],
        inputDebounceMs: 100,
        maskSensitiveData: true,
      });

      const input = document.createElement('input');
      input.type = 'password';
      input.id = 'test-password';
      document.body.appendChild(input);

      input.value = 'secretpassword123';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      vi.advanceTimersByTime(150);

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.value).toBe('[HIDDEN]');

      document.body.removeChild(input);
      vi.useRealTimers();
    });
  });

  describe('scroll event capture', () => {
    it('should capture scroll events with throttle', () => {
      vi.useFakeTimers();
      initUserActionCapture({ captureActions: ['scroll'], scrollThrottleMs: 100 });

      // Simulate scroll
      window.dispatchEvent(new Event('scroll'));

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('scroll');
      expect(actions[0]?.target).toBe('window');
      expect(actions[0]?.position).toBeDefined();

      vi.useRealTimers();
    });
  });

  describe('ignore selectors', () => {
    it('should ignore elements matching ignore selectors', () => {
      initUserActionCapture({
        captureActions: ['click'],
        ignoreSelectors: ['.ignore-me'],
      });

      const button = document.createElement('button');
      button.className = 'ignore-me';
      document.body.appendChild(button);

      button.click();

      expect(getCapturedUserActions()).toHaveLength(0);

      document.body.removeChild(button);
    });
  });
});
