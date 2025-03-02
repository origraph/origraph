import classNames from 'classnames';
import { FC, ReactElement } from 'react';
import './Icon.css';

export type IconProps = {
  className?: string;
  'data-testid'?: string;
} & (
  | {
      src?: never;
      srcSvg?: never;
      character: string;
      component?: never;
      embedInSvg?: never;
    }
  | {
      src: string;
      srcSvg?: never;
      character?: never;
      component?: never;
      embedInSvg?: never;
    }
  | {
      src?: never;
      srcSvg: string;
      character?: never;
      component?: never;
      embedInSvg?: never;
    }
  | {
      src?: never;
      srcSvg?: never;
      character?: never;
      component: () => ReactElement;
      embedInSvg?: never;
    }
  | {
      src: string;
      srcSvg?: never;
      character?: never;
      component?: never;
      embedInSvg: { size: number; mask: string; wrapperClass?: string };
    }
  | {
      src: never;
      srcSvg?: string;
      character?: never;
      component?: never;
      embedInSvg: { size: number; mask: string; wrapperClass?: string };
    }
);

export const Icon: FC<IconProps> = ({
  src: regularSrc,
  srcSvg,
  character,
  component,
  embedInSvg,
  className,
}) => {
  let src = regularSrc;
  if (srcSvg) {
    // REALLY annoying: React doesn't seem to cooperate with inline mask-image:
    // url() for SVG images unless they're base64-encoded. This was totally fine
    // with preact... TODO: should probably figure out how to configure this
    // with vite instead

    // Also, this may be unnecessary for embedInSvg?
    src = `data:image/svg+xml;base64,${btoa(srcSvg)}`;
  }
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
      style={{ maskImage: src && `url(${src})` }}
    >
      {character || component?.() || ''}
    </div>
  );
};
