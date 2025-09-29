import classNames from 'classnames';
import { FC, useContext, useMemo } from 'react';
import { DEFAULT_VIEW_DESCRIPTION } from '../../../constants/ui';
import collapseImg from '../../../logos/ui/collapse.svg?raw';
import expandImg from '../../../logos/ui/expand.svg?raw';
import hamburgerImg from '../../../logos/ui/hamburger.svg?raw';
import saveImg from '../../../logos/ui/save.svg?raw';
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
  menuItemProps?: (MenuItemProps & { key: string })[];
  handleSaveEdits?: () => void;
} & (
  | {
      minimized?: never | false;
      shortcuts?: (ButtonProps & { key: string })[];
    }
  | {
      minimized: true;
      shortcuts?: never;
    }
);

export const TitleBar: FC<TitleBarProps> = ({
  'data-testid': testid,
  className,
  menuItemProps,
  handleSaveEdits,
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

  const defaultMenuItemProps = useMemo(
    () =>
      handleSaveEdits
        ? [
            {
              key: 'save',
              collapse: false,
              disabled: true,
              className: 'minimal',
              leftIcons: [{ srcSvg: saveImg }],
              label: 'Save',
            },
          ]
        : [],
    [handleSaveEdits]
  );

  const menuItems = useMemo(
    () =>
      [...defaultMenuItemProps, ...(menuItemProps || [])].map(
        ({ key, ...menuItemProps }) => (
          <MenuItem key={key} collapse {...menuItemProps} />
        )
      ) || [],
    [defaultMenuItemProps, menuItemProps]
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
