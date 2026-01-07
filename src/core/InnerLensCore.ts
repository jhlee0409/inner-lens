/**
 * InnerLens Core Class
 * Framework-agnostic implementation of the bug reporting widget
 */

import type {
  LogEntry,
  BugReportPayload,
  BugReportResponse,
  WidgetLanguage,
  UserAction,
  NavigationEntry,
  PerformanceSummary,
  PageContext,
} from '../types';
import { WIDGET_TEXTS, HOSTED_API_ENDPOINT } from '../types';
import {
  initLogCapture,
  getCapturedLogs,
  clearCapturedLogs,
  restoreConsole,
} from '../utils/log-capture';
import {
  initUserActionCapture,
  getCapturedUserActions,
  clearCapturedUserActions,
  stopUserActionCapture,
} from '../utils/user-action-capture';
import {
  initNavigationCapture,
  getCapturedNavigations,
  clearCapturedNavigations,
  stopNavigationCapture,
} from '../utils/navigation-capture';
import {
  initPerformanceCapture,
  getPerformanceData,
  stopPerformanceCapture,
} from '../utils/performance-capture';
import type { SessionReplayData } from '../utils/session-replay';
import { maskSensitiveData } from '../utils/masking';
import { createStyles, keyframesCSS, type StyleConfig } from '../utils/styles';

export interface InnerLensCoreConfig {
  /**
   * API endpoint to submit bug reports
   * @default HOSTED_API_ENDPOINT (for hosted mode)
   */
  endpoint?: string;

  /**
   * GitHub repository in format "owner/repo"
   */
  repository?: string;

  /**
   * Custom labels to add to created issues
   * @default ['inner-lens']
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

  // ============================================
  // Extended Capture Options
  // ============================================

  /**
   * Enable/disable user action tracking (clicks, inputs, etc.)
   * @default true
   */
  captureUserActions?: boolean;

  /**
   * Enable/disable navigation tracking
   * @default true
   */
  captureNavigation?: boolean;

  /**
   * Enable/disable performance metrics (Core Web Vitals)
   * @default true
   */
  capturePerformance?: boolean;

  /**
   * Enable/disable session replay recording
   * @default false (opt-in due to size)
   */
  captureSessionReplay?: boolean;

  /**
   * Custom CSS styles for the widget
   */
  styles?: StyleConfig;

  /**
   * Widget UI language
   * @default 'en'
   */
  language?: WidgetLanguage;

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

  /**
   * Button size (convenience option, maps to styles.buttonSize)
   * @default 'lg'
   */
  buttonSize?: 'sm' | 'md' | 'lg';

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

  hidden?: boolean;

  disabled?: boolean;

  reporter?: {
    name: string;
    email?: string;
    id?: string;
  };

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
      | 'captureUserActions'
      | 'captureNavigation'
      | 'capturePerformance'
      | 'captureSessionReplay'
      | 'hidden'
      | 'disabled'
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
  private userActions: UserAction[] = [];
  private navigations: NavigationEntry[] = [];
  private performance: PerformanceSummary | null = null;
  private sessionReplayData: SessionReplayData | null = null;
  private pageContext: PageContext | null = null;
  private pageLoadTime: number = Date.now();
  private errorMessage: string | null = null;
  private issueUrl: string | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private mounted = false;
  private sessionReplayModule: typeof import('../utils/session-replay') | null = null;

  private async loadSessionReplayModule() {
    if (this.sessionReplayModule) return this.sessionReplayModule;
    try {
      this.sessionReplayModule = await import('../utils/session-replay');
      return this.sessionReplayModule;
    } catch {
      console.warn('[inner-lens] Session replay requires rrweb. Install with: npm install rrweb');
      return null;
    }
  }

  constructor(config: InnerLensCoreConfig = {}) {
    const mergedStyles: StyleConfig = {
      ...config.styles,
      buttonPosition: config.position ?? config.styles?.buttonPosition ?? 'bottom-right',
      buttonColor: config.buttonColor ?? config.styles?.buttonColor ?? '#6366f1',
      buttonSize: config.buttonSize ?? config.styles?.buttonSize ?? 'lg',
    };

    // Get i18n texts based on language
    const lang = config.language ?? 'en';
    const texts = WIDGET_TEXTS[lang] ?? WIDGET_TEXTS.en;

    this.config = {
      endpoint: HOSTED_API_ENDPOINT,
      labels: ['inner-lens'],
      captureConsoleLogs: true,
      maxLogEntries: 50,
      maskSensitiveData: true,
      // Extended capture options
      captureUserActions: true,
      captureNavigation: true,
      capturePerformance: true,
      captureSessionReplay: false,
      hidden: false,
      disabled: false,
      language: lang,
      // UI Text defaults from i18n (can be overridden by config)
      buttonText: texts.buttonText,
      dialogTitle: texts.dialogTitle,
      dialogDescription: texts.dialogDescription,
      submitText: texts.submitText,
      cancelText: texts.cancelText,
      successMessage: texts.successMessage,
      ...config,
      styles: mergedStyles,
    };
  }

