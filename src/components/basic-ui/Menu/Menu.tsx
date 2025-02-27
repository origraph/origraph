// This file was loosely adapted from https://codesandbox.io/p/sandbox/admiring-lamport-5wt3yg

import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingList,
  FloatingNode,
  FloatingPortal,
  FloatingTree,
  offset,
  Placement,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
  useInteractions,
  useListItem,
  useListNavigation,
  useMergeRefs,
  useRole,
  useTypeahead,
} from '@floating-ui/react';
import {
  createContext,
  Dispatch,
  forwardRef,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button, ButtonProps } from '../Button/Button';

const MenuContext = createContext<{
  getItemProps: (
    userProps?: React.HTMLProps<HTMLElement>
  ) => Record<string, unknown>;
  activeIndex: number | null;
  setActiveIndex: Dispatch<SetStateAction<number | null>>;
  setHasFocusInside: Dispatch<SetStateAction<boolean>>;
  isOpen: boolean;
}>({
  getItemProps: () => ({}),
  activeIndex: null,
  setActiveIndex: () => {},
  setHasFocusInside: () => {},
  isOpen: false,
});

type ButtonRef = (node: HTMLButtonElement | null) => void;

export type MenuProps = ButtonProps & {
  label: string;
  nested?: boolean;
  children?: ReactNode;
  placement?: Placement;
  'data-testid'?: string;
};

export const MenuComponent = forwardRef<typeof Button, MenuProps>(
  (
    { children, label, placement: placementFromProps, ...props },
    forwardedRef
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [hasFocusInside, setHasFocusInside] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const elementsRef = useRef<Array<HTMLButtonElement | null>>([]);
    const labelsRef = useRef<Array<string | null>>([]);
    const parent = useContext(MenuContext);

    const tree = useFloatingTree();
    const nodeId = useFloatingNodeId();
    const parentId = useFloatingParentNodeId();
    const item = useListItem();

    const isNested = parentId != null;

    const rightIcons = useMemo(
      () =>
        (props.rightIcons || []).concat(isNested ? [{ character: '>' }] : []),
      [isNested, props.rightIcons]
    );

    const handleOpenChange = useCallback(
      (isOpen: boolean, event: Event | undefined) => {
        if (!isOpen) {
          // In theory, filtering these events should happen via
          // useDismiss({ outsidePress: (event) => boolean })
          // but ... that doesn't seem to work consistently in practice,
          // so we filter here
          if (event?.type === 'focusout') {
            // useDismiss is a little aggressive w.r.t. focusout events
            return;
          }
          if ((event?.target as Element)?.closest('.MenuItem')) {
            return;
          }
        }
        setIsOpen(isOpen);
      },
      [setIsOpen]
    );

    const placement = useMemo(
      () =>
        placementFromProps
          ? 'left-start'
          : isNested
            ? 'left-start'
            : 'top-start',
      [placementFromProps, isNested]
    );

    const { floatingStyles, refs, context } = useFloating<HTMLButtonElement>({
      nodeId,
      open: isOpen,
      onOpenChange: handleOpenChange,
      placement,
      middleware: [offset({ mainAxis: 4 }), flip(), shift()],
      whileElementsMounted: autoUpdate,
    });

    const click = useClick(context, {
      event: 'mousedown',
      toggle: !isNested,
    });
    const role = useRole(context, { role: 'menu' });
    const dismiss = useDismiss(context, {
      bubbles: true,
    });
    const listNavigation = useListNavigation(context, {
      listRef: elementsRef,
      activeIndex,
      nested: isNested,
      onNavigate: setActiveIndex,
    });
    const typeahead = useTypeahead(context, {
      listRef: labelsRef,
      onMatch: isOpen ? setActiveIndex : undefined,
      activeIndex,
    });

    const { getReferenceProps, getFloatingProps, getItemProps } =
      useInteractions([click, role, dismiss, listNavigation, typeahead]);

    // Event emitter allows you to communicate across tree components.
    // This effect closes all menus when an item gets clicked anywhere
    // in the tree.
    useEffect(() => {
      if (!tree) return;

      function handleTreeClick(_: Event) {
        setIsOpen(false);
      }

      function onSubMenuOpen(event: { nodeId: string; parentId: string }) {
        if (event.nodeId !== nodeId && event.parentId === parentId) {
          setIsOpen(false);
        }
      }

      tree.events.on('click', handleTreeClick);
      tree.events.on('menuopen', onSubMenuOpen);

      return () => {
        tree.events.off('click', handleTreeClick);
        tree.events.off('menuopen', onSubMenuOpen);
      };
    }, [tree, nodeId, parentId]);

    useEffect(() => {
      if (isOpen && tree) {
        tree.events.emit('menuopen', { parentId, nodeId });
      }
    }, [tree, isOpen, nodeId, parentId]);

    const button = (
      <Button
        ref={useMergeRefs<HTMLButtonElement>([
          refs.setReference,
          item.ref,
          forwardedRef as ButtonRef,
        ])}
        tabIndex={
          !isNested ? undefined : parent.activeIndex === item.index ? 0 : -1
        }
        role={isNested ? 'menuitem' : undefined}
        data-open={isOpen ? '' : undefined}
        data-nested={isNested ? '' : undefined}
        data-focus-inside={hasFocusInside ? '' : undefined}
        className={isNested ? 'origraph-menu-item' : 'origraph-root-menu'}
        // preventCollapse={isNested}
        {...props}
        {...getReferenceProps(
          parent.getItemProps({
            ...props,
            onFocus(event: React.FocusEvent<HTMLButtonElement>) {
              props.onFocus?.(event);
              setHasFocusInside(false);
              parent.setHasFocusInside(true);
            },
          })
        )}
        rightIcons={rightIcons}
      >
        {label}
      </Button>
    );

    return (
      <FloatingNode id={nodeId}>
        {button}
        <MenuContext.Provider
          value={{
            activeIndex,
            setActiveIndex,
            getItemProps,
            setHasFocusInside,
            isOpen,
          }}
        >
          <FloatingList elementsRef={elementsRef} labelsRef={labelsRef}>
            {isOpen && (
              <FloatingPortal>
                <FloatingFocusManager
                  context={context}
                  modal={false}
                  initialFocus={isNested ? -1 : 0}
                  returnFocus={!isNested}
                >
                  <div
                    ref={refs.setFloating}
                    className="origraph-menu"
                    style={floatingStyles}
                    {...getFloatingProps()}
                  >
                    {children}
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
            )}
          </FloatingList>
        </MenuContext.Provider>
      </FloatingNode>
    );
  }
);
MenuComponent.displayName = 'Menu Component';

