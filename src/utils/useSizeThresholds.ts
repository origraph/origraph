import { useMemo } from 'preact/hooks';

export const THRESHOLDS = {
  TinyViewThreshold: '--tiny-view-threshold',
  SmallViewThreshold: '--small-view-threshold',
  LargeViewThreshold: '--large-view-threshold',
  HugeViewThreshold: '--huge-view-threshold',
} as const;

export enum UI_SIZE_TYPE {
  Tiny = 'Tiny',
  Small = 'Small',
  Normal = 'Normal',
  Large = 'Large',
  Huge = 'Huge',
}

export type Threshold = keyof typeof THRESHOLDS;

export const useSizeThresholds = () =>
  useMemo(() => {
    const style = getComputedStyle(document.body);
    return Object.fromEntries(
      Object.entries(THRESHOLDS).map(([threshold, cssVariable]) => {
        const value = parseInt(style.getPropertyValue(cssVariable), 10);
        if (isNaN(value)) {
          console.warn(`Required CSS variable ${cssVariable} is missing!`);
          return [threshold, 360];
        }
        return [threshold, value];
      })
    ) as Record<Threshold, number>;
  }, []);

export const categorizeViewDimension = ({
  size,
  thresholds,
}: {
  size: number;
  thresholds: Record<Threshold, number>;
}) => {
  if (size <= thresholds.TinyViewThreshold) {
    return UI_SIZE_TYPE.Tiny;
  }
  if (size <= thresholds.SmallViewThreshold) {
    return UI_SIZE_TYPE.Small;
  }
  if (size >= thresholds.LargeViewThreshold) {
    return UI_SIZE_TYPE.Large;
  }
  if (size >= thresholds.HugeViewThreshold) {
    return UI_SIZE_TYPE.Huge;
  }
};
