/**
 * InnerLens React Widget
 *
 * @example
 * ```tsx
 * import { InnerLensWidget } from 'inner-lens/react';
 *
 * function App() {
 *   return (
 *     <>
 *       <YourApp />
 *       <InnerLensWidget repository="owner/repo" />
 *     </>
 *   );
 * }
 * ```
 */

import React, {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  isValidElement,
  cloneElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { InnerLensCore, type InnerLensCoreConfig } from '../core/InnerLensCore';
import type { InnerLensConfig } from '../types';

interface InnerLensWidgetProps extends InnerLensConfig {
  trigger?: ReactNode;
}

export function InnerLensWidget({
  endpoint,
  repository,
  branch,
  labels,
  captureConsoleLogs,
  maxLogEntries,
  maskSensitiveData,
  captureUserActions,
  captureNavigation,
  capturePerformance,
  captureSessionReplay,
  styles,
  language,
  position,
  buttonColor,
  buttonSize,
  buttonText,
  dialogTitle,
  dialogDescription,
  submitText,
  cancelText,
  successMessage,
  onSuccess,
  onError,
  onOpen,
  onClose,
  hidden,
  disabled,
  reporter,
  trigger,
}: InnerLensWidgetProps) {
  const instanceRef = useRef<InnerLensCore | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const callbacksRef = useRef({
    onOpen,
    onClose,
    onSuccess,
    onError,
  });

  callbacksRef.current = {
    onOpen,
    onClose,
    onSuccess,
    onError,
  };

  const labelsJson = useMemo(
    () => (labels ? JSON.stringify(labels) : ''),
    [labels]
  );

  useEffect(() => {
    const shouldHideButton = trigger !== undefined || hidden;

    const config: InnerLensCoreConfig = {
      endpoint,
      repository,
      branch,
      labels,
      captureConsoleLogs,
      maxLogEntries,
      maskSensitiveData,
      captureUserActions,
      captureNavigation,
      capturePerformance,
      captureSessionReplay,
      styles,
      language,
      position,
      buttonColor,
      buttonSize,
      buttonText,
      dialogTitle,
      dialogDescription,
      submitText,
      cancelText,
      successMessage,
      hidden: shouldHideButton,
      disabled,
      reporter,
      onOpen: () => callbacksRef.current.onOpen?.(),
      onClose: () => callbacksRef.current.onClose?.(),
      onSuccess: (url) => callbacksRef.current.onSuccess?.(url),
      onError: (err) => callbacksRef.current.onError?.(err),
    };

    if (instanceRef.current) {
      instanceRef.current.unmount();
    }

    instanceRef.current = new InnerLensCore(config);

    if (containerRef.current) {
      instanceRef.current.mount(containerRef.current);
    } else {
      instanceRef.current.mount();
    }

    return () => {
      instanceRef.current?.unmount();
      instanceRef.current = null;
    };
  }, [
    endpoint,
    repository,
    branch,
    labelsJson,
    captureConsoleLogs,
    maxLogEntries,
    maskSensitiveData,
    captureUserActions,
    captureNavigation,
    capturePerformance,
    captureSessionReplay,
    styles?.buttonColor,
    styles?.buttonPosition,
    styles?.buttonSize,
    language,
    position,
    buttonColor,
    buttonSize,
    buttonText,
    dialogTitle,
    dialogDescription,
    submitText,
    cancelText,
    successMessage,
    hidden,
    disabled,
    reporter?.name,
    reporter?.email,
    reporter?.id,
    trigger !== undefined,
  ]);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    instanceRef.current?.open();
  }, [disabled]);

  if (hidden && !trigger) {
    return null;
  }

  if (trigger) {
    const renderTrigger = () => {
      if (isValidElement(trigger)) {
        const triggerElement = trigger as ReactElement<{
          onClick?: (e: React.MouseEvent) => void;
          onKeyDown?: (e: React.KeyboardEvent) => void;
        }>;
        return cloneElement(triggerElement, {
          onClick: (e: React.MouseEvent) => {
            triggerElement.props.onClick?.(e);
            handleOpen();
          },
          onKeyDown: (e: React.KeyboardEvent) => {
            triggerElement.props.onKeyDown?.(e);
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpen();
            }
          },
        });
      }
      return (
        <span
          onClick={handleOpen}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpen();
            }
          }}
          role="button"
          tabIndex={0}
        >
          {trigger}
        </span>
      );
    };

    return (
      <>
        {renderTrigger()}
        <div
          ref={containerRef}
          data-inner-lens-container="true"
          style={{ display: 'contents' }}
        />
      </>
    );
  }

  return (
    <div
      ref={containerRef}
      data-inner-lens-container="true"
      style={{ display: 'contents' }}
    />
  );
}
