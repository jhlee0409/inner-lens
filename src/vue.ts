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
    styles: {
      type: Object as PropType<StyleConfig>,
      default: undefined,
    },
    language: {
      type: String as PropType<'en' | 'ko' | 'ja' | 'zh' | 'es'>,
      default: 'en',
    },
    hidden: {
      type: Boolean,
      default: false,
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
        styles: props.styles,
        language: props.language,
        hidden: props.hidden,
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

    // Watch for prop changes
    watch(
      () => [
        props.endpoint,
        props.repository,
        props.language,
        props.hidden,
        props.styles?.buttonColor,
        props.styles?.buttonPosition,
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
