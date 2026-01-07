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

    it('should ignore child elements of ignored parents', () => {
      initUserActionCapture({
        captureActions: ['click'],
        ignoreSelectors: ['.parent-ignore'],
      });

      const parent = document.createElement('div');
      parent.className = 'parent-ignore';
      const child = document.createElement('button');
      parent.appendChild(child);
      document.body.appendChild(parent);

      child.click();

      expect(getCapturedUserActions()).toHaveLength(0);

      document.body.removeChild(parent);
    });
  });

  describe('getElementSelector', () => {
    it('should generate selector with id', () => {
      initUserActionCapture({ captureActions: ['click'] });

      const button = document.createElement('button');
      button.id = 'unique-button';
      document.body.appendChild(button);

      button.click();

      const actions = getCapturedUserActions();
      expect(actions[0]?.target).toContain('#unique-button');

      document.body.removeChild(button);
    });

    it('should generate selector with data-testid', () => {
      initUserActionCapture({ captureActions: ['click'] });

      const button = document.createElement('button');
      button.setAttribute('data-testid', 'submit-btn');
      document.body.appendChild(button);

      button.click();

      const actions = getCapturedUserActions();
      expect(actions[0]?.target).toContain('[data-testid="submit-btn"]');

      document.body.removeChild(button);
    });

    it('should generate selector with name attribute for form elements', () => {
      initUserActionCapture({ captureActions: ['click'] });

      const input = document.createElement('input');
      input.setAttribute('name', 'email');
      document.body.appendChild(input);

      input.click();

      const actions = getCapturedUserActions();
      expect(actions[0]?.target).toContain('[name="email"]');

      document.body.removeChild(input);
    });

    it('should generate selector with aria-label', () => {
      initUserActionCapture({ captureActions: ['click'] });

      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Close dialog');
      document.body.appendChild(button);

      button.click();

      const actions = getCapturedUserActions();
      expect(actions[0]?.target).toContain('[aria-label=');

      document.body.removeChild(button);
    });

    it('should filter out utility class names', () => {
      initUserActionCapture({ captureActions: ['click'] });

      const button = document.createElement('button');
      button.className = 'p-4 m-2 flex text-sm bg-blue-500 meaningful-class';
      document.body.appendChild(button);

      button.click();

      const actions = getCapturedUserActions();
      expect(actions[0]?.target).toContain('.meaningful-class');
      expect(actions[0]?.target).not.toContain('.p-4');

      document.body.removeChild(button);
    });
  });

  describe('handleChange', () => {
    it('should capture select change events', () => {
      initUserActionCapture({ captureActions: ['change'] });

      const select = document.createElement('select');
      const option1 = document.createElement('option');
      option1.value = '1';
      option1.text = 'Option 1';
      const option2 = document.createElement('option');
      option2.value = '2';
      option2.text = 'Option 2';
      select.appendChild(option1);
      select.appendChild(option2);
      document.body.appendChild(select);

      select.selectedIndex = 1;
      select.dispatchEvent(new Event('change', { bubbles: true }));

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('change');
      expect(actions[0]?.value).toBe('Option 2');

      document.body.removeChild(select);
    });

    it('should capture checkbox change events', () => {
      initUserActionCapture({ captureActions: ['change'] });

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      document.body.appendChild(checkbox);

      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.value).toBe('checked');

      document.body.removeChild(checkbox);
    });

    it('should capture radio change events', () => {
      initUserActionCapture({ captureActions: ['change'] });

      const radio = document.createElement('input');
      radio.type = 'radio';
      document.body.appendChild(radio);

      radio.checked = false;
      radio.dispatchEvent(new Event('change', { bubbles: true }));

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.value).toBe('unchecked');

      document.body.removeChild(radio);
    });

    it('should mask sensitive input values on change', () => {
      initUserActionCapture({
        captureActions: ['change'],
        maskSensitiveData: true,
      });

      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'api-key';
      document.body.appendChild(input);

      input.value = 'sk-12345';
      input.dispatchEvent(new Event('change', { bubbles: true }));

      const actions = getCapturedUserActions();
      expect(actions[0]?.value).toBe('[SENSITIVE]');

      document.body.removeChild(input);
    });
  });

  describe('handleFocus', () => {
    it('should capture focus on interactive elements', () => {
      initUserActionCapture({ captureActions: ['focus'] });

      const input = document.createElement('input');
      input.id = 'test-input';
      document.body.appendChild(input);

      input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('focus');

      document.body.removeChild(input);
    });

    it('should not capture focus on non-interactive elements', () => {
      initUserActionCapture({ captureActions: ['focus'] });

      const div = document.createElement('div');
      document.body.appendChild(div);

      div.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

      expect(getCapturedUserActions()).toHaveLength(0);

      document.body.removeChild(div);
    });
  });

  describe('handleKeydown', () => {
    it('should capture special keys', () => {
      initUserActionCapture({ captureActions: ['keydown'] });

      const input = document.createElement('input');
      document.body.appendChild(input);

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('keydown');
      expect(actions[0]?.key).toBe('Enter');

      document.body.removeChild(input);
    });

    it('should capture escape key', () => {
      initUserActionCapture({ captureActions: ['keydown'] });

      const input = document.createElement('input');
      document.body.appendChild(input);

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.key).toBe('Escape');

      document.body.removeChild(input);
    });

    it('should capture arrow keys', () => {
      initUserActionCapture({ captureActions: ['keydown'] });

      const input = document.createElement('input');
      document.body.appendChild(input);

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.key).toBe('ArrowDown');

      document.body.removeChild(input);
    });

    it('should not capture regular typing keys', () => {
      initUserActionCapture({ captureActions: ['keydown'] });

      const input = document.createElement('input');
      document.body.appendChild(input);

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

      expect(getCapturedUserActions()).toHaveLength(0);

      document.body.removeChild(input);
    });

    it('should include modifier key metadata', () => {
      initUserActionCapture({ captureActions: ['keydown'] });

      const input = document.createElement('input');
      document.body.appendChild(input);

      input.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'Enter', 
        ctrlKey: true, 
        shiftKey: true, 
        bubbles: true 
      }));

      const actions = getCapturedUserActions();
      expect(actions[0]?.metadata).toEqual({
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      });

      document.body.removeChild(input);
    });
  });

  describe('handleClipboard', () => {
    it('should capture copy events', () => {
      initUserActionCapture({ captureActions: ['copy'] });

      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new Event('copy', { bubbles: true });
      input.dispatchEvent(event);

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('copy');

      document.body.removeChild(input);
    });

    it('should capture paste events', () => {
      initUserActionCapture({ captureActions: ['paste'] });

      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new Event('paste', { bubbles: true });
      input.dispatchEvent(event);

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('paste');

      document.body.removeChild(input);
    });
  });

  describe('handleSubmit', () => {
    it('should capture form submit events', () => {
      initUserActionCapture({ captureActions: ['submit'] });

      const form = document.createElement('form');
      form.action = '/api/submit';
      form.method = 'POST';
      document.body.appendChild(form);

      form.dispatchEvent(new Event('submit', { bubbles: true }));

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('submit');
      expect(actions[0]?.metadata).toEqual({
        formAction: form.action,
        formMethod: 'post',
      });

      document.body.removeChild(form);
    });
  });

  describe('handleClick with metadata', () => {
    it('should capture button aria-label when no text', () => {
      initUserActionCapture({ captureActions: ['click'] });

      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Submit Form');
      document.body.appendChild(button);

      button.click();

      const actions = getCapturedUserActions();
      expect(actions[0]?.metadata?.label).toBe('Submit Form');

      document.body.removeChild(button);
    });

    it('should capture aria-label as fallback', () => {
      initUserActionCapture({ captureActions: ['click'] });

      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Close');
      document.body.appendChild(button);

      button.click();

      const actions = getCapturedUserActions();
      expect(actions[0]?.metadata?.label).toBe('Close');

      document.body.removeChild(button);
    });

    it('should capture double click events', () => {
      initUserActionCapture({ captureActions: ['dblclick'] });

      const button = document.createElement('button');
      document.body.appendChild(button);

      button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      const actions = getCapturedUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]?.type).toBe('dblclick');

      document.body.removeChild(button);
    });
  });

  describe('maskValue', () => {
    it('should mask hidden input values', async () => {
      vi.useFakeTimers();
      initUserActionCapture({
        captureActions: ['input'],
        inputDebounceMs: 100,
        maskSensitiveData: true,
      });

      const input = document.createElement('input');
      input.type = 'hidden';
      document.body.appendChild(input);

      input.value = 'secret-value';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      vi.advanceTimersByTime(150);

      const actions = getCapturedUserActions();
      expect(actions[0]?.value).toBe('[HIDDEN]');

      document.body.removeChild(input);
      vi.useRealTimers();
    });

    it('should mask fields with sensitive names', async () => {
      vi.useFakeTimers();
      initUserActionCapture({
        captureActions: ['input'],
        inputDebounceMs: 100,
        maskSensitiveData: true,
      });

      const input = document.createElement('input');
      input.setAttribute('name', 'credit-card-number');
      document.body.appendChild(input);

      input.value = '1234567890';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      vi.advanceTimersByTime(150);

      const actions = getCapturedUserActions();
      expect(actions[0]?.value).toBe('[SENSITIVE]');

      document.body.removeChild(input);
      vi.useRealTimers();
    });

    it('should not mask when maskSensitiveData is false', async () => {
      vi.useFakeTimers();
      initUserActionCapture({
        captureActions: ['input'],
        inputDebounceMs: 100,
        maskSensitiveData: false,
      });

      const input = document.createElement('input');
      input.type = 'password';
      document.body.appendChild(input);

      input.value = 'mypassword';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      vi.advanceTimersByTime(150);

      const actions = getCapturedUserActions();
      expect(actions[0]?.value).toBe('mypassword');

      document.body.removeChild(input);
      vi.useRealTimers();
    });
  });

  describe('getUserActionsSummary with values', () => {
    it('should include value in timeline', () => {
      initUserActionCapture();
      addCustomUserAction('input', 'input#email', undefined);
      
      const actions = getCapturedUserActions();
      if (actions[0]) {
        actions[0].value = 'test@example.com';
      }

      const inputAction = {
        type: 'input' as const,
        target: 'input#email',
        timestamp: Date.now(),
        value: 'test@example.com',
      };
      clearCapturedUserActions();
      addCustomUserAction(inputAction.type, inputAction.target, undefined);
      const captured = getCapturedUserActions();
      if (captured[0]) {
        captured[0].value = inputAction.value;
      }

      const summary = getUserActionsSummary();
      expect(summary.timeline).toContain('input');
    });

    it('should include key in timeline for keydown', () => {
      initUserActionCapture();
      
      const keyAction = {
        type: 'keydown' as const,
        target: 'input#search',
        timestamp: Date.now(),
        key: 'Enter',
      };
      addCustomUserAction(keyAction.type, keyAction.target, undefined);
      const captured = getCapturedUserActions();
      if (captured[0]) {
        captured[0].key = keyAction.key;
      }

      const summary = getUserActionsSummary();
      expect(summary.timeline).toContain('Enter');
    });
  });
});
