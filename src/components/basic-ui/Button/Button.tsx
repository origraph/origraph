import classNames from 'classnames';
import { forwardRef, ReactElement, useMemo, useRef } from 'react';
import { omit } from '../../../utils/core/omit';
import { Icon, IconProps } from '../Icon/Icon';
import { MenuProps } from '../Menu/Menu';
import './Button.css';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  leftIcons?: IconProps[];
  collapse?: boolean;
  rightIcons?: IconProps[];
  shortcutHint?: string;
  'data-testid'?: string;
  // TODO: tooltip?: ...
} & (
    | {
        renderLeftMenu?: (props: MenuProps) => ReactElement;
        splitLeft?: never;
      }
    | {
        renderLeftMenu?: never;
        splitLeft?: boolean;
      }
  ) &
  (
    | {
        renderRightMenu?: (props: MenuProps) => ReactElement;
        splitRight?: never;
      }
    | {
        renderRightMenu?: never;
        splitRight?: boolean;
      }
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (props = {}, ref) => {
    const localRef = useRef(null);
    const title = props.title || props['aria-label'] || undefined;
    const ariaLabel = props['aria-label'] || props.title || undefined;

    const buttonChunks = useMemo(() => {
      let content = props.children;
      if (props.collapse) {
        content = null;
      }

      const leftIconCount = props.leftIcons?.length || 0;
      const rightIconCount = props.rightIcons?.length || 0;
      const splitLeft =
        Boolean(props.splitLeft) || Boolean(props.renderLeftMenu);
      const splitRight =
        Boolean(props.splitRight) || Boolean(props.renderRightMenu);
      // Buttons can shrink a little when they only contain a single icon
      const singleIconButton =
        !content &&
        !splitLeft &&
        !splitRight &&
        !props.shortcutHint &&
        ((leftIconCount === 1 && rightIconCount === 0) ||
          (leftIconCount === 0 && rightIconCount === 1));
      const chunks = [
        <button
          key="main"
          {...omit(props, [
            'className',
            'collapse',
            'leftIcons',
            'rightIcons',
            'splitLeft',
            'splitRight',
            'renderLeftMenu',
            'renderRightMenu',
          ])}
          className={classNames(
            'origraph-button',
            {
              splitLeft,
              splitRight,
              singleIconButton,
            },
            props.className
          )}
          ref={ref || localRef}
          aria-label={ariaLabel}
          title={title}
        >
          {(props.leftIcons || []).map((iconProps, index) => (
            <Icon
              key={index}
              {...iconProps}
              className={classNames(iconProps.className)}
            />
          ))}
          {content}
          {/* <div className="gap" /> */}
          {props.shortcutHint ? (
            <div className="shortcutHint">{props.shortcutHint}</div>
          ) : null}
          {(props.rightIcons || []).map((iconProps, index) => (
            <Icon
              key={index}
              {...iconProps}
              className={classNames(iconProps.className)}
            />
          ))}
        </button>,
      ];
      if (props.renderLeftMenu) {
        chunks.unshift(
          props.renderLeftMenu({
            splitRight: true,
            label: 'Left dropdown',
            leftIcons: [{ character: '❮' }],
            collapse: true,
          })
        );
      }
      if (props.renderRightMenu) {
        chunks.push(
          props.renderRightMenu({
            splitLeft: true,
            label: 'Right dropdown',
            rightIcons: [{ character: '❯' }],
            collapse: true,
          })
        );
      }
      return chunks;
    }, [ariaLabel, props, ref, title]);

    return buttonChunks.length > 1 ? (
      <div className="origraph-button-wrapper">{...buttonChunks}</div>
    ) : (
      buttonChunks[0]
    );
  }
);
Button.displayName = 'Button';
