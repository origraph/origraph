import { Menu, MenuItem } from 'components/basic-ui/Menu';
import { JSXInternal } from 'preact/src/jsx';
import {
  POINTER_MODE,
  POINTER_MODE_KEYBOARD_MODIFIERS,
  POINTER_MODE_LABELS,
} from './constants';
import { LAYOUT_NAME, NeldSettings } from './NeldPositionGenerator';

export type Tool = (props: {
  key: number;
  showLabel: boolean;
}) => JSXInternal.Element;

export const NeldMenu = ({
  settings,
  setSettings,
  layoutIsRunning,
  stopLayout,
  restartLayout,
}: {
  settings: NeldSettings;
  setSettings: (settings: NeldSettings) => void;
  layoutIsRunning: boolean;
  stopLayout: () => void;
  restartLayout: () => void;
}) => {
  const layoutButtonText = layoutIsRunning ? 'Stop Layout' : 'Run Layout';

  return (
    <Menu
      class="NeldMenu"
      label="Settings"
      forceCollapse
      leftIcons={[{ src: '../static/img/Gear.svg' }]}
      splitRight
    >
      <Menu label="Layout">
        <MenuItem
          label={layoutButtonText}
          onClick={() => (layoutIsRunning ? stopLayout() : restartLayout())}
          leftIcons={[{ character: layoutIsRunning ? '⏹' : '⯈' }]}
        />
        <Menu label="Algorithm">
          {Object.values(LAYOUT_NAME).map((label) => (
            <MenuItem
              key={label}
              label={label}
              onClick={() => {
                setSettings({
                  ...settings,
                  currentLayout: label,
                });
              }}
              leftIcons={
                settings.currentLayout === label
                  ? [{ character: '✓' }]
                  : undefined
              }
            />
          ))}
        </Menu>
        {/*
        Scope menu isn't really implemented yet... also not sure
        why the submenu won't show up?
        <Menu label="Scope">
          {Object.values(PIN_MODE).map((pinMode) => (
            <MenuItem
              key={pinMode}
              label={PIN_MODE_LABELS[pinMode]}
              onClick={() => {
                setSettings({
                  ...settings,
                  pinMode,
                });
              }}
              leftIcons={
                settings.pinMode === pinMode ? [{ character: '✓' }] : undefined
              }
            />
          ))}
        </Menu> */}
        <MenuItem
          label="Auto-run layout"
          onClick={() => {
            setSettings({
              ...settings,
              autoLayoutIsEnabled: !settings.autoLayoutIsEnabled,
            });
          }}
          leftIcons={
            settings.autoLayoutIsEnabled ? [{ character: '✓' }] : undefined
          }
        />
      </Menu>
      <Menu
        label="Current Tool"
        leftIcons={[{ src: `../static/img/${settings.pointerMode}.svg` }]}
      >
        {Object.values(POINTER_MODE).map((pointerMode) => (
          <MenuItem
            key={pointerMode}
            label={POINTER_MODE_LABELS[pointerMode]}
            onClick={() => {
              setSettings({
                ...settings,
                pointerMode,
              });
            }}
            leftIcons={[
              ...(settings.pointerMode === pointerMode
                ? [{ character: '✓' }]
                : []),
              { src: `../static/img/${pointerMode}.svg` },
            ]}
            shortcutHint={POINTER_MODE_KEYBOARD_MODIFIERS[pointerMode]}
          />
        ))}
      </Menu>
      <MenuItem
        label="Show help text"
        onClick={() => {
          setSettings({
            ...settings,
            showHelp: !settings.showHelp,
          });
        }}
        leftIcons={settings.showHelp ? [{ character: '✓' }] : undefined}
      />
    </Menu>
  );
};
