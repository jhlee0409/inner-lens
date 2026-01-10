/**
 * Inline Styles for InnerLens Widget
 * All styles use !important to prevent conflicts with host app CSS
 * Zero dependency on external CSS libraries
 */

// Framework-agnostic CSS properties type
type CSSStyleDeclaration = Record<string, string | number | undefined>;

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface StyleConfig {
  buttonColor?: string;
  buttonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  buttonSize?: ButtonSize;
}

const getPositionStyles = (
  position: StyleConfig['buttonPosition'] = 'bottom-right'
): CSSStyleDeclaration => {
  const base: CSSStyleDeclaration = { position: 'fixed !important', zIndex: '9999 !important' };

  switch (position) {
    case 'bottom-left':
      return { ...base, bottom: '20px !important', left: '20px !important', top: 'auto !important', right: 'auto !important' };
    case 'top-right':
      return { ...base, top: '20px !important', right: '20px !important', bottom: 'auto !important', left: 'auto !important' };
    case 'top-left':
      return { ...base, top: '20px !important', left: '20px !important', bottom: 'auto !important', right: 'auto !important' };
    case 'bottom-right':
    default:
      return { ...base, bottom: '20px !important', right: '20px !important', top: 'auto !important', left: 'auto !important' };
  }
};

const BUTTON_SIZES: Record<ButtonSize, { button: string; icon: number }> = {
  sm: { button: '40px', icon: 18 },
  md: { button: '48px', icon: 20 },
  lg: { button: '56px', icon: 24 },
};

