import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InnerLensCore } from './InnerLensCore';

describe('InnerLensCore', () => {
  let instance: InnerLensCore;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    instance?.unmount();
    document.body.innerHTML = '';
  });

  describe('mount/unmount lifecycle', () => {
    it('should mount widget to document.body by default', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();

      const widget = document.querySelector('#inner-lens-widget');
      expect(widget).not.toBeNull();
      expect(widget?.parentElement).toBe(document.body);
    });

    it('should mount widget to custom container', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount(container);

      const widget = container.querySelector('#inner-lens-widget');
      expect(widget).not.toBeNull();
    });

    it('should unmount widget from DOM', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();

      expect(document.querySelector('#inner-lens-widget')).not.toBeNull();

      instance.unmount();

      expect(document.querySelector('#inner-lens-widget')).toBeNull();
    });

    it('should not mount if already mounted', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();
      instance.mount();

      const widgets = document.querySelectorAll('#inner-lens-widget');
      expect(widgets.length).toBe(1);
    });

    it('should prevent multiple instances from mounting', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();

      const instance2 = new InnerLensCore({ repository: 'owner/repo' });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      instance2.mount();

      const widgets = document.querySelectorAll('#inner-lens-widget');
      expect(widgets.length).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith('[inner-lens] Widget already mounted. Multiple instances are not supported.');

      consoleSpy.mockRestore();
    });

    it('should inject styles on mount', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();

      const styleElement = document.querySelector('[data-inner-lens-styles]');
      expect(styleElement).not.toBeNull();
    });

    it('should remove styles on unmount', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();
      instance.unmount();

      const styleElement = document.querySelector('[data-inner-lens-styles]');
      expect(styleElement).toBeNull();
    });
  });

  describe('hidden option', () => {
    it('should not mount when hidden is true', () => {
      instance = new InnerLensCore({ repository: 'owner/repo', hidden: true });
      instance.mount();

      expect(document.querySelector('#inner-lens-widget')).toBeNull();
    });

    it('should not open when hidden is true', () => {
      instance = new InnerLensCore({ repository: 'owner/repo', hidden: true });
      instance.mount();
      instance.open();

      expect(instance.isDialogOpen).toBe(false);
    });
  });

  describe('disabled option', () => {
    it('should render disabled button when disabled is true', () => {
      instance = new InnerLensCore({ repository: 'owner/repo', disabled: true });
      instance.mount();

      const button = document.querySelector('#inner-lens-trigger') as HTMLButtonElement;
      expect(button?.disabled).toBe(true);
    });
  });

  describe('open/close dialog', () => {
    it('should open dialog', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();
      instance.open();

      expect(instance.isDialogOpen).toBe(true);
      expect(document.querySelector('#inner-lens-overlay')).not.toBeNull();
    });

    it('should close dialog', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();
      instance.open();
      instance.close();

      expect(instance.isDialogOpen).toBe(false);
    });

    it('should not open if not mounted', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.open();

      expect(instance.isDialogOpen).toBe(false);
    });

    it('should close dialog on Escape key', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();
      instance.open();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(instance.isDialogOpen).toBe(false);
    });

    it('should close dialog when clicking overlay', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();
      instance.open();

      const overlay = document.querySelector('#inner-lens-overlay') as HTMLElement;
      overlay?.click();

      expect(instance.isDialogOpen).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('should call onOpen when dialog opens', () => {
      const onOpen = vi.fn();
      instance = new InnerLensCore({ repository: 'owner/repo', onOpen });
      instance.mount();
      instance.open();

      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when dialog closes', () => {
      const onClose = vi.fn();
      instance = new InnerLensCore({ repository: 'owner/repo', onClose });
      instance.mount();
      instance.open();
      instance.close();

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('trigger button', () => {
    it('should open dialog when trigger button is clicked', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      trigger?.click();

      expect(instance.isDialogOpen).toBe(true);
    });

    it('should use custom button text', () => {
      instance = new InnerLensCore({
        repository: 'owner/repo',
        buttonText: 'Custom Bug Report',
      });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      expect(trigger?.getAttribute('aria-label')).toBe('Custom Bug Report');
    });
  });

  describe('dialog content', () => {
    it('should display custom dialog title', () => {
      instance = new InnerLensCore({
        repository: 'owner/repo',
        dialogTitle: 'Custom Title',
      });
      instance.mount();
      instance.open();

      const title = document.querySelector('#inner-lens-title');
      expect(title?.textContent).toContain('Custom Title');
    });

    it('should have textarea with maxlength', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();
      instance.open();

      const textarea = document.querySelector('#inner-lens-description') as HTMLTextAreaElement;
      expect(textarea?.getAttribute('maxlength')).toBe('10000');
    });
  });

  describe('endpoint validation', () => {
    it('should fallback to hosted API when full URL endpoint contains "/undefined"', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      instance = new InnerLensCore({
        repository: 'owner/repo',
        endpoint: 'http://localhost:3001/undefined',
      });
      instance.mount();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid endpoint detected')
      );
      warnSpy.mockRestore();
    });

    it('should fallback to hosted API when full URL endpoint contains "/null"', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      instance = new InnerLensCore({
        repository: 'owner/repo',
        endpoint: 'https://example.com/api/null/report',
      });
      instance.mount();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid endpoint detected')
      );
      warnSpy.mockRestore();
    });

    it('should accept relative path endpoint without warning (self-hosted)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      instance = new InnerLensCore({
        repository: 'owner/repo',
        endpoint: '/api/bug-report',
      });
      instance.mount();

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should accept valid full URL endpoint without warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      instance = new InnerLensCore({
        repository: 'owner/repo',
        endpoint: 'http://localhost:3001/api/report',
      });
      instance.mount();

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('submit', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should show error when description is empty', async () => {
      instance = new InnerLensCore({ repository: 'owner/repo', endpoint: '/api/report' });
      instance.mount();
      instance.open();

      const submitBtn = document.querySelector('#inner-lens-submit') as HTMLElement;
      submitBtn?.click();

      await vi.advanceTimersByTimeAsync(0);

      const error = document.querySelector('#inner-lens-error');
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain('description');
    });

    it('should show error when repository is not configured in hosted mode', async () => {
      global.fetch = vi.fn();

      instance = new InnerLensCore({});
      instance.mount();
      instance.open();

      const textarea = document.querySelector('#inner-lens-description') as HTMLTextAreaElement;
      textarea.value = 'Test description';
      textarea.dispatchEvent(new Event('input'));

      const submitBtn = document.querySelector('#inner-lens-submit') as HTMLElement;
      submitBtn?.click();

      await vi.advanceTimersByTimeAsync(0);

      const error = document.querySelector('#inner-lens-error');
      expect(error?.textContent).toContain('Repository');
    });

    it('should call fetch with correct payload on submit', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, issueUrl: 'https://github.com/owner/repo/issues/1' }),
      });
      global.fetch = mockFetch;

      instance = new InnerLensCore({
        repository: 'owner/repo',
        endpoint: '/api/report',
      });
      instance.mount();
      instance.open();

      const textarea = document.querySelector('#inner-lens-description') as HTMLTextAreaElement;
      textarea.value = 'Test bug description';
      textarea.dispatchEvent(new Event('input'));

      const submitBtn = document.querySelector('#inner-lens-submit') as HTMLElement;
      submitBtn?.click();

      await vi.runAllTimersAsync();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/report',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const callBody = JSON.parse((mockFetch.mock.calls[0]?.[1] as { body: string }).body);
      expect(callBody.description).toBe('Test bug description');
      expect(callBody.owner).toBe('owner');
      expect(callBody.repo).toBe('repo');
    });

    it('should include branch in payload when configured', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, issueUrl: 'https://github.com/owner/repo/issues/1' }),
      });
      global.fetch = mockFetch;

      instance = new InnerLensCore({
        repository: 'owner/repo',
        endpoint: '/api/report',
        branch: 'feature/test-branch',
      });
      instance.mount();
      instance.open();

      const textarea = document.querySelector('#inner-lens-description') as HTMLTextAreaElement;
      textarea.value = 'Test bug description';
      textarea.dispatchEvent(new Event('input'));

      const submitBtn = document.querySelector('#inner-lens-submit') as HTMLElement;
      submitBtn?.click();

      await vi.runAllTimersAsync();

      const callBody = JSON.parse((mockFetch.mock.calls[0]?.[1] as { body: string }).body);
      expect(callBody.branch).toBe('feature/test-branch');
    });

    it('should not include branch in payload when not configured', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, issueUrl: 'https://github.com/owner/repo/issues/1' }),
      });
      global.fetch = mockFetch;

      instance = new InnerLensCore({
        repository: 'owner/repo',
        endpoint: '/api/report',
      });
      instance.mount();
      instance.open();

      const textarea = document.querySelector('#inner-lens-description') as HTMLTextAreaElement;
      textarea.value = 'Test bug description';
      textarea.dispatchEvent(new Event('input'));

      const submitBtn = document.querySelector('#inner-lens-submit') as HTMLElement;
      submitBtn?.click();

      await vi.runAllTimersAsync();

      const callBody = JSON.parse((mockFetch.mock.calls[0]?.[1] as { body: string }).body);
      expect(callBody.branch).toBeUndefined();
    });

    it('should call onSuccess callback on successful submit', async () => {
      const onSuccess = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, issueUrl: 'https://github.com/owner/repo/issues/1' }),
      });

      instance = new InnerLensCore({
        repository: 'owner/repo',
        endpoint: '/api/report',
        onSuccess,
      });
      instance.mount();
      instance.open();

      const textarea = document.querySelector('#inner-lens-description') as HTMLTextAreaElement;
      textarea.value = 'Test description';
      textarea.dispatchEvent(new Event('input'));

      const submitBtn = document.querySelector('#inner-lens-submit') as HTMLElement;
      submitBtn?.click();

      await vi.runAllTimersAsync();

      expect(onSuccess).toHaveBeenCalledWith('https://github.com/owner/repo/issues/1');
    });

    it('should call onError callback on failed submit', async () => {
      const onError = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ success: false, message: 'Server error' }),
      });

      instance = new InnerLensCore({
        repository: 'owner/repo',
        endpoint: '/api/report',
        onError,
      });
      instance.mount();
      instance.open();

      const textarea = document.querySelector('#inner-lens-description') as HTMLTextAreaElement;
      textarea.value = 'Test description';
      textarea.dispatchEvent(new Event('input'));

      const submitBtn = document.querySelector('#inner-lens-submit') as HTMLElement;
      submitBtn?.click();

      await vi.runAllTimersAsync();

      expect(onError).toHaveBeenCalled();
    });

    it('should handle network error', async () => {
      const onError = vi.fn();
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Network error'));

      instance = new InnerLensCore({
        repository: 'owner/repo',
        endpoint: '/api/report',
        onError,
      });
      instance.mount();
      instance.open();

      const textarea = document.querySelector('#inner-lens-description') as HTMLTextAreaElement;
      textarea.value = 'Test description';
      textarea.dispatchEvent(new Event('input'));

      const submitBtn = document.querySelector('#inner-lens-submit') as HTMLElement;
      submitBtn?.click();

      await vi.runAllTimersAsync();

      expect(onError).toHaveBeenCalled();
    });

    it('should handle non-JSON error response (e.g., 404 HTML page)', async () => {
      // This test covers the scenario where the server returns a 404 HTML page
      // instead of JSON. Before the fix, this would cause a SyntaxError when
      // trying to parse HTML as JSON.
      const onError = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0')),
      });

      instance = new InnerLensCore({
        repository: 'owner/repo',
        endpoint: '/api/report',
        onError,
      });
      instance.mount();
      instance.open();

      const textarea = document.querySelector('#inner-lens-description') as HTMLTextAreaElement;
      textarea.value = 'Test description';
      textarea.dispatchEvent(new Event('input'));

      const submitBtn = document.querySelector('#inner-lens-submit') as HTMLElement;
      submitBtn?.click();

      await vi.runAllTimersAsync();

      expect(onError).toHaveBeenCalled();
      const errorArg = onError.mock.calls[0]?.[0] as Error | undefined;
      expect(errorArg).toBeDefined();
      expect(errorArg?.message).not.toContain('SyntaxError');
      expect(errorArg?.message).not.toContain('Unexpected token');
    });

    it('should handle timeout error', async () => {
      const onError = vi.fn();
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      global.fetch = vi.fn().mockRejectedValue(abortError);

      instance = new InnerLensCore({
        repository: 'owner/repo',
        endpoint: '/api/report',
        onError,
      });
      instance.mount();
      instance.open();

      const textarea = document.querySelector('#inner-lens-description') as HTMLTextAreaElement;
      textarea.value = 'Test description';
      textarea.dispatchEvent(new Event('input'));

      const submitBtn = document.querySelector('#inner-lens-submit') as HTMLElement;
      submitBtn?.click();

      await vi.runAllTimersAsync();

      expect(onError).toHaveBeenCalled();
      const error = document.querySelector('#inner-lens-error');
      expect(error).not.toBeNull();
    });

    it('should disable submit button during submission', async () => {
      global.fetch = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }), 1000))
      );

      instance = new InnerLensCore({
        repository: 'owner/repo',
        endpoint: '/api/report',
      });
      instance.mount();
      instance.open();

      const textarea = document.querySelector('#inner-lens-description') as HTMLTextAreaElement;
      textarea.value = 'Test description';
      textarea.dispatchEvent(new Event('input'));

      const submitBtn = document.querySelector('#inner-lens-submit') as HTMLButtonElement;
      submitBtn?.click();

      await vi.advanceTimersByTimeAsync(100);

      const submitBtnDuring = document.querySelector('#inner-lens-submit') as HTMLButtonElement;
      expect(submitBtnDuring?.disabled).toBe(true);
    });
  });

  describe('i18n', () => {
    it('should use Korean texts when language is ko', () => {
      instance = new InnerLensCore({ repository: 'owner/repo', language: 'ko' });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      expect(trigger?.getAttribute('aria-label')).toBe('문제 신고');
    });

    it('should use Japanese texts when language is ja', () => {
      instance = new InnerLensCore({ repository: 'owner/repo', language: 'ja' });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      expect(trigger?.getAttribute('aria-label')).toBe('問題を報告');
    });

    it('should fallback to English when language is not supported', () => {
      // This test catches the bug where unsupported language causes undefined texts
      instance = new InnerLensCore({ repository: 'owner/repo', language: 'xyz' as 'en' });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      // Should fallback to English, NOT show undefined or empty
      expect(trigger?.getAttribute('aria-label')).toBe('Report an issue');
    });

    it('should use custom dialogTitle when provided', () => {
      instance = new InnerLensCore({
        repository: 'owner/repo',
        dialogTitle: 'Custom Dialog Title',
      });
      instance.mount();
      instance.open();

      const title = document.querySelector('#inner-lens-title');
      expect(title?.textContent).toContain('Custom Dialog Title');
    });

    it('should use custom buttonText when provided', () => {
      instance = new InnerLensCore({
        repository: 'owner/repo',
        buttonText: 'Custom Button Text',
      });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      expect(trigger?.getAttribute('aria-label')).toBe('Custom Button Text');
    });

    it('should prioritize custom text over language setting', () => {
      // Custom text should override i18n, not the other way around
      instance = new InnerLensCore({
        repository: 'owner/repo',
        language: 'ko',
        buttonText: 'My Custom Button',
      });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      // Should use custom text, NOT Korean translation
      expect(trigger?.getAttribute('aria-label')).toBe('My Custom Button');
    });

    it('should display text content, not show undefined or empty', () => {
      // This test catches the bug where text is missing entirely
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();
      instance.open();

      const title = document.querySelector('#inner-lens-title');
      const submitBtn = document.querySelector('#inner-lens-submit');

      // Text content should exist and not be empty/undefined
      expect(title?.textContent).toBeTruthy();
      expect(title?.textContent).not.toBe('undefined');
      expect(title?.textContent).not.toBe('');
      expect(submitBtn?.textContent).toBeTruthy();
      expect(submitBtn?.textContent).not.toBe('undefined');
    });
  });

  describe('button size', () => {
    it('should render small button', () => {
      instance = new InnerLensCore({ repository: 'owner/repo', buttonSize: 'sm' });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      expect(trigger?.style.width).toBe('40px');
    });

    it('should render medium button', () => {
      instance = new InnerLensCore({ repository: 'owner/repo', buttonSize: 'md' });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      expect(trigger?.style.width).toBe('48px');
    });

    it('should render large button by default', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      expect(trigger?.style.width).toBe('56px');
    });
  });

  describe('button position', () => {
    it('should position button at bottom-right by default', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      expect(trigger?.style.bottom).toBe('20px');
      expect(trigger?.style.right).toBe('20px');
    });

    it('should position button at top-left when specified', () => {
      instance = new InnerLensCore({ repository: 'owner/repo', position: 'top-left' });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      expect(trigger?.style.top).toBe('20px');
      expect(trigger?.style.left).toBe('20px');
    });
  });

  describe('button color', () => {
    it('should use default color', () => {
      instance = new InnerLensCore({ repository: 'owner/repo' });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      expect(trigger?.style.backgroundColor).toBe('rgb(99, 102, 241)');
    });

    it('should use custom color', () => {
      instance = new InnerLensCore({ repository: 'owner/repo', buttonColor: '#ff0000' });
      instance.mount();

      const trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      expect(trigger?.style.backgroundColor).toBe('rgb(255, 0, 0)');
    });
  });
});
