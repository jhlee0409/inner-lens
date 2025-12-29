/**
 * Inline Styles for InnerLens Widget
 * Zero dependency on external CSS libraries to prevent conflicts
 */

import type { CSSProperties } from 'react';

export interface StyleConfig {
  buttonColor?: string;
  buttonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

const getPositionStyles = (
  position: StyleConfig['buttonPosition'] = 'bottom-right'
): CSSProperties => {
  const base: CSSProperties = { position: 'fixed', zIndex: 9999 };

  switch (position) {
    case 'bottom-left':
      return { ...base, bottom: '20px', left: '20px' };
    case 'top-right':
      return { ...base, top: '20px', right: '20px' };
    case 'top-left':
      return { ...base, top: '20px', left: '20px' };
    case 'bottom-right':
    default:
      return { ...base, bottom: '20px', right: '20px' };
  }
};

export const createStyles = (config?: StyleConfig) => {
  const buttonColor = config?.buttonColor ?? '#6366f1';

  return {
    // Floating trigger button
    triggerButton: {
      ...getPositionStyles(config?.buttonPosition),
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      backgroundColor: buttonColor,
      color: '#ffffff',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      outline: 'none',
    } satisfies CSSProperties,

    triggerButtonHover: {
      transform: 'scale(1.05)',
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
    } satisfies CSSProperties,

    // Modal overlay
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px',
    } satisfies CSSProperties,

    // Modal dialog
    dialog: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      maxWidth: '500px',
      width: '100%',
      maxHeight: '80vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
    } satisfies CSSProperties,

    // Dialog header
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: '1px solid #e5e7eb',
    } satisfies CSSProperties,

    headerTitle: {
      margin: 0,
      fontSize: '18px',
      fontWeight: 600,
      color: '#111827',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } satisfies CSSProperties,

    closeButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '4px',
      color: '#6b7280',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '4px',
      transition: 'background-color 0.15s ease',
    } satisfies CSSProperties,

    // Dialog content
    content: {
      padding: '20px',
      overflowY: 'auto',
      flex: 1,
    } satisfies CSSProperties,

    // Form elements
    label: {
      display: 'block',
      marginBottom: '8px',
      fontSize: '14px',
      fontWeight: 500,
      color: '#374151',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } satisfies CSSProperties,

    textarea: {
      width: '100%',
      minHeight: '120px',
      padding: '12px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      resize: 'vertical',
      outline: 'none',
      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      boxSizing: 'border-box',
    } satisfies CSSProperties,

    textareaFocus: {
      borderColor: buttonColor,
      boxShadow: `0 0 0 3px ${buttonColor}20`,
    } satisfies CSSProperties,

    // Log preview
    logPreview: {
      marginTop: '16px',
      padding: '12px',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
    } satisfies CSSProperties,

    logPreviewHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '8px',
    } satisfies CSSProperties,

    logPreviewTitle: {
      fontSize: '12px',
      fontWeight: 500,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } satisfies CSSProperties,

    logCount: {
      fontSize: '12px',
      color: '#9ca3af',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } satisfies CSSProperties,

    logList: {
      maxHeight: '150px',
      overflowY: 'auto',
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      fontSize: '12px',
    } satisfies CSSProperties,

    logEntry: {
      padding: '4px 0',
      borderBottom: '1px solid #e5e7eb',
      wordBreak: 'break-word',
    } satisfies CSSProperties,

    logError: {
      color: '#dc2626',
    } satisfies CSSProperties,

    logWarn: {
      color: '#d97706',
    } satisfies CSSProperties,

    // Footer with actions
    footer: {
      display: 'flex',
      gap: '12px',
      padding: '16px 20px',
      borderTop: '1px solid #e5e7eb',
      backgroundColor: '#f9fafb',
    } satisfies CSSProperties,

    submitButton: {
      flex: 1,
      padding: '10px 16px',
      backgroundColor: buttonColor,
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'background-color 0.15s ease, transform 0.1s ease',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } satisfies CSSProperties,

    submitButtonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    } satisfies CSSProperties,

    cancelButton: {
      padding: '10px 16px',
      backgroundColor: '#ffffff',
      color: '#374151',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } satisfies CSSProperties,

    // Success/Error states
    successMessage: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px',
      textAlign: 'center',
    } satisfies CSSProperties,

    successIcon: {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      backgroundColor: '#dcfce7',
      color: '#16a34a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '16px',
    } satisfies CSSProperties,

    errorMessage: {
      padding: '12px',
      backgroundColor: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      color: '#dc2626',
      fontSize: '14px',
      marginTop: '12px',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } satisfies CSSProperties,

    // Loading spinner
    spinner: {
      width: '16px',
      height: '16px',
      border: '2px solid #ffffff',
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'inner-lens-spin 0.8s linear infinite',
    } satisfies CSSProperties,

    // Privacy notice
    privacyNotice: {
      marginTop: '16px',
      padding: '12px',
      backgroundColor: '#eff6ff',
      borderRadius: '8px',
      fontSize: '12px',
      color: '#1e40af',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } satisfies CSSProperties,
  };
};

// CSS keyframes as a string (injected once)
export const keyframesCSS = `
@keyframes inner-lens-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;
