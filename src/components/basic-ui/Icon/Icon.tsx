import classNames from 'classnames';
import { FC, ReactElement } from 'react';
import './Icon.css';

export type IconProps = {
  className?: string;
  'data-testid'?: string;
} & (
  | { src?: never; character: string; component?: never; embedInSvg?: never }
  | { src: string; character?: never; component?: never; embedInSvg?: never }
  | {
      src?: never;
      character?: never;
      component: () => ReactElement;
      embedInSvg?: never;
    }
  | {
      src: string;
      character?: never;
      component?: never;
      embedInSvg: { size: number; mask: string; wrapperClass?: string };
    }
);

export const Icon: FC<IconProps> = ({
  src,
  character,
  component,
  embedInSvg,
  className,
}) => {
  if (embedInSvg) {
    // TODO: for now, doing a 2px workaround for some oddities in how mask-image happens to render...
    const buffer = 2;
    const radius = embedInSvg.size / 2 + buffer;
    return (
      <g className={classNames([embedInSvg.wrapperClass])}>
        <rect
          className="origraph-icon-mask"
          x={-radius}
          y={-radius}
          width={radius * 2}
          height={radius * 2}
          style={{
            mask: `url(${embedInSvg.mask}) ${buffer}px ${buffer}px / ${embedInSvg.size}px ${embedInSvg.size}px no-repeat`,
          }}
        />
        <rect
          className={classNames(['origraph-icon', className])}
          x={-radius}
          y={-radius}
          width={radius * 2}
          height={radius * 2}
          fill="currentColor"
          style={{
            mask: `url(${src}) ${buffer}px ${buffer}px / ${embedInSvg.size}px ${embedInSvg.size}px no-repeat`,
          }}
        />
      </g>
    );
  }
  return (
    <div
      className={classNames([
        'origraph-icon',
        className,
        { useMask: Boolean(src), characterAsIcon: Boolean(character) },
      ])}
      style={src ? { maskImage: `url('${src}')` } : undefined}
    >
      {character || component?.() || ''}
    </div>
  );
};
