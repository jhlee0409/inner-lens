import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { useInnerLens } from './useInnerLens';

describe('useInnerLens', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  const renderHook = <T,>(hookFn: () => T): { result: { current: T } } => {
    const result: { current: T | null } = { current: null };

    function TestComponent() {
      result.current = hookFn();
      return null;
    }

    act(() => {
      root.render(createElement(TestComponent));
    });

    return { result: result as { current: T } };
  };

  describe('mounting', () => {
    it('should mount widget to DOM', () => {
      renderHook(() => useInnerLens({ repository: 'owner/repo' }));

      const widget = document.querySelector('#inner-lens-widget');
      expect(widget).not.toBeNull();
    });

    it('should unmount widget when component unmounts', () => {
      renderHook(() => useInnerLens({ repository: 'owner/repo' }));

      expect(document.querySelector('#inner-lens-widget')).not.toBeNull();

      act(() => {
        root.unmount();
      });

      root = createRoot(container);
      expect(document.querySelector('#inner-lens-widget')).toBeNull();
    });

    it('should not mount when hidden is true', () => {
      renderHook(() => useInnerLens({ repository: 'owner/repo', hidden: true }));

      expect(document.querySelector('#inner-lens-widget')).toBeNull();
    });
  });

  describe('open/close', () => {
    it('should provide open function that opens dialog', () => {
      const { result } = renderHook(() => useInnerLens({ repository: 'owner/repo' }));

      act(() => {
        result.current.open();
      });

      expect(document.querySelector('#inner-lens-overlay')).not.toBeNull();
    });

    it('should provide close function that closes dialog', () => {
      const { result } = renderHook(() => useInnerLens({ repository: 'owner/repo' }));

      act(() => {
        result.current.open();
      });

      expect(document.querySelector('#inner-lens-overlay')).not.toBeNull();

      act(() => {
        result.current.close();
      });

      expect(document.querySelector('#inner-lens-overlay')).toBeNull();
    });

    it('should track isOpen state', () => {
      const { result } = renderHook(() => useInnerLens({ repository: 'owner/repo' }));

      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('should call onOpen callback when dialog opens', () => {
      const onOpen = vi.fn();
      const { result } = renderHook(() =>
        useInnerLens({ repository: 'owner/repo', onOpen })
      );

      act(() => {
        result.current.open();
      });

      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('should call onClose callback when dialog closes', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useInnerLens({ repository: 'owner/repo', onClose })
      );

      act(() => {
        result.current.open();
      });

      act(() => {
        result.current.close();
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should use latest callback references', () => {
      const onOpen1 = vi.fn();
      const onOpen2 = vi.fn();

      let currentOnOpen = onOpen1;
      const result: { current: ReturnType<typeof useInnerLens> | null } = { current: null };

      function TestComponent() {
        result.current = useInnerLens({ repository: 'owner/repo', onOpen: currentOnOpen });
        return null;
      }

      act(() => {
        root.render(createElement(TestComponent));
      });

      currentOnOpen = onOpen2;

      act(() => {
        root.render(createElement(TestComponent));
      });

      act(() => {
        result.current?.open();
      });

      expect(onOpen1).not.toHaveBeenCalled();
      expect(onOpen2).toHaveBeenCalledTimes(1);
    });
  });

  describe('config changes', () => {
    it('should remount when repository changes', () => {
      const result: { current: ReturnType<typeof useInnerLens> | null } = { current: null };
      let repository = 'owner/repo1';

      function TestComponent() {
        result.current = useInnerLens({ repository });
        return null;
      }

      act(() => {
        root.render(createElement(TestComponent));
      });

      const widget1 = document.querySelector('#inner-lens-widget');
      expect(widget1).not.toBeNull();

      repository = 'owner/repo2';

      act(() => {
        root.render(createElement(TestComponent));
      });

      const widget2 = document.querySelector('#inner-lens-widget');
      expect(widget2).not.toBeNull();
    });

    it('should remount when language changes', () => {
      const result: { current: ReturnType<typeof useInnerLens> | null } = { current: null };
      let language: 'en' | 'ko' = 'en';

      function TestComponent() {
        result.current = useInnerLens({ repository: 'owner/repo', language });
        return null;
      }

      act(() => {
        root.render(createElement(TestComponent));
      });

      let trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      expect(trigger?.getAttribute('aria-label')).toBe('Report a bug');

      language = 'ko';

      act(() => {
        root.render(createElement(TestComponent));
      });

      trigger = document.querySelector('#inner-lens-trigger') as HTMLElement;
      expect(trigger?.getAttribute('aria-label')).toBe('버그 제보');
    });

    it('should remount when labels change', () => {
      const result: { current: ReturnType<typeof useInnerLens> | null } = { current: null };
      let labels = ['bug'];

      function TestComponent() {
        result.current = useInnerLens({ repository: 'owner/repo', labels });
        return null;
      }

      act(() => {
        root.render(createElement(TestComponent));
      });

      expect(document.querySelector('#inner-lens-widget')).not.toBeNull();

      labels = ['bug', 'urgent'];

      act(() => {
        root.render(createElement(TestComponent));
      });

      expect(document.querySelector('#inner-lens-widget')).not.toBeNull();
    });
  });

  describe('instance', () => {
    it('should expose instance property (may be null on initial render)', () => {
      const { result } = renderHook(() => useInnerLens({ repository: 'owner/repo' }));

      expect('instance' in result.current).toBe(true);
    });
  });
});