export const createStyles = (config?: StyleConfig) => {
  const buttonColor = config?.buttonColor ?? '#6366f1';
  const sizeConfig = BUTTON_SIZES[config?.buttonSize ?? 'lg'];

  return {
    triggerButton: {
      ...getPositionStyles(config?.buttonPosition),
      width: `${sizeConfig.button} !important`,
      height: `${sizeConfig.button} !important`,
      borderRadius: '50% !important',
      backgroundColor: `${buttonColor} !important`,
      color: '#ffffff !important',
      border: 'none !important',
      cursor: 'pointer !important',
      display: 'flex !important',
      alignItems: 'center !important',
      justifyContent: 'center !important',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15) !important',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease !important',
      outline: 'none !important',
      padding: '0 !important',
      margin: '0 !important',
      lineHeight: 'normal !important',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
    } as CSSStyleDeclaration,

    iconSize: sizeConfig.icon,

    triggerButtonHover: {
      transform: 'scale(1.05) !important',
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2) !important',
    } as CSSStyleDeclaration,

    // Modal overlay
    overlay: {
      position: 'fixed !important',
      top: '0 !important',
      left: '0 !important',
      right: '0 !important',
      bottom: '0 !important',
      backgroundColor: 'rgba(0, 0, 0, 0.5) !important',
      display: 'flex !important',
      alignItems: 'center !important',
      justifyContent: 'center !important',
      zIndex: '10000 !important',
      padding: '20px !important',
      margin: '0 !important',
      width: '100% !important',
      height: '100% !important',
      boxSizing: 'border-box !important',
    } as CSSStyleDeclaration,

    // Modal dialog
    dialog: {
      backgroundColor: '#ffffff !important',
      borderRadius: '12px !important',
      maxWidth: '500px !important',
      width: '100% !important',
      maxHeight: '80vh !important',
      overflow: 'hidden !important',
      display: 'flex !important',
      flexDirection: 'column !important',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2) !important',
      margin: '0 !important',
      padding: '0 !important',
      border: 'none !important',
      position: 'relative !important',
    } as CSSStyleDeclaration,

    // Dialog header
    header: {
      display: 'flex !important',
      alignItems: 'center !important',
      justifyContent: 'space-between !important',
      padding: '16px 20px !important',
      borderBottom: '1px solid #e5e7eb !important',
      backgroundColor: '#ffffff !important',
      margin: '0 !important',
      borderTop: 'none !important',
      borderLeft: 'none !important',
      borderRight: 'none !important',
    } as CSSStyleDeclaration,

    headerTitle: {
      margin: '0 !important',
      padding: '0 !important',
      fontSize: '18px !important',
      fontWeight: '600 !important',
      color: '#111827 !important',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
      lineHeight: '1.4 !important',
      letterSpacing: 'normal !important',
      textTransform: 'none !important',
      textDecoration: 'none !important',
      backgroundColor: 'transparent !important',
      border: 'none !important',
    } as CSSStyleDeclaration,

    closeButton: {
      background: 'none !important',
      backgroundColor: 'transparent !important',
      border: 'none !important',
      cursor: 'pointer !important',
      padding: '8px !important',
      margin: '0 !important',
      minWidth: '44px !important',
      minHeight: '44px !important',
      width: '44px !important',
      height: '44px !important',
      color: '#4b5563 !important',
      display: 'flex !important',
      alignItems: 'center !important',
      justifyContent: 'center !important',
      borderRadius: '8px !important',
      transition: 'background-color 0.15s ease !important',
      outline: 'none !important',
      boxShadow: 'none !important',
    } as CSSStyleDeclaration,

    closeButtonHover: {
      backgroundColor: '#f3f4f6 !important',
    } as CSSStyleDeclaration,

    // Dialog content
    content: {
      padding: '20px !important',
      overflowY: 'auto !important',
      flex: '1 !important',
      backgroundColor: '#ffffff !important',
      margin: '0 !important',
    } as CSSStyleDeclaration,

    // Form elements
    label: {
      display: 'block !important',
      marginBottom: '8px !important',
      marginTop: '0 !important',
      marginLeft: '0 !important',
      marginRight: '0 !important',
      padding: '0 !important',
      fontSize: '14px !important',
      fontWeight: '500 !important',
      color: '#374151 !important',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
      lineHeight: '1.4 !important',
      letterSpacing: 'normal !important',
      textTransform: 'none !important',
      backgroundColor: 'transparent !important',
      border: 'none !important',
    } as CSSStyleDeclaration,

    textarea: {
      width: '100% !important',
      minHeight: '120px !important',
      padding: '12px !important',
      margin: '0 !important',
      border: '1px solid #d1d5db !important',
      borderRadius: '8px !important',
      fontSize: '14px !important',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
      resize: 'vertical !important',
      outline: 'none !important',
      transition: 'border-color 0.15s ease, box-shadow 0.15s ease !important',
      boxSizing: 'border-box !important',
      color: '#111827 !important',
      backgroundColor: '#ffffff !important',
      lineHeight: '1.5 !important',
      letterSpacing: 'normal !important',
      boxShadow: 'none !important',
    } as CSSStyleDeclaration,

    textareaFocus: {
      borderColor: `${buttonColor} !important`,
      boxShadow: `0 0 0 3px ${buttonColor}20 !important`,
    } as CSSStyleDeclaration,

    // Log preview
    logPreview: {
      marginTop: '16px !important',
      marginBottom: '0 !important',
      marginLeft: '0 !important',
      marginRight: '0 !important',
      padding: '12px !important',
      backgroundColor: '#f9fafb !important',
      borderRadius: '8px !important',
      border: '1px solid #e5e7eb !important',
    } as CSSStyleDeclaration,

    logPreviewHeader: {
      display: 'flex !important',
      alignItems: 'center !important',
      justifyContent: 'space-between !important',
      marginBottom: '8px !important',
      marginTop: '0 !important',
      marginLeft: '0 !important',
      marginRight: '0 !important',
      padding: '0 !important',
    } as CSSStyleDeclaration,

    logPreviewTitle: {
      fontSize: '12px !important',
      fontWeight: '500 !important',
      color: '#4b5563 !important',
      textTransform: 'uppercase !important',
      letterSpacing: '0.05em !important',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
      margin: '0 !important',
      padding: '0 !important',
      backgroundColor: 'transparent !important',
      border: 'none !important',
      lineHeight: '1.4 !important',
    } as CSSStyleDeclaration,

    logCount: {
      fontSize: '12px !important',
      color: '#6b7280 !important',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
      margin: '0 !important',
      padding: '0 !important',
      backgroundColor: 'transparent !important',
      border: 'none !important',
      lineHeight: '1.4 !important',
    } as CSSStyleDeclaration,

    logList: {
      maxHeight: '150px !important',
      overflowY: 'auto !important',
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace !important',
      fontSize: '12px !important',
      margin: '0 !important',
      padding: '0 !important',
      backgroundColor: 'transparent !important',
      border: 'none !important',
      listStyle: 'none !important',
    } as CSSStyleDeclaration,

    logEntry: {
      padding: '4px 0 !important',
      margin: '0 !important',
      borderBottom: '1px solid #e5e7eb !important',
      borderTop: 'none !important',
      borderLeft: 'none !important',
      borderRight: 'none !important',
      wordBreak: 'break-word !important',
      color: '#374151 !important',
      backgroundColor: 'transparent !important',
      fontSize: '12px !important',
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace !important',
      lineHeight: '1.4 !important',
    } as CSSStyleDeclaration,

    logError: {
      color: '#dc2626 !important',
    } as CSSStyleDeclaration,

    logWarn: {
      color: '#d97706 !important',
    } as CSSStyleDeclaration,

    // Footer with actions
    footer: {
      display: 'flex !important',
      gap: '12px !important',
      padding: '16px 20px !important',
      margin: '0 !important',
      borderTop: '1px solid #e5e7eb !important',
      borderBottom: 'none !important',
      borderLeft: 'none !important',
      borderRight: 'none !important',
      backgroundColor: '#f9fafb !important',
    } as CSSStyleDeclaration,

    submitButton: {
      flex: '1 !important',
      padding: '10px 16px !important',
      margin: '0 !important',
      backgroundColor: `${buttonColor} !important`,
      color: '#ffffff !important',
      border: 'none !important',
      borderRadius: '8px !important',
      fontSize: '14px !important',
      fontWeight: '500 !important',
      cursor: 'pointer !important',
      transition: 'background-color 0.15s ease, transform 0.1s ease !important',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
      lineHeight: '1.4 !important',
      textAlign: 'center !important',
      textDecoration: 'none !important',
      outline: 'none !important',
      boxShadow: 'none !important',
    } as CSSStyleDeclaration,

    submitButtonDisabled: {
      opacity: '0.5 !important',
      cursor: 'not-allowed !important',
    } as CSSStyleDeclaration,

    cancelButton: {
      padding: '10px 16px !important',
      margin: '0 !important',
      backgroundColor: '#ffffff !important',
      color: '#374151 !important',
      border: '1px solid #d1d5db !important',
      borderRadius: '8px !important',
      fontSize: '14px !important',
      fontWeight: '500 !important',
      cursor: 'pointer !important',
      transition: 'background-color 0.15s ease !important',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
      lineHeight: '1.4 !important',
      textAlign: 'center !important',
      textDecoration: 'none !important',
      outline: 'none !important',
      boxShadow: 'none !important',
    } as CSSStyleDeclaration,

    // Success/Error states
    successMessage: {
      display: 'flex !important',
      flexDirection: 'column !important',
      alignItems: 'center !important',
      padding: '24px !important',
      margin: '0 !important',
      textAlign: 'center !important',
      backgroundColor: '#ffffff !important',
      border: 'none !important',
    } as CSSStyleDeclaration,

    successIcon: {
      width: '48px !important',
      height: '48px !important',
      borderRadius: '50% !important',
      backgroundColor: '#dcfce7 !important',
      color: '#16a34a !important',
      display: 'flex !important',
      alignItems: 'center !important',
      justifyContent: 'center !important',
      marginBottom: '16px !important',
      marginTop: '0 !important',
      marginLeft: '0 !important',
      marginRight: '0 !important',
      padding: '0 !important',
      border: 'none !important',
    } as CSSStyleDeclaration,

    errorMessage: {
      padding: '12px !important',
      margin: '12px 0 0 0 !important',
      backgroundColor: '#fef2f2 !important',
      border: '1px solid #fecaca !important',
      borderRadius: '8px !important',
      color: '#dc2626 !important',
      fontSize: '14px !important',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
      lineHeight: '1.4 !important',
      textAlign: 'left !important',
    } as CSSStyleDeclaration,

    // Loading spinner
    spinner: {
      display: 'inline-block !important',
      width: '16px !important',
      height: '16px !important',
      border: '2px solid #ffffff !important',
      borderTopColor: 'transparent !important',
      borderRadius: '50% !important',
      animation: 'inner-lens-spin 0.8s linear infinite !important',
      margin: '0 !important',
      padding: '0 !important',
      backgroundColor: 'transparent !important',
    } as CSSStyleDeclaration,

    // Privacy notice
    privacyNotice: {
      marginTop: '16px !important',
      marginBottom: '0 !important',
      marginLeft: '0 !important',
      marginRight: '0 !important',
      padding: '12px !important',
      backgroundColor: '#eff6ff !important',
      borderRadius: '8px !important',
      border: 'none !important',
      fontSize: '12px !important',
      color: '#1e40af !important',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
      lineHeight: '1.4 !important',
      textAlign: 'left !important',
    } as CSSStyleDeclaration,
  };
};

