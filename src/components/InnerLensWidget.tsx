'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
} from 'react';
import type { InnerLensConfig, LogEntry, BugReportPayload } from '../types';
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
  endpoint = '/api/inner-lens/report',
  repository,
  labels = ['bug', 'inner-lens'],
  captureConsoleLogs = true,
  maxLogEntries = 50,
  maskSensitiveData: enableMasking = true,
  styles: styleConfig,
  onSuccess,
  onError,
  trigger,
  disabled = false,
  devOnly = true,
}: InnerLensWidgetProps) {
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

  const styles = createStyles(styleConfig);

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
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!description.trim()) {
      setErrorMessage('Please provide a description of the issue.');
      return;
    }

    setSubmissionState('submitting');
    setErrorMessage(null);

    try {
      const payload: BugReportPayload = {
        description: enableMasking
          ? maskSensitiveData(description)
          : description,
        logs,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: Date.now(),
        metadata: {
          repository,
          labels,
        },
      };

      const response = await fetch(endpoint, {
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
          onClick={() => setIsOpen(true)}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setIsOpen(true)}
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
        onClick={() => setIsOpen(true)}
        style={buttonStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Report a bug"
        title="Report a bug"
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
            Report Submitted
          </h3>
          <p
            style={{
              color: '#4b5563',
              fontSize: '14px',
              marginBottom: '16px',
            }}
          >
            Thank you for your feedback! Our team will look into this.
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
              View Issue on GitHub
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
            Describe the issue
          </label>
          <textarea
            ref={textareaRef}
            id="inner-lens-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What went wrong? Please be as specific as possible..."
            style={textareaStyle}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />

          {logs.length > 0 && (
            <div style={styles.logPreview}>
              <div style={styles.logPreviewHeader}>
                <span style={styles.logPreviewTitle}>Captured Logs</span>
                <span style={styles.logCount}>
                  {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
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
            <strong>Privacy Notice:</strong> Sensitive data (emails, API keys,
            tokens) is automatically masked before submission. Your report will
            be processed by AI for analysis.
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
            Cancel
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
                <span style={styles.spinner} aria-hidden="true" />
                Submitting...
              </span>
            ) : (
              'Submit Report'
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
                Report an Issue
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
