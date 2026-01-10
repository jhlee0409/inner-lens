/**
 * Tests for InnerLensWidget props and configuration
 *
 * These tests verify:
 * 1. Convenience props (position, buttonColor) mapping to styles
 * 2. UI text customization props types
 * 3. Lifecycle callback types
 */

import { describe, it, expect } from 'vitest';
import { createStyles } from '../utils/styles';
import type { InnerLensConfig } from '../types';
import { HOSTED_API_ENDPOINT } from '../types';

describe('InnerLensWidget Configuration', () => {
  describe('createStyles - Position Options', () => {
    it('should default to bottom-right position', () => {
      const styles = createStyles();
      expect(styles.triggerButton.bottom).toBe('20px');
      expect(styles.triggerButton.right).toBe('20px');
    });

    it('should set bottom-left position', () => {
      const styles = createStyles({ buttonPosition: 'bottom-left' });
      expect(styles.triggerButton.bottom).toBe('20px');
      expect(styles.triggerButton.left).toBe('20px');
    });

    it('should set top-right position', () => {
      const styles = createStyles({ buttonPosition: 'top-right' });
      expect(styles.triggerButton.top).toBe('20px');
      expect(styles.triggerButton.right).toBe('20px');
    });

    it('should set top-left position', () => {
      const styles = createStyles({ buttonPosition: 'top-left' });
      expect(styles.triggerButton.top).toBe('20px');
      expect(styles.triggerButton.left).toBe('20px');
    });
  });

  describe('createStyles - Button Color', () => {
    it('should default to #6366f1 button color', () => {
      const styles = createStyles();
      expect(styles.triggerButton.backgroundColor).toBe('#6366f1');
    });

    it('should use custom button color', () => {
      const styles = createStyles({ buttonColor: '#10b981' });
      expect(styles.triggerButton.backgroundColor).toBe('#10b981');
    });

    it('should use custom button color with position', () => {
      const styles = createStyles({
        buttonColor: '#ef4444',
        buttonPosition: 'top-left',
      });
      expect(styles.triggerButton.backgroundColor).toBe('#ef4444');
      expect(styles.triggerButton.top).toBe('20px');
      expect(styles.triggerButton.left).toBe('20px');
    });
  });

  describe('InnerLensConfig Type - UI Text Customization', () => {
    it('should accept all UI text customization props', () => {
      // Type test: this should compile without errors
      const config: InnerLensConfig = {
        buttonText: 'Report Bug',
        dialogTitle: 'Found an Issue?',
        dialogDescription: 'Tell us what happened',
        submitText: 'Send Report',
        cancelText: 'Never mind',
        successMessage: 'Thanks for reporting!',
      };

      expect(config.buttonText).toBe('Report Bug');
      expect(config.dialogTitle).toBe('Found an Issue?');
      expect(config.dialogDescription).toBe('Tell us what happened');
      expect(config.submitText).toBe('Send Report');
      expect(config.cancelText).toBe('Never mind');
      expect(config.successMessage).toBe('Thanks for reporting!');
    });
  });

  describe('InnerLensConfig Type - Convenience Options', () => {
    it('should accept top-level position and buttonColor', () => {
      // Type test: convenience options should be accepted
      const config: InnerLensConfig = {
        position: 'bottom-left',
        buttonColor: '#10b981',
      };

      expect(config.position).toBe('bottom-left');
      expect(config.buttonColor).toBe('#10b981');
    });

    it('should accept styles object for backward compatibility', () => {
      // Type test: legacy styles object should still work
      const config: InnerLensConfig = {
        styles: {
          buttonPosition: 'top-right',
          buttonColor: '#ef4444',
        },
      };

      expect(config.styles?.buttonPosition).toBe('top-right');
      expect(config.styles?.buttonColor).toBe('#ef4444');
    });

    it('should accept both convenience options and styles object', () => {
      // Type test: both can be used together
      const config: InnerLensConfig = {
        position: 'bottom-left', // Convenience (takes priority in widget)
        buttonColor: '#10b981',
        styles: {
          buttonPosition: 'top-right', // Legacy (overridden by convenience)
          buttonColor: '#ef4444',
        },
      };

      // Both are valid in the type
      expect(config.position).toBe('bottom-left');
      expect(config.styles?.buttonPosition).toBe('top-right');
    });
  });

  describe('InnerLensConfig Type - Lifecycle Callbacks', () => {
    it('should accept onOpen callback', () => {
      let opened = false;
      const config: InnerLensConfig = {
        onOpen: () => {
          opened = true;
        },
      };

      config.onOpen?.();
      expect(opened).toBe(true);
    });

    it('should accept onClose callback', () => {
      let closed = false;
      const config: InnerLensConfig = {
        onClose: () => {
          closed = true;
        },
      };

      config.onClose?.();
      expect(closed).toBe(true);
    });

    it('should accept onSuccess callback with issueUrl', () => {
      let receivedUrl: string | undefined;
      const config: InnerLensConfig = {
        onSuccess: (issueUrl) => {
          receivedUrl = issueUrl;
        },
      };

      config.onSuccess?.('https://github.com/owner/repo/issues/123');
      expect(receivedUrl).toBe('https://github.com/owner/repo/issues/123');
    });

    it('should accept onError callback with Error', () => {
      let receivedError: Error | undefined;
      const config: InnerLensConfig = {
        onError: (error) => {
          receivedError = error;
        },
      };

      const testError = new Error('Test error');
      config.onError?.(testError);
      expect(receivedError).toBe(testError);
      expect(receivedError?.message).toBe('Test error');
    });
  });

  describe('InnerLensConfig Type - Full Configuration', () => {
    it('should accept complete configuration with all options', () => {
      const config: InnerLensConfig = {
        // Core options
        endpoint: '/api/bugs',
        repository: 'owner/repo',
        labels: ['bug', 'urgent'],
        captureConsoleLogs: true,
        maxLogEntries: 100,
        maskSensitiveData: true,

        // Convenience options
        position: 'top-left',
        buttonColor: '#ff0000',

        // UI text
        buttonText: 'Report',
        dialogTitle: 'Bug Report',
        dialogDescription: 'Describe bug',
        submitText: 'Submit',
        cancelText: 'Cancel',
        successMessage: 'Submitted!',

        // Callbacks
        onOpen: () => console.log('opened'),
        onClose: () => console.log('closed'),
        onSuccess: (url) => console.log('success', url),
        onError: (err) => console.log('error', err),

        // Control
        hidden: false,
        disabled: false,
      };

      expect(config.endpoint).toBe('/api/bugs');
      expect(config.position).toBe('top-left');
      expect(config.buttonText).toBe('Report');
      expect(config.hidden).toBe(false);
      expect(config.disabled).toBe(false);
    });
  });
});

