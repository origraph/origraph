import classNames from 'classnames';
import { FC, useContext, useMemo } from 'react';
import { DEFAULT_VIEW_DESCRIPTION } from '../../../constants/ui';
import collapseImg from '../../../logos/ui/collapse.svg?raw';
import expandImg from '../../../logos/ui/expand.svg?raw';
import hamburgerImg from '../../../logos/ui/hamburger.svg?raw';
import { useViewContext } from '../../../utils/ui/useViewContext';
import { Button, ButtonProps } from '../../basic-ui/Button/Button';
import { Menu, MenuItem, MenuItemProps } from '../../basic-ui/Menu/Menu';
import { SpaceDividerContext } from '../SpaceDivider/SpaceDivider';
import './TitleBar.css';

type TitleBarProps = {
  'data-testid'?: string;
  className?: string;
  minimized?: boolean;
  viewIri: string;
} & (
  | {
      minimized?: never | false;
      menuItemProps: (MenuItemProps & { key: string })[];
      shortcuts?: (ButtonProps & { key: string })[];
    }
  | {
      minimized: true;
      menuItemProps?: never;
      shortcuts?: never;
    }
);

export const TitleBar: FC<TitleBarProps> = ({
  'data-testid': testid,
  className,
  menuItemProps,
  minimized,
  shortcuts,
  viewIri,
}) => {
  const { title, subtitle } =
    useViewContext(viewIri)?.description || DEFAULT_VIEW_DESCRIPTION;
  const { minimizeView, restoreView } = useContext(SpaceDividerContext);

  const shortcutButtons = useMemo(
    () =>
      shortcuts?.map(({ key, ...buttonProps }) => (
        <Button key={key} collapse {...buttonProps} />
      )) || [],
    [shortcuts]
  );

  const menuItems = useMemo(
    () =>
      menuItemProps?.map(({ key, ...menuItemProps }) => (
        <MenuItem key={key} collapse {...menuItemProps} />
      )) || [],
    [menuItemProps]
  );

  return (
    <nav
      className={classNames(['origraph-title-bar', className], { minimized })}
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
      {menuItems.length > 0 ? (
        <Menu label="View Menu" leftIcons={[{ srcSvg: hamburgerImg }]} collapse>
          {menuItems}
        </Menu>
      ) : null}
      {minimized ? (
        <Button
          collapse
          className="minimal"
          leftIcons={[{ srcSvg: expandImg }]}
          onClick={() => restoreView(viewIri)}
        >
          Restore
        </Button>
      ) : (
        <Button
          collapse
          className="minimal"
          leftIcons={[{ srcSvg: collapseImg }]}
          onClick={() => minimizeView(viewIri)}
        >
          Minimize
        </Button>
      )}
      {
        // TODO: close button
      }
    </nav>
  );
};
