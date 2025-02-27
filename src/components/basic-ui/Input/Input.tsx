import classNames from 'classnames';
import { forwardRef, ReactElement, useMemo, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { omit } from '../../../utils/core/omit';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  renderWhenUnfocused?: (
    props: React.InputHTMLAttributes<HTMLInputElement>
  ) => ReactElement;
  'data-testid'?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (props = {}, ref) => {
    const localRef = useRef(null);
    const title = props.title || props['aria-label'] || undefined;
    const ariaLabel = props['aria-label'] || props.title || undefined;
    const id = useMemo(() => props.id || uuid(), [props.id]);

    const [isFocused, setIsFocused] = useState(false);

    const mainInputProps: React.InputHTMLAttributes<HTMLInputElement> = useMemo(
      () => ({
        ...omit(props, ['class', 'renderWhenUnfocused', 'labelProps']),
        id,
        className: classNames('Input', props.className),
        ref: ref || localRef,
        'aria-label': ariaLabel,
        title,
        onFocus: (...args) => {
          setIsFocused(true);
          props.onFocus?.(...args);
        },
        onBlur: (...args) => {
          setIsFocused(false);
          props.onBlur?.(...args);
        },
      }),
      [ariaLabel, id, props, ref, title, setIsFocused]
    );

    return !isFocused && props.renderWhenUnfocused ? (
      props.renderWhenUnfocused(mainInputProps)
    ) : (
      <input key="main" {...mainInputProps} />
    );
  }
);
Input.displayName = 'Input';