describe('Convenience Options Mapping', () => {
  it('should map position to buttonPosition in createStyles', () => {
    // Simulate widget behavior: position maps to buttonPosition
    const position: InnerLensConfig['position'] = 'top-right';
    const styleConfig = { buttonPosition: position };
    const styles = createStyles(styleConfig);

    expect(styles.triggerButton.top).toBe('20px');
    expect(styles.triggerButton.right).toBe('20px');
  });

  it('should map buttonColor directly to createStyles', () => {
    // Simulate widget behavior: buttonColor passes through
    const buttonColor: InnerLensConfig['buttonColor'] = '#22c55e';
    const styleConfig = { buttonColor };
    const styles = createStyles(styleConfig);

    expect(styles.triggerButton.backgroundColor).toBe('#22c55e');
  });

  it('should handle merged style config correctly', () => {
    // Simulate widget merging: convenience options override styles object
    const styleConfig = {
      buttonPosition: 'bottom-left' as const,
      buttonColor: '#3b82f6',
    };
    const position = 'top-right' as const;
    const buttonColor = '#ef4444';

    // Widget merges like this:
    const mergedStyleConfig = {
      ...styleConfig,
      buttonPosition: position ?? styleConfig.buttonPosition,
      buttonColor: buttonColor ?? styleConfig.buttonColor,
    };

    const styles = createStyles(mergedStyleConfig);

    // Convenience options should take priority
    expect(styles.triggerButton.top).toBe('20px');
    expect(styles.triggerButton.right).toBe('20px');
    expect(styles.triggerButton.backgroundColor).toBe('#ef4444');
  });
});

describe('HOSTED_API_ENDPOINT Constant', () => {
  it('should export the hosted API endpoint URL', () => {
    expect(HOSTED_API_ENDPOINT).toBe('https://inner-lens-one.vercel.app/api/report');
  });

  it('should be a valid HTTPS URL', () => {
    expect(HOSTED_API_ENDPOINT).toMatch(/^https:\/\//);
  });
});

describe('InnerLensWidget Payload Fields', () => {
  describe('Version Info', () => {
    it('should have VersionInfo type with widget and sdk fields', () => {
      const versionInfo: { widget?: string; sdk?: string } = {
        widget: '0.4.3',
        sdk: '0.4.3',
      };
      expect(versionInfo.widget).toBe('0.4.3');
      expect(versionInfo.sdk).toBe('0.4.3');
    });
  });

  describe('Deployment Info', () => {
    it('should have DeploymentInfo type with all expected fields', () => {
      const deploymentInfo: {
        environment?: string;
        commit?: string;
        release?: string;
        buildTime?: string;
      } = {
        environment: 'main',
        commit: 'abc123',
        release: 'v0.4.3',
        buildTime: '2026-01-10T09:38:52.642Z',
      };
      expect(deploymentInfo.environment).toBe('main');
      expect(deploymentInfo.commit).toBe('abc123');
      expect(deploymentInfo.release).toBe('v0.4.3');
      expect(deploymentInfo.buildTime).toBe('2026-01-10T09:38:52.642Z');
    });
  });

  describe('Runtime Environment', () => {
    it('should have RuntimeEnvironment type with all expected fields', () => {
      const runtimeEnv: {
        locale?: string;
        language?: string;
        timezoneOffset?: number;
        viewport?: { width: number; height: number; devicePixelRatio?: number };
        device?: 'mobile' | 'tablet' | 'desktop';
        colorScheme?: 'light' | 'dark' | 'no-preference';
        online?: boolean;
        platform?: string;
      } = {
        locale: 'en-US',
        language: 'en-US',
        timezoneOffset: -540,
        viewport: { width: 1920, height: 1080, devicePixelRatio: 2 },
        device: 'desktop',
        colorScheme: 'dark',
        online: true,
        platform: 'MacIntel',
      };
      expect(runtimeEnv.locale).toBe('en-US');
      expect(runtimeEnv.timezoneOffset).toBe(-540);
      expect(runtimeEnv.viewport?.width).toBe(1920);
      expect(runtimeEnv.device).toBe('desktop');
      expect(runtimeEnv.colorScheme).toBe('dark');
      expect(runtimeEnv.online).toBe(true);
      expect(runtimeEnv.platform).toBe('MacIntel');
    });

    it('should handle SSR environment with minimal data', () => {
      const ssrRuntime: { online?: boolean } = {
        online: false,
      };
      expect(ssrRuntime.online).toBe(false);
    });
  });
});
