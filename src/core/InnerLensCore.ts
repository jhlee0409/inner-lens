/**
 * InnerLens Core Class
 * Framework-agnostic implementation of the bug reporting widget
 */

import type { LogEntry, BugReportPayload, BugReportResponse } from '../types';
import {
  initLogCapture,
  getCapturedLogs,
  clearCapturedLogs,
} from '../utils/log-capture';
import { maskSensitiveData } from '../utils/masking';
import { createStyles, keyframesCSS, type StyleConfig } from '../utils/styles';

export interface InnerLensCoreConfig {
  /**
   * API endpoint to submit bug reports
   * @default '/api/inner-lens/report'
   */
  endpoint?: string;

  /**
   * GitHub repository in format "owner/repo"
   */
  repository?: string;

  /**
   * Custom labels to add to created issues
   * @default ['bug', 'inner-lens']
   */
  labels?: string[];

  /**
   * Enable/disable console log capture
   * @default true
   */
  captureConsoleLogs?: boolean;

  /**
   * Maximum number of log entries to capture
   * @default 50
   */
  maxLogEntries?: number;

  /**
   * Enable/disable sensitive data masking
   * @default true
   */
  maskSensitiveData?: boolean;

  /**
   * Custom CSS styles for the widget
   */
  styles?: StyleConfig;

  // ============================================
  // Convenience Options (mapped to styles)
  // ============================================

  /**
   * Button position (convenience option, maps to styles.buttonPosition)
   * @default 'bottom-right'
   */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

  /**
   * Button color (convenience option, maps to styles.buttonColor)
   * @default '#6366f1'
   */
  buttonColor?: string;

  // ============================================
  // UI Text Customization
  // ============================================

  /**
   * Trigger button aria-label and title
   * @default 'Report a bug'
   */
  buttonText?: string;

  /**
   * Dialog title text
   * @default 'Report an Issue'
   */
  dialogTitle?: string;

  /**
   * Textarea label text
   * @default 'Describe the issue'
   */
  dialogDescription?: string;

  /**
   * Submit button text
   * @default 'Submit Report'
   */
  submitText?: string;

  /**
   * Cancel button text
   * @default 'Cancel'
   */
  cancelText?: string;

  /**
   * Success message title
   * @default 'Report Submitted'
   */
  successMessage?: string;

  // ============================================
  // Callbacks
  // ============================================

  /**
   * Callback when report is successfully submitted
   */
  onSuccess?: (issueUrl?: string) => void;

  /**
   * Callback when report submission fails
   */
  onError?: (error: Error) => void;

  /**
   * Callback when dialog opens
   */
  onOpen?: () => void;

  /**
   * Callback when dialog closes
   */
  onClose?: () => void;

  /**
   * Disable the widget entirely
   * @default false
   */
  disabled?: boolean;

  /**
   * Only show widget in development environment (NODE_ENV !== 'production')
   * @default true
   */
  devOnly?: boolean;

  /**
   * Custom container element (defaults to document.body)
   */
  container?: HTMLElement;
}

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

/**
 * InnerLens Core - Framework-agnostic bug reporting widget
 *
 * @example
 * ```ts
 * import { InnerLensCore } from 'inner-lens';
 *
 * const innerLens = new InnerLensCore({
 *   endpoint: '/api/bug-report',
 *   repository: 'owner/repo',
 * });
 *
 * innerLens.mount();
 * ```
 */
export class InnerLensCore {
  private config: Required<
    Pick<
      InnerLensCoreConfig,
      | 'endpoint'
      | 'labels'
      | 'captureConsoleLogs'
      | 'maxLogEntries'
      | 'maskSensitiveData'
      | 'disabled'
      | 'devOnly'
      | 'buttonText'
      | 'dialogTitle'
      | 'dialogDescription'
      | 'submitText'
      | 'cancelText'
      | 'successMessage'
    >
  > &
    InnerLensCoreConfig;

  private container: HTMLElement | null = null;
  private widgetRoot: HTMLElement | null = null;
  private isOpen = false;
  private submissionState: SubmissionState = 'idle';
  private description = '';
  private logs: LogEntry[] = [];
  private errorMessage: string | null = null;
  private issueUrl: string | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private mounted = false;