// CSS keyframes and responsive styles (injected once)
export const keyframesCSS = `
@keyframes inner-lens-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Spinner class - ensures animation works regardless of inline style order */
.inner-lens-spinner {
  display: inline-block !important;
  width: 16px !important;
  height: 16px !important;
  border: 2px solid #ffffff !important;
  border-top-color: transparent !important;
  border-radius: 50% !important;
  animation: inner-lens-spin 0.8s linear infinite !important;
}

/* Reset all inner-lens elements to prevent host CSS conflicts */
#inner-lens-widget,
#inner-lens-widget *,
#inner-lens-widget *::before,
#inner-lens-widget *::after {
  box-sizing: border-box !important;
  text-rendering: optimizeLegibility !important;
  -webkit-font-smoothing: antialiased !important;
  -moz-osx-font-smoothing: grayscale !important;
}

#inner-lens-widget h1,
#inner-lens-widget h2,
#inner-lens-widget h3,
#inner-lens-widget h4,
#inner-lens-widget h5,
#inner-lens-widget h6,
#inner-lens-widget p,
#inner-lens-widget span,
#inner-lens-widget div,
#inner-lens-widget label {
  all: revert !important;
}

/* Force form element styles - these must override host CSS resets */
#inner-lens-widget textarea,
#inner-lens-widget input {
  color: #111827 !important;
  background-color: #ffffff !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
  border: 1px solid #d1d5db !important;
  border-radius: 8px !important;
  padding: 12px !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  -webkit-appearance: none !important;
  appearance: none !important;
}

#inner-lens-widget textarea::placeholder,
#inner-lens-widget input::placeholder {
  color: #9ca3af !important;
  opacity: 1 !important;
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  #inner-lens-widget * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Mobile responsive adjustments */
@media (max-width: 640px) {
  #inner-lens-widget [role="dialog"] > div {
    margin: 10px !important;
    max-height: 90vh !important;
  }
}

/* Focus visible for keyboard users */
#inner-lens-widget button:focus-visible {
  outline: 2px solid #6366f1 !important;
  outline-offset: 2px !important;
}

#inner-lens-widget textarea:focus-visible {
  outline: 2px solid #6366f1 !important;
  outline-offset: 2px !important;
}

/* Hide widget when printing */
@media print {
  #inner-lens-widget {
    display: none !important;
  }
}
`;
