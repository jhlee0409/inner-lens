/**
 * inner-lens Vanilla JS Module
 * Use this for plain JavaScript/TypeScript projects without frameworks
 *
 * @packageDocumentation
 *
 * @example
 * ```html
 * <script type="module">
 *   import { InnerLens } from 'inner-lens/vanilla';
 *
 *   const widget = new InnerLens({
 *     endpoint: '/api/bug-report',
 *     repository: 'owner/repo',
 *   });
 *
 *   widget.mount();
 * </script>
 * ```
 */

export { InnerLensCore as InnerLens } from './core/InnerLensCore';
export type { InnerLensCoreConfig as InnerLensConfig } from './core/InnerLensCore';

// Re-export utilities
export * from './utils/masking';
export * from './utils/log-capture';
export * from './types';

// Auto-init support for script tag usage
declare global {
  interface Window {
    InnerLens?: typeof import('./core/InnerLensCore').InnerLensCore;
    innerLensConfig?: import('./core/InnerLensCore').InnerLensCoreConfig;
  }
}

// Auto-initialize if config is present on window
if (typeof window !== 'undefined') {
  // Make InnerLens available globally
  import('./core/InnerLensCore').then(({ InnerLensCore }) => {
    window.InnerLens = InnerLensCore;

    // Auto-mount if config exists
    if (window.innerLensConfig) {
      const instance = new InnerLensCore(window.innerLensConfig);
      instance.mount();
    }
  });
}
