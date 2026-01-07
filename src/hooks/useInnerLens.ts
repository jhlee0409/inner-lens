'use client';

import { useRef, useEffect, useCallback } from 'react';
import { InnerLensCore, type InnerLensCoreConfig } from '../core/InnerLensCore';

/**
 * React hook for programmatic control of InnerLens
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   // Hosted mode (default) - just specify repository
 *   const { open, close, isOpen } = useInnerLens({
 *     repository: 'owner/repo',
 *   });
 *
 *   // Self-hosted mode - specify custom endpoint
 *   // const { open } = useInnerLens({
 *   //   endpoint: '/api/bug-report',
 *   // });
 *
 *   return (
 *     <button onClick={open}>Report Bug</button>
 *   );
 * }
 * ```
 */
export function useInnerLens(config: InnerLensCoreConfig = {}) {
  const instanceRef = useRef<InnerLensCore | null>(null);

  useEffect(() => {
    instanceRef.current = new InnerLensCore(config);
    instanceRef.current.mount();

    return () => {
      instanceRef.current?.unmount();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.unmount();
      instanceRef.current = new InnerLensCore(config);
      instanceRef.current.mount();
    }
  }, [
    config.endpoint,
    config.repository,
    config.hidden,
    config.disabled,
    config.language,
    config.captureConsoleLogs,
    config.maxLogEntries,
    config.maskSensitiveData,
    config.captureUserActions,
    config.captureNavigation,
    config.capturePerformance,
    config.captureSessionReplay,
    config.position,
    config.buttonColor,
    config.buttonSize,
    config.buttonText,
    config.dialogTitle,
    config.dialogDescription,
    config.submitText,
    config.cancelText,
    config.successMessage,
    config.styles?.buttonColor,
    config.styles?.buttonPosition,
    config.styles?.buttonSize,
    config.reporter?.name,
    config.reporter?.email,
    config.reporter?.id,
  ]);

  const open = useCallback(() => {
    instanceRef.current?.open();
  }, []);

  const close = useCallback(() => {
    instanceRef.current?.close();
  }, []);

  return {
    open,
    close,
    get isOpen() {
      return instanceRef.current?.isDialogOpen ?? false;
    },
    instance: instanceRef.current,
  };
}
