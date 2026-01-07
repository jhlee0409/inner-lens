/**
 * inner-lens Vue Module
 * Vue 3 components and composables for bug reporting
 *
 * @packageDocumentation
 *
 * @example
 * ```vue
 * <script setup>
 * import { InnerLensWidget } from 'inner-lens/vue';
 * </script>
 *
 * <template>
 *   <div>
 *     <YourApp />
 *     <InnerLensWidget />
 *   </div>
 * </template>
 * ```
 */

import {
  defineComponent,
  h,
  ref,
  onMounted,
  onUnmounted,
  watch,
  type PropType,
} from 'vue';
import { InnerLensCore, type InnerLensCoreConfig } from './core/InnerLensCore';
import type { StyleConfig } from './utils/styles';
import { HOSTED_API_ENDPOINT } from './types';

// Re-export types
export type {
  AIProvider,
  InnerLensConfig,
  LogEntry,
  BugReportPayload,
  BugReportResponse,
  GitHubIssuePayload,
  WidgetLanguage,
  Reporter,
} from './types';

// Re-export utilities
export {
  initLogCapture,
  getCapturedLogs,
  clearCapturedLogs,
  addCustomLog,
  restoreConsole,
} from './utils/log-capture';

export {
  maskSensitiveData,
  maskSensitiveObject,
  validateMasking,
} from './utils/masking';

/**
 * Vue 3 composable for programmatic control
 *
 * @example
 * ```vue
 * <script setup>
 * import { useInnerLens } from 'inner-lens/vue';
 *
 * const { open, close, isOpen } = useInnerLens({
 *   endpoint: '/api/bug-report',
 * });
 * </script>
 * ```
 */
export function useInnerLens(config: InnerLensCoreConfig = {}) {
  const instance = ref<InnerLensCore | null>(null);
  const isOpen = ref(false);

  onMounted(() => {
    instance.value = new InnerLensCore({
      ...config,
      onOpen: () => {
        isOpen.value = true;
        config.onOpen?.();
      },
      onClose: () => {
        isOpen.value = false;
        config.onClose?.();
      },
    });
    instance.value.mount();
  });

  onUnmounted(() => {
    instance.value?.unmount();
    instance.value = null;
  });

  const open = () => {
    instance.value?.open();
  };

  const close = () => {
    instance.value?.close();
  };

  return {
    open,
    close,
    isOpen,
    instance,
  };
}

/**
 * Vue 3 InnerLens Widget Component
 */
export const InnerLensWidget = defineComponent({
  name: 'InnerLensWidget',
  props: {
    endpoint: {
      type: String,
      default: HOSTED_API_ENDPOINT,
    },
    repository: {
      type: String,
      default: undefined,
    },
    labels: {
      type: Array as PropType<string[]>,
      default: () => ['inner-lens'],
    },
    captureConsoleLogs: {
      type: Boolean,
      default: true,
    },
    maxLogEntries: {
      type: Number,
      default: 50,
    },
    maskSensitiveData: {
      type: Boolean,
      default: true,
    },
    // Extended capture options
    captureUserActions: {
      type: Boolean,
      default: true,
    },
    captureNavigation: {
      type: Boolean,
      default: true,
    },
    capturePerformance: {
      type: Boolean,
      default: true,
    },
    captureSessionReplay: {
      type: Boolean,
      default: false,
    },
    styles: {
      type: Object as PropType<StyleConfig>,
      default: undefined,
    },
    language: {
      type: String as PropType<'en' | 'ko' | 'ja' | 'zh' | 'es'>,
      default: 'en',
    },
    // Convenience options
    position: {
      type: String as PropType<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>,
      default: 'bottom-right',
    },
    buttonColor: {
      type: String,
      default: '#6366f1',
    },
    buttonSize: {
      type: String as PropType<'sm' | 'md' | 'lg'>,
      default: 'lg',
    },
    // UI text customization
    buttonText: {
      type: String,
      default: undefined,
    },
    dialogTitle: {
      type: String,
      default: undefined,
    },
    dialogDescription: {
      type: String,
      default: undefined,
    },
    submitText: {
      type: String,
      default: undefined,
    },
    cancelText: {
      type: String,
      default: undefined,
    },
    successMessage: {
      type: String,
      default: undefined,
    },
    hidden: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    reporter: {
      type: Object as PropType<{ name: string; email?: string; id?: string }>,
      default: undefined,
    },
  },
  emits: ['success', 'error', 'open', 'close'],
  setup(props, { emit }) {
    const containerRef = ref<HTMLElement | null>(null);
    const instance = ref<InnerLensCore | null>(null);

    const createInstance = () => {
      if (instance.value) {
        instance.value.unmount();
      }

      const config: InnerLensCoreConfig = {
        endpoint: props.endpoint,
        repository: props.repository,
        labels: props.labels,
        captureConsoleLogs: props.captureConsoleLogs,
        maxLogEntries: props.maxLogEntries,
        maskSensitiveData: props.maskSensitiveData,
        captureUserActions: props.captureUserActions,
        captureNavigation: props.captureNavigation,
        capturePerformance: props.capturePerformance,
        captureSessionReplay: props.captureSessionReplay,
        styles: props.styles,
        language: props.language,
        position: props.position,
        buttonColor: props.buttonColor,
        buttonSize: props.buttonSize,
        buttonText: props.buttonText,
        dialogTitle: props.dialogTitle,
        dialogDescription: props.dialogDescription,
        submitText: props.submitText,
        cancelText: props.cancelText,
        successMessage: props.successMessage,
        hidden: props.hidden,
        disabled: props.disabled,
        reporter: props.reporter,
        onSuccess: (url) => emit('success', url),
        onError: (error) => emit('error', error),
        onOpen: () => emit('open'),
        onClose: () => emit('close'),
      };

      instance.value = new InnerLensCore(config);

      if (containerRef.value) {
        instance.value.mount(containerRef.value);
      }
    };

    onMounted(() => {
      createInstance();
    });

    onUnmounted(() => {
      instance.value?.unmount();
      instance.value = null;
    });

    watch(
      () => [
        props.endpoint,
        props.repository,
        props.hidden,
        props.disabled,
        props.language,
        props.captureConsoleLogs,
        props.maxLogEntries,
        props.maskSensitiveData,
        props.captureUserActions,
        props.captureNavigation,
        props.capturePerformance,
        props.captureSessionReplay,
        props.position,
        props.buttonColor,
        props.buttonSize,
        props.buttonText,
        props.dialogTitle,
        props.dialogDescription,
        props.submitText,
        props.cancelText,
        props.successMessage,
        props.styles?.buttonColor,
        props.styles?.buttonPosition,
        props.styles?.buttonSize,
        props.reporter?.name,
        props.reporter?.email,
        props.reporter?.id,
      ],
      () => {
        createInstance();
      }
    );

    return () =>
      h('div', {
        ref: containerRef,
        'data-inner-lens-container': 'true',
      });
  },
});
