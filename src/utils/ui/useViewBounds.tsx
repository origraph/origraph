import { RefObject, useEffect, useState } from 'react';
import { useDidValueChange } from '../core/useDidValueChange';

export const DEFAULT_VIEW_BOUNDS: DOMRectReadOnly = DOMRectReadOnly.fromRect({
  x: 0,
  y: 0,
  width: 100,
  height: 100,
});

export const useViewBounds = (targetRef: RefObject<null | HTMLElement>) => {
  const [bounds, setBounds] = useState<DOMRectReadOnly>(DEFAULT_VIEW_BOUNDS);
  const [boundsInitialized, setBoundsInitialized] = useState(false);
  const boundsChanged = useDidValueChange({ value: bounds });

  useEffect(
    () => {
      if (!targetRef?.current) {
        return;
      }
      const observer = new ResizeObserver(([entry]) => {
        setBoundsInitialized(true);
        setBounds(entry?.contentRect || DEFAULT_VIEW_BOUNDS);
      });
      observer.observe(targetRef.current);
      return () => {
        observer.disconnect();
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // Only want to set up the ResizeObserver on mount
  );

  return { bounds, boundsChanged, boundsInitialized };
};