export interface MenuItemProps {
  label: string;
  disabled?: boolean;
}

export const MenuItem = forwardRef<typeof Button, MenuItemProps & ButtonProps>(
  ({ label, disabled, ...props }, forwardedRef) => {
    const menu = useContext(MenuContext);
    const item = useListItem({ label: disabled ? null : label });
    const tree = useFloatingTree();
    const isActive = item.index === menu.activeIndex;

    return (
      <Button
        {...props}
        ref={useMergeRefs<HTMLButtonElement>([
          item.ref,
          forwardedRef as ButtonRef,
        ])}
        type="button"
        role="menuitem"
        className="origraph-menu-item"
        tabIndex={isActive ? 0 : -1}
        disabled={disabled}
        {...menu.getItemProps({
          onClick(event: React.MouseEvent<HTMLButtonElement>) {
            props.onClick?.(event);
            tree?.events.emit('click');
          },
          onFocus(event: React.FocusEvent<HTMLButtonElement>) {
            props.onFocus?.(event);
            menu.setHasFocusInside(true);
          },
        })}
      >
        {label}
      </Button>
    );
  }
);
MenuItem.displayName = 'Menu Item';

export const Menu = forwardRef<typeof Button, MenuProps>((props, ref) => {
  const parentId = useFloatingParentNodeId();
  const component = <MenuComponent {...props} ref={ref} />;

  if (parentId === null) {
    return <FloatingTree>{component}</FloatingTree>;
  }

  return component;
});
Menu.displayName = 'Menu';
