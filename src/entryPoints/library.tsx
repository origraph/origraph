import { FC, JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, ButtonProps } from '../components/basic-ui/Button/Button';
import { Icon, IconProps } from '../components/basic-ui/Icon/Icon';
import { Input, InputProps } from '../components/basic-ui/Input/Input';
import {
  Menu,
  MenuItemProps,
  MenuProps,
} from '../components/basic-ui/Menu/Menu';
import { omit } from '../utils/core/omit';

function createRenderFunction<T extends JSX.IntrinsicAttributes>(
  Component: FC<T>
) {
  return (
    props: T & {
      targetElement: Element;
    }
  ) =>
    createRoot(props.targetElement).render(
      <Component {...(omit(props, ['targetElement']) as T)} />
    );
}

export type { MenuItemProps };
export const components = {
  basicUi: {
    renderButton: createRenderFunction<ButtonProps & JSX.IntrinsicAttributes>(
      Button
    ),
    renderIcon: createRenderFunction<IconProps & JSX.IntrinsicAttributes>(Icon),
    renderInput: createRenderFunction<InputProps & JSX.IntrinsicAttributes>(
      Input
    ),
    renderMenu: createRenderFunction<MenuProps & JSX.IntrinsicAttributes>(Menu),
  },
};
