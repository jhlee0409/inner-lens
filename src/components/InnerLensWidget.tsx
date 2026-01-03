'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
} from 'react';
import type { InnerLensConfig, LogEntry, BugReportPayload, WidgetLanguage } from '../types';
import { WIDGET_TEXTS, HOSTED_API_ENDPOINT } from '../types';
import {
  initLogCapture,
  getCapturedLogs,
  clearCapturedLogs,
} from '../utils/log-capture';
import { createStyles, keyframesCSS } from '../utils/styles';
import { maskSensitiveData } from '../utils/masking';

interface InnerLensWidgetProps extends InnerLensConfig {}

// Icons as inline SVG components
const BugIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3 3 0 1 1 6 0v1" />
    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z" />
    <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

export function InnerLensWidget({
  endpoint,
  repository,
  labels = ['inner-lens'],
  captureConsoleLogs = true,
  maxLogEntries = 50,
  maskSensitiveData: enableMasking = true,
  styles: styleConfig,
  language = 'en',
  // Convenience options (map to styles)
  position,
  buttonColor,
  // UI text customization (override i18n defaults)
  buttonText,
  dialogTitle,
  dialogDescription,
  submitText,
  cancelText,
  successMessage,
  // Callbacks
  onSuccess,
  onError,
  onOpen,
  onClose,
  trigger,
  disabled = false,
  devOnly = true,
}: InnerLensWidgetProps) {
  // Get i18n texts with custom overrides
  const texts = WIDGET_TEXTS[language] ?? WIDGET_TEXTS.en;
  const t = {
    buttonText: buttonText ?? texts.buttonText,
    dialogTitle: dialogTitle ?? texts.dialogTitle,
    dialogDescription: dialogDescription ?? texts.dialogDescription,
    placeholder: texts.placeholder,
    submitText: submitText ?? texts.submitText,
    cancelText: cancelText ?? texts.cancelText,
    successMessage: successMessage ?? texts.successMessage,
    successDescription: texts.successDescription,
    viewIssue: texts.viewIssue,
    capturedLogs: texts.capturedLogs,
    entry: texts.entry,
    entries: texts.entries,
    privacyNotice: texts.privacyNotice,
    submitting: texts.submitting,
  };
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const styleInjectedRef = useRef(false);

  // Merge convenience options with styleConfig
  const mergedStyleConfig = {
    ...styleConfig,
    buttonPosition: position ?? styleConfig?.buttonPosition ?? 'bottom-right',
    buttonColor: buttonColor ?? styleConfig?.buttonColor ?? '#6366f1',
  };
  const styles = createStyles(mergedStyleConfig);

  // Inject keyframe animation CSS
  useEffect(() => {
    if (typeof window === 'undefined' || styleInjectedRef.current) return;

    const styleEl = document.createElement('style');
    styleEl.textContent = keyframesCSS;
    styleEl.setAttribute('data-inner-lens', 'true');
    document.head.appendChild(styleEl);
    styleInjectedRef.current = true;

    return () => {
      const existingStyle = document.querySelector('style[data-inner-lens]');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // Initialize log capture
  useEffect(() => {
    if (captureConsoleLogs) {
      initLogCapture({
        maxEntries: maxLogEntries,
        maskSensitiveData: enableMasking,
      });
    }
  }, [captureConsoleLogs, maxLogEntries, enableMasking]);

  // Update logs when dialog opens
  useEffect(() => {
    if (isOpen) {
      setLogs(getCapturedLogs());
      // Focus textarea after opening
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle escape key and focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
        return;
      }

      // Focus trap: keep focus within dialog
      if (e.key === 'Tab' && isOpen && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
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

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSubmissionState('idle');
    setErrorMessage(null);
    setDescription('');
    setIssueUrl(null);
    onClose?.();
  }, [onClose]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const handleSubmit = useCallback(async () => {
    if (!description.trim()) {
      setErrorMessage('Please provide a description of the issue.');
      return;
    }

    setSubmissionState('submitting');
    setErrorMessage(null);

    try {
      // Parse repository into owner/repo for Hosted API compatibility
      const [owner, repo] = (repository || '').split('/');

      const payload: BugReportPayload = {
        description: enableMasking
          ? maskSensitiveData(description)
          : description,
        logs,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: Date.now(),
        // Required for Hosted API (api/report.ts)
        owner: owner || undefined,
        repo: repo || undefined,
        metadata: {
          repository,
          labels,
        },
      };

      // Use hosted endpoint by default, allow override for self-hosted
      const apiEndpoint = endpoint ?? HOSTED_API_ENDPOINT;

      const response = await fetch(apiEndpoint, {
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

      const data = await response.json();
      const responseData = data as { issueUrl?: string };

      setSubmissionState('success');
      setIssueUrl(responseData.issueUrl ?? null);
      clearCapturedLogs();

      onSuccess?.(responseData.issueUrl);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setSubmissionState('error');
      setErrorMessage(err.message);
      onError?.(err);
    }
  }, [
    description,
    logs,
    endpoint,
    repository,
    labels,
    enableMasking,
    onSuccess,
    onError,
  ]);

  // Check if widget should be disabled
  const isProduction = (() => {
    // Check for Vite's import.meta.env.PROD
    // @ts-expect-error import.meta.env is Vite-specific
    if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
      return true;
    }
    // Check for Node.js / webpack / other bundlers
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
      return true;
    }
    return false;
  })();
  if (disabled || (devOnly && isProduction)) {
    return null;
  }

  const renderTrigger = () => {
    if (trigger) {
      return (
        <div
          onClick={handleOpen}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
        >
          {trigger}
        </div>
      );
    }

    const buttonStyle: CSSProperties = {
      ...styles.triggerButton,
      ...(isHovered ? styles.triggerButtonHover : {}),
    };

    return (
      <button
        type="button"
        onClick={handleOpen}
        style={buttonStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={t.buttonText}
        title={t.buttonText}
      >
        <BugIcon />
      </button>
    );
  };

  const renderDialogContent = () => {
    if (submissionState === 'success') {
      return (
        <div style={styles.successMessage} role="status" aria-live="polite">
          <div style={styles.successIcon} aria-hidden="true">
            <CheckIcon />
          </div>
          <h3 style={{ ...styles.headerTitle, marginBottom: '8px' }}>
            {t.successMessage}
          </h3>
          <p
            style={{
              color: '#4b5563',
              fontSize: '14px',
              marginBottom: '16px',
            }}
          >
            {t.successDescription}
          </p>
          {issueUrl && (
            <a
              href={issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#6366f1',
                textDecoration: 'underline',
                fontSize: '14px',
              }}
            >
              {t.viewIssue}
            </a>
          )}
        </div>
      );
    }

    const textareaStyle: CSSProperties = {
      ...styles.textarea,
      ...(isFocused ? styles.textareaFocus : {}),
    };

    return (
      <>
        <div style={styles.content}>
          <label style={styles.label} htmlFor="inner-lens-description">
            {t.dialogDescription}
          </label>
          <textarea
            ref={textareaRef}
            id="inner-lens-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.placeholder}
            style={textareaStyle}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />

          {logs.length > 0 && (
            <div style={styles.logPreview}>
              <div style={styles.logPreviewHeader}>
                <span style={styles.logPreviewTitle}>{t.capturedLogs}</span>
                <span style={styles.logCount}>
                  {logs.length} {logs.length === 1 ? t.entry : t.entries}
                </span>
              </div>
              <div style={styles.logList}>
                {logs.slice(-10).map((log, index) => (
                  <div
                    key={`${log.timestamp}-${index}`}
                    style={{
                      ...styles.logEntry,
                      ...(log.level === 'error'
                        ? styles.logError
                        : log.level === 'warn'
                          ? styles.logWarn
                          : {}),
                    }}
                  >
                    [{log.level.toUpperCase()}] {log.message.slice(0, 100)}
                    {log.message.length > 100 && '...'}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={styles.privacyNotice}>
            {t.privacyNotice}
          </div>

          {submissionState === 'error' && errorMessage && (
            <div style={styles.errorMessage}>{errorMessage}</div>
          )}
        </div>

        <div style={styles.footer}>
          <button
            type="button"
            onClick={handleClose}
            style={styles.cancelButton}
          >
            {t.cancelText}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submissionState === 'submitting'}
            style={{
              ...styles.submitButton,
              ...(submissionState === 'submitting'
                ? styles.submitButtonDisabled
                : {}),
            }}
          >
            {submissionState === 'submitting' ? (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'center',
                }}
                role="status"
                aria-live="polite"
              >
                <span className="inner-lens-spinner" aria-hidden="true" />
                {t.submitting}
              </span>
            ) : (
              t.submitText
            )}
          </button>
        </div>
      </>
    );
  };

  return (
    <>
      {renderTrigger()}

      {isOpen && (
        <div
          style={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="inner-lens-title"
        >
          <div ref={dialogRef} style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div style={styles.header}>
              <h2 id="inner-lens-title" style={styles.headerTitle}>
                {t.dialogTitle}
              </h2>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  ...styles.closeButton,
                  ...(closeHovered ? styles.closeButtonHover : {}),
                }}
                onMouseEnter={() => setCloseHovered(true)}
                onMouseLeave={() => setCloseHovered(false)}
                aria-label="Close dialog"
              >
                <CloseIcon />
              </button>
            </div>
            {renderDialogContent()}
          </div>
        </div>
      )}
    </>
  );
}