  /**
   * Get i18n texts for the current language
   */
  private getTexts() {
    const lang = this.config.language ?? 'en';
    return WIDGET_TEXTS[lang] ?? WIDGET_TEXTS.en;
  }

  private isHidden(): boolean {
    return this.config.hidden === true;
  }

  private isDisabled(): boolean {
    return this.config.disabled === true;
  }

  /**
   * Mount the widget to the DOM
   */
  mount(container?: HTMLElement): void {
    if (this.mounted || this.isHidden()) return;

    if (typeof window === 'undefined') {
      console.warn('[inner-lens] Cannot mount in non-browser environment');
      return;
    }

    if (this.config.endpoint === HOSTED_API_ENDPOINT) {
      const [owner, repo] = (this.config.repository || '').split('/');
      if (!owner || !repo) {
        console.warn('[inner-lens] Missing or invalid repository. Expected format: "owner/repo". Bug reports will fail until configured.');
      }
    }

    const existingWidget = document.querySelector('#inner-lens-widget');
    if (existingWidget) {
      console.warn('[inner-lens] Widget already mounted. Multiple instances are not supported.');
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

    // Initialize user action capture
    if (this.config.captureUserActions) {
      initUserActionCapture({
        maskSensitiveData: this.config.maskSensitiveData,
      });
    }

    // Initialize navigation capture
    if (this.config.captureNavigation) {
      initNavigationCapture({
        maskSensitiveData: this.config.maskSensitiveData,
      });
    }

    // Initialize performance capture
    if (this.config.capturePerformance) {
      initPerformanceCapture();
    }

    // Initialize session replay (async, non-blocking)
    if (this.config.captureSessionReplay) {
      this.loadSessionReplayModule().then((mod) => {
        mod?.startSessionReplay({ maskInputs: true }).catch((err: Error) => {
          console.warn('[inner-lens] Session replay failed to start:', err);
        });
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

    // Stop all capture modules
    if (this.config.captureConsoleLogs) {
      restoreConsole();
    }
    if (this.config.captureUserActions) {
      stopUserActionCapture();
    }
    if (this.config.captureNavigation) {
      stopNavigationCapture();
    }
    if (this.config.capturePerformance) {
      stopPerformanceCapture();
    }
    if (this.config.captureSessionReplay && this.sessionReplayModule) {
      this.sessionReplayModule.stopSessionReplay();
    }

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
    if (this.isHidden() || !this.mounted) return;
    this.isOpen = true;

    // Collect all captured data
    this.logs = getCapturedLogs();

    if (this.config.captureUserActions) {
      this.userActions = getCapturedUserActions();
    }

    if (this.config.captureNavigation) {
      this.navigations = getCapturedNavigations();
    }

    if (this.config.capturePerformance) {
      const perfData = getPerformanceData();
      this.performance = {
        coreWebVitals: perfData.coreWebVitals,
        timing: perfData.timing,
        resourceCount: perfData.resources.total,
        memoryUsage: perfData.memory?.usedJSHeapSize,
      };
    }

    if (this.config.captureSessionReplay && this.sessionReplayModule) {
      this.sessionReplayData = this.sessionReplayModule.getSessionReplaySnapshot();
    }

    this.pageContext = this.capturePageContext();

    this.render();
    this.config.onOpen?.();
  }

  private capturePageContext(): PageContext {
    return {
      route: window.location.href,
      pathname: window.location.pathname,
      hash: window.location.hash,
      title: document.title,
      timeOnPage: Date.now() - this.pageLoadTime,
      referrer: document.referrer || undefined,
      componentStack: this.getReactComponentStack(),
    };
  }

  private getReactComponentStack(): string | undefined {
    const errorBoundaryStack = (window as Window & { __INNER_LENS_COMPONENT_STACK__?: string }).__INNER_LENS_COMPONENT_STACK__;
    if (errorBoundaryStack) {
      return errorBoundaryStack;
    }

    const reactRoot = document.getElementById('root') || document.getElementById('__next');
    if (reactRoot) {
      const fiberKey = Object.keys(reactRoot).find(key => key.startsWith('__reactFiber$'));
      if (fiberKey) {
        try {
          const fiber = (reactRoot as unknown as Record<string, unknown>)[fiberKey] as { type?: { name?: string }; return?: unknown } | undefined;
          const componentNames: string[] = [];
          let current = fiber;
          let depth = 0;
          const MAX_DEPTH = 10;

          while (current && depth < MAX_DEPTH) {
            if (current.type && typeof current.type === 'function' && current.type.name) {
              componentNames.push(current.type.name);
            }
            current = current.return as typeof fiber;
            depth++;
          }

          if (componentNames.length > 0) {
            return componentNames.reverse().join(' > ');
          }
        } catch {
          return undefined;
        }
      }
    }

    return undefined;
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
    const iconSize = styles.iconSize as number;
    const isDisabled = this.isDisabled();
    const disabledStyles = isDisabled ? 'opacity: 0.5; cursor: not-allowed;' : '';

    this.widgetRoot.innerHTML = `
      <button
        type="button"
        id="inner-lens-trigger"
        aria-label="${this.escapeHtml(this.config.buttonText)}"
        title="${this.escapeHtml(this.config.buttonText)}"
        ${isDisabled ? 'disabled' : ''}
        style="${this.styleToString(styles.triggerButton)}${disabledStyles}"
      >
        ${this.getBugIcon(iconSize)}
      </button>
    `;

    const trigger = this.widgetRoot.querySelector('#inner-lens-trigger');
    if (!isDisabled) {
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
  }

  private render(): void {
    if (!this.widgetRoot) return;

    const styles = createStyles(this.config.styles);
    const iconSize = styles.iconSize as number;

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
        ${this.getBugIcon(iconSize)}
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
    const t = this.getTexts();
    return `
      <div style="${this.styleToString(styles.successMessage)}" role="status" aria-live="polite">
        <div style="${this.styleToString(styles.successIcon)}" aria-hidden="true">
          ${this.getCheckIcon()}
        </div>
        <h3 style="${this.styleToString({ ...styles.headerTitle, marginBottom: '8px' })}">
          ${this.escapeHtml(this.config.successMessage ?? t.successMessage)}
        </h3>
        <p style="color: #4b5563; font-size: 14px; margin-bottom: 16px;">
          ${this.escapeHtml(t.successDescription)}
        </p>
        ${
          this.issueUrl
            ? `<a href="${this.issueUrl}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: underline; font-size: 14px;">
                ${this.escapeHtml(t.viewIssue)}
              </a>`
            : ''
        }
      </div>
    `;
  }

  private renderForm(styles: ReturnType<typeof createStyles>): string {
    const t = this.getTexts();
    const logsHtml = this.logs.length > 0 ? this.renderLogs(styles) : '';
    const hasError = this.submissionState === 'error' && this.errorMessage !== null;
    const errorHtml = hasError && this.errorMessage
      ? `<div id="inner-lens-error" role="alert" style="${this.styleToString(styles.errorMessage)}">${this.escapeHtml(this.errorMessage)}</div>`
      : '';

    return `
      <div style="${this.styleToString(styles.content)}">
        <label style="${this.styleToString(styles.label)}" for="inner-lens-description">
          ${this.escapeHtml(this.config.dialogDescription ?? t.dialogDescription)}
        </label>
        <textarea
          id="inner-lens-description"
          placeholder="${this.escapeHtml(t.placeholder)}"
          style="${this.styleToString(styles.textarea)}"
          maxlength="10000"
          aria-required="true"
          ${hasError ? 'aria-invalid="true" aria-describedby="inner-lens-error"' : ''}
        >${this.escapeHtml(this.description)}</textarea>

        ${logsHtml}

        <div style="${this.styleToString(styles.privacyNotice)}">
          ${this.escapeHtml(t.privacyNotice)}
        </div>

        ${errorHtml}
      </div>

      <div style="${this.styleToString(styles.footer)}">
        <button
          type="button"
          id="inner-lens-cancel"
          style="${this.styleToString(styles.cancelButton)}"
        >
          ${this.escapeHtml(this.config.cancelText ?? t.cancelText)}
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
                  <span class="inner-lens-spinner" aria-hidden="true"></span>
                  ${this.escapeHtml(t.submitting)}
                </span>`
              : this.escapeHtml(this.config.submitText ?? t.submitText)
          }
        </button>
      </div>
    `;
  }

  private renderLogs(styles: ReturnType<typeof createStyles>): string {
    const t = this.getTexts();
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
          <span style="${this.styleToString(styles.logPreviewTitle)}">${this.escapeHtml(t.capturedLogs)}</span>
          <span style="${this.styleToString(styles.logCount)}">
            ${this.logs.length} ${this.logs.length === 1 ? t.entry : t.entries}
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
      this.submissionState = 'error';
      this.errorMessage = this.getTexts().descriptionRequired;
      this.render();
      return;
    }

    this.submissionState = 'submitting';
    this.errorMessage = null;
    this.render();

    try {
      // Parse owner/repo from repository string (e.g., "owner/repo")
      const [parsedOwner, parsedRepo] = (this.config.repository || '').split('/');
      const owner = parsedOwner ?? '';
      const repo = parsedRepo ?? '';

      if (this.config.endpoint === HOSTED_API_ENDPOINT && (!owner || !repo)) {
        this.submissionState = 'error';
        this.errorMessage = this.getTexts().repositoryNotConfigured;
        this.render();
        return;
      }

      // Prepare session replay data if available
      let sessionReplayBase64: string | undefined;
      if (this.sessionReplayData && this.sessionReplayData.events.length > 0 && this.sessionReplayModule) {
        try {
          const compressed = await this.sessionReplayModule.compressReplayData(this.sessionReplayData);
          const buffer = await compressed.arrayBuffer();
          sessionReplayBase64 = btoa(
            String.fromCharCode(...new Uint8Array(buffer))
          );
        } catch (error) {
          console.warn('[inner-lens] Session replay compression failed, using uncompressed:', error);
          sessionReplayBase64 = btoa(
            JSON.stringify(this.sessionReplayData.events)
          );
        }
      }

      const payload: BugReportPayload = {
        description: this.config.maskSensitiveData
          ? maskSensitiveData(this.description)
          : this.description,
        logs: this.logs,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: Date.now(),
        // Centralized mode: send owner/repo directly
        owner: owner || undefined,
        repo: repo || undefined,
        // Extended context
        userActions: this.userActions.length > 0 ? this.userActions : undefined,
        navigations: this.navigations.length > 0 ? this.navigations : undefined,
        performance: this.performance ?? undefined,
        sessionReplay: sessionReplayBase64,
        pageContext: this.pageContext ?? undefined,
        reporter: this.config.reporter,
        metadata: {
          repository: this.config.repository,
          labels: this.config.labels,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await response.json()) as BugReportResponse;

      if (!response.ok) {
        const texts = this.getTexts();
        if (data.errorCode === 'DAILY_LIMIT_EXCEEDED') {
          throw new Error(texts.dailyLimitExceeded);
        }
        if (data.errorCode === 'RATE_LIMIT_EXCEEDED') {
          throw new Error(texts.rateLimitExceeded);
        }
        throw new Error(
          data.message || texts.submitError
        );
      }

      this.submissionState = 'success';
      this.issueUrl = data.issueUrl ?? null;

      // Clear all captured data after successful submission
      clearCapturedLogs();
      if (this.config.captureUserActions) {
        clearCapturedUserActions();
      }
      if (this.config.captureNavigation) {
        clearCapturedNavigations();
      }
      if (this.config.captureSessionReplay && this.sessionReplayModule) {
        this.sessionReplayModule.stopSessionReplay();
        this.sessionReplayModule.startSessionReplay({ maskInputs: true }).catch((err: Error) => {
          console.warn('[inner-lens] Session replay restart failed:', err.message);
        });
      }

      this.config.onSuccess?.(data.issueUrl);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.submissionState = 'error';
      
      const texts = this.getTexts();
      const isTimeoutError = err.name === 'AbortError';
      const networkErrorPatterns = ['fetch', 'network', 'Network', 'NetworkError'];
      const isNetworkError = err.name === 'TypeError' || 
        networkErrorPatterns.some(pattern => err.message.includes(pattern));
      
      if (isTimeoutError) {
        this.errorMessage = texts.timeoutError;
      } else if (isNetworkError) {
        this.errorMessage = texts.networkError;
      } else {
        this.errorMessage = err.message;
      }
      
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

  private getBugIcon(size: number = 24): string {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