  constructor(config: InnerLensCoreConfig = {}) {
    // Map convenience options to styles
    const mergedStyles: StyleConfig = {
      ...config.styles,
      buttonPosition: config.position ?? config.styles?.buttonPosition ?? 'bottom-right',
      buttonColor: config.buttonColor ?? config.styles?.buttonColor ?? '#6366f1',
    };

    this.config = {
      endpoint: '/api/inner-lens/report',
      labels: ['bug', 'inner-lens'],
      captureConsoleLogs: true,
      maxLogEntries: 50,
      maskSensitiveData: true,
      disabled: false,
      devOnly: true,
      // UI Text defaults
      buttonText: 'Report a bug',
      dialogTitle: 'Report an Issue',
      dialogDescription: 'Describe the issue',
      submitText: 'Submit Report',
      cancelText: 'Cancel',
      successMessage: 'Report Submitted',
      ...config,
      styles: mergedStyles,
    };
  }

  /**
   * Check if widget should be disabled based on environment
   */
  private isDisabledByEnvironment(): boolean {
    if (this.config.disabled) return true;
    if (this.config.devOnly) {
      let isProduction = false;

      // Check for Vite's import.meta.env.PROD
      // @ts-expect-error import.meta.env is Vite-specific
      if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
        isProduction = true;
      }
      // Check for Node.js / webpack / other bundlers
      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
        isProduction = true;
      }

