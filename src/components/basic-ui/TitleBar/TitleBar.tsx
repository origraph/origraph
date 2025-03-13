import classNames from 'classnames';
import { FC, useMemo } from 'react';
import hamburgerImg from '../../../logos/ui/hamburger.svg?raw';
import { Button, ButtonProps } from '../Button/Button';
import { Menu, MenuItem, MenuItemProps } from '../Menu/Menu';
import './TitleBar.css';

type TitleBarProps = {
  title: string;
  subtitle?: string;
  className?: string;
  'data-testid'?: string;
  shortcuts?: (ButtonProps & { key: string })[];
  menuItemProps: (MenuItemProps & { key: string })[];
};

export const TitleBar: FC<TitleBarProps> = ({
  title,
  subtitle,
  className,
  'data-testid': testid,
  shortcuts,
  menuItemProps,
}) => {
  const shortcutButtons = useMemo(
    () =>
      shortcuts?.map(({ key, ...buttonProps }) => (
        <Button key={key} collapse {...buttonProps} />
      )),
    [shortcuts]
  );

  const menuItems = useMemo(
    () =>
      menuItemProps?.map(({ key, ...menuItemProps }) => (
        <MenuItem key={key} collapse {...menuItemProps} />
      )),
    [menuItemProps]
  );

  return (
    <nav
      className={classNames(['origraph-title-bar', className])}
      data-testid={testid || null}
    >
      {
        // TODO: drag handle
      }
      <div className="title">
        <h4>{title}</h4>
        {subtitle ? <h5>{subtitle}</h5> : null}
      </div>

      <div className="spacer" />

      {shortcutButtons}
      <Menu label="View Menu" leftIcons={[{ srcSvg: hamburgerImg }]} collapse>
        {menuItems}
      </Menu>
      {
        // TODO: close button
      }
    </nav>
  );
};