      if (isProduction) {
        // Log info message for developers checking console
        if (typeof console !== 'undefined' && console.info) {
          console.info(
            '[inner-lens] Widget disabled in production (devOnly: true). ' +
            'Set devOnly: false to enable in production. ' +
            'See: https://github.com/jhlee0409/inner-lens#-configuration'
          );
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Mount the widget to the DOM
   */
  mount(container?: HTMLElement): void {
    if (this.mounted || this.isDisabledByEnvironment()) return;

    if (typeof window === 'undefined') {
      console.warn('InnerLens: Cannot mount in non-browser environment');
      return;
    }

    this.container = container ?? this.config.container ?? document.body;

    // Initialize log capture
    if (this.config.captureConsoleLogs) {
      initLogCapture({
        maxEntries: this.config.maxLogEntries,
        maskSensitiveData: this.config.maskSensitiveData,
      });
    }

    // Inject styles
    this.injectStyles();

    // Create widget root
    this.widgetRoot = document.createElement('div');
    this.widgetRoot.id = 'inner-lens-widget';
    this.widgetRoot.setAttribute('data-inner-lens', 'true');
    this.container.appendChild(this.widgetRoot);

    // Render trigger button
    this.renderTrigger();

    // Setup keyboard listener
    document.addEventListener('keydown', this.handleKeyDown);

    this.mounted = true;
  }

  /**
   * Unmount the widget from the DOM
   */
  unmount(): void {
    if (!this.mounted) return;

    document.removeEventListener('keydown', this.handleKeyDown);

    if (this.widgetRoot) {
      this.widgetRoot.remove();
      this.widgetRoot = null;
    }

    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }

    this.mounted = false;
  }

  /**
   * Programmatically open the dialog
   */
  open(): void {
    if (this.isDisabledByEnvironment() || !this.mounted) return;
    this.isOpen = true;
    this.logs = getCapturedLogs();
    this.render();
    this.config.onOpen?.();
  }

  /**
   * Programmatically close the dialog
   */
  close(): void {
    this.isOpen = false;
    this.submissionState = 'idle';
    this.errorMessage = null;
    this.description = '';
    this.issueUrl = null;
    this.render();
    this.config.onClose?.();
  }

  /**
   * Check if widget is currently open
   */
  get isDialogOpen(): boolean {
    return this.isOpen;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isOpen) {
      this.close();
      return;
    }

    // Focus trap: keep focus within dialog
    if (e.key === 'Tab' && this.isOpen && this.widgetRoot) {
      const dialog = this.widgetRoot.querySelector('#inner-lens-dialog');
      if (!dialog) return;

      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button, textarea, input, a[href], [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  private injectStyles(): void {
    if (this.styleElement) return;

    this.styleElement = document.createElement('style');
    this.styleElement.textContent = keyframesCSS;
    this.styleElement.setAttribute('data-inner-lens-styles', 'true');
    document.head.appendChild(this.styleElement);
  }

  private renderTrigger(): void {
    if (!this.widgetRoot) return;

    const styles = createStyles(this.config.styles);

    this.widgetRoot.innerHTML = `
      <button
        type="button"
        id="inner-lens-trigger"
        aria-label="${this.escapeHtml(this.config.buttonText)}"
        title="${this.escapeHtml(this.config.buttonText)}"
        style="${this.styleToString(styles.triggerButton)}"
      >
        ${this.getBugIcon()}
      </button>
    `;

    const trigger = this.widgetRoot.querySelector('#inner-lens-trigger');
    trigger?.addEventListener('click', () => this.open());
    trigger?.addEventListener('mouseenter', (e) => {
      const btn = e.target as HTMLElement;
      btn.style.transform = 'scale(1.05)';
      btn.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
    });
    trigger?.addEventListener('mouseleave', (e) => {
      const btn = e.target as HTMLElement;
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    });
  }

  private render(): void {
    if (!this.widgetRoot) return;

    const styles = createStyles(this.config.styles);

    if (!this.isOpen) {
      this.renderTrigger();
      return;
    }

    const successContent = this.submissionState === 'success' ? this.renderSuccess(styles) : '';
    const formContent = this.submissionState !== 'success' ? this.renderForm(styles) : '';

    this.widgetRoot.innerHTML = `
      <button
        type="button"
        id="inner-lens-trigger"
        aria-label="${this.escapeHtml(this.config.buttonText)}"
        title="${this.escapeHtml(this.config.buttonText)}"
        style="${this.styleToString(styles.triggerButton)}"
      >
        ${this.getBugIcon()}
      </button>
      <div
        id="inner-lens-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inner-lens-title"
        style="${this.styleToString(styles.overlay)}"
      >
        <div id="inner-lens-dialog" style="${this.styleToString(styles.dialog)}">
          <div style="${this.styleToString(styles.header)}">
            <h2 id="inner-lens-title" style="${this.styleToString(styles.headerTitle)}">
              ${this.escapeHtml(this.config.dialogTitle)}
            </h2>
            <button
              type="button"
              id="inner-lens-close"
              aria-label="Close"
              style="${this.styleToString(styles.closeButton)}"
            >
              ${this.getCloseIcon()}
            </button>
          </div>
          ${successContent}
          ${formContent}
        </div>
      </div>
    `;

    this.attachEventListeners(styles);
  }

  private renderSuccess(styles: ReturnType<typeof createStyles>): string {
    return `
      <div style="${this.styleToString(styles.successMessage)}" role="status" aria-live="polite">
        <div style="${this.styleToString(styles.successIcon)}" aria-hidden="true">
          ${this.getCheckIcon()}
        </div>
        <h3 style="${this.styleToString({ ...styles.headerTitle, marginBottom: '8px' })}">
          ${this.escapeHtml(this.config.successMessage)}
        </h3>
        <p style="color: #4b5563; font-size: 14px; margin-bottom: 16px;">
          Thank you for your feedback! Our team will look into this.
        </p>
        ${
          this.issueUrl
            ? `<a href="${this.issueUrl}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: underline; font-size: 14px;">
                View Issue on GitHub
              </a>`
            : ''
        }
      </div>
    `;
  }

  private renderForm(styles: ReturnType<typeof createStyles>): string {
    const logsHtml = this.logs.length > 0 ? this.renderLogs(styles) : '';
    const errorHtml =
      this.submissionState === 'error' && this.errorMessage
        ? `<div style="${this.styleToString(styles.errorMessage)}">${this.escapeHtml(this.errorMessage)}</div>`
        : '';

    return `
      <div style="${this.styleToString(styles.content)}">
        <label style="${this.styleToString(styles.label)}" for="inner-lens-description">
          ${this.escapeHtml(this.config.dialogDescription)}
        </label>
        <textarea
          id="inner-lens-description"
          placeholder="What went wrong? Please be as specific as possible..."
          style="${this.styleToString(styles.textarea)}"
        >${this.escapeHtml(this.description)}</textarea>

        ${logsHtml}

        <div style="${this.styleToString(styles.privacyNotice)}">
          <strong>Privacy Notice:</strong> Sensitive data (emails, API keys, tokens) is automatically masked before submission.
        </div>

        ${errorHtml}
      </div>

      <div style="${this.styleToString(styles.footer)}">
        <button
          type="button"
          id="inner-lens-cancel"
          style="${this.styleToString(styles.cancelButton)}"
        >
          ${this.escapeHtml(this.config.cancelText)}
        </button>
        <button
          type="button"
          id="inner-lens-submit"
          ${this.submissionState === 'submitting' ? 'disabled' : ''}
          style="${this.styleToString({
            ...styles.submitButton,
            ...(this.submissionState === 'submitting' ? styles.submitButtonDisabled : {}),
          })}"
        >
          ${
            this.submissionState === 'submitting'
              ? `<span style="display: flex; align-items: center; gap: 8px; justify-content: center;" role="status" aria-live="polite">
                  <span style="${this.styleToString(styles.spinner)}" aria-hidden="true"></span>
                  Submitting...
                </span>`
              : this.escapeHtml(this.config.submitText)
          }
        </button>
      </div>
    `;
  }

  private renderLogs(styles: ReturnType<typeof createStyles>): string {
    const recentLogs = this.logs.slice(-10);
    const logsHtml = recentLogs
      .map((log) => {
        const levelStyle =
          log.level === 'error'
            ? styles.logError
            : log.level === 'warn'
              ? styles.logWarn
              : {};
        const message = this.escapeHtml(log.message.slice(0, 100));
        const truncated = log.message.length > 100 ? '...' : '';
        return `
          <div style="${this.styleToString({ ...styles.logEntry, ...levelStyle })}">
            [${log.level.toUpperCase()}] ${message}${truncated}
          </div>
        `;
      })
      .join('');

    return `
      <div style="${this.styleToString(styles.logPreview)}">
        <div style="${this.styleToString(styles.logPreviewHeader)}">
          <span style="${this.styleToString(styles.logPreviewTitle)}">Captured Logs</span>
          <span style="${this.styleToString(styles.logCount)}">
            ${this.logs.length} ${this.logs.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <div style="${this.styleToString(styles.logList)}">
          ${logsHtml}
        </div>
      </div>
    `;
  }

  private attachEventListeners(styles: ReturnType<typeof createStyles>): void {
    const overlay = this.widgetRoot?.querySelector('#inner-lens-overlay');
    const dialog = this.widgetRoot?.querySelector('#inner-lens-dialog');
    const closeBtn = this.widgetRoot?.querySelector('#inner-lens-close') as HTMLElement;
    const cancelBtn = this.widgetRoot?.querySelector('#inner-lens-cancel');
    const submitBtn = this.widgetRoot?.querySelector('#inner-lens-submit');
    const textarea = this.widgetRoot?.querySelector(
      '#inner-lens-description'
    ) as HTMLTextAreaElement;
    const trigger = this.widgetRoot?.querySelector('#inner-lens-trigger');

    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    dialog?.addEventListener('click', (e) => e.stopPropagation());
    closeBtn?.addEventListener('click', () => this.close());
    closeBtn?.addEventListener('mouseenter', () => {
      if (closeBtn) closeBtn.style.backgroundColor = '#f3f4f6';
    });
    closeBtn?.addEventListener('mouseleave', () => {
      if (closeBtn) closeBtn.style.backgroundColor = 'transparent';
    });
    cancelBtn?.addEventListener('click', () => this.close());
    submitBtn?.addEventListener('click', () => this.submit());
    trigger?.addEventListener('click', () => this.open());

    textarea?.addEventListener('input', (e) => {
      this.description = (e.target as HTMLTextAreaElement).value;
    });

    textarea?.addEventListener('focus', () => {
      if (textarea) {
        textarea.style.borderColor = this.config.styles?.buttonColor ?? '#6366f1';
        textarea.style.boxShadow = `0 0 0 3px ${this.config.styles?.buttonColor ?? '#6366f1'}20`;
      }
    });

    textarea?.addEventListener('blur', () => {
      if (textarea) {
        textarea.style.borderColor = '#d1d5db';
        textarea.style.boxShadow = 'none';
      }
    });

    // Focus textarea after render
    setTimeout(() => textarea?.focus(), 100);
  }

  private async submit(): Promise<void> {
    if (!this.description.trim()) {
      this.errorMessage = 'Please provide a description of the issue.';
      this.render();
      return;
    }

    this.submissionState = 'submitting';
    this.errorMessage = null;
    this.render();

    try {
      const payload: BugReportPayload = {
        description: this.config.maskSensitiveData
          ? maskSensitiveData(this.description)
          : this.description,
        logs: this.logs,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: Date.now(),
        metadata: {
          repository: this.config.repository,
          labels: this.config.labels,
        },
      };

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { message?: string }).message ||
            `Failed to submit report (${response.status})`
        );
      }

      const data = (await response.json()) as BugReportResponse;

      this.submissionState = 'success';
      this.issueUrl = data.issueUrl ?? null;
      clearCapturedLogs();

      this.config.onSuccess?.(data.issueUrl);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.submissionState = 'error';
      this.errorMessage = err.message;
      this.config.onError?.(err);
    }

    this.render();
  }

  private styleToString(style: Record<string, string | number | undefined>): string {
    return Object.entries(style)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${cssKey}: ${value}`;
      })
      .join('; ');
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private getBugIcon(): string {
    return `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3 3 0 1 1 6 0v1" />
        <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z" />
        <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
      </svg>
    `;
  }

  private getCloseIcon(): string {
    return `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    `;
  }

  private getCheckIcon(): string {
    return `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    `;
  }
}
