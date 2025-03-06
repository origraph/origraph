import classNames from 'classnames';
import { noop } from 'constants/empty';
import functions from 'lodash.functions';
import isEqual from 'lodash.isequal';
import omit from 'lodash.omit';
import { ComponentChildren, VNode, createContext } from 'preact';
import { Children } from 'preact/compat';
import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import { JSXInternal } from 'preact/src/jsx';
import {
  SPACE_LAYOUT,
  SPACE_ORIENTATION,
  SpaceDivision,
  divideAvailableSpace,
} from 'utils/divideAvailableSpace';
import usePrevious from 'utils/usePrevious';
import {
  UI_SIZE_TYPE,
  categorizeViewDimension,
  useSizeThresholds,
} from 'utils/useSizeThresholds';
import { useViewBounds } from 'utils/useViewBounds';
import { Button, ButtonProps } from './Button';

export enum SPACE_SECTION {
  Main = 1,
  Sidebar = 2,
}

export type SpacedViewChildProps = {
  viewId: string;
  section?: SPACE_SECTION;
};
export type SpacedViewTabProps = ButtonProps & {
  label: string;
  forceUpdate?: boolean;
};

const LOADING_TAB_PROPS: SpacedViewTabProps = {
  label: '...',
};

export const SpaceDividerContext = createContext<{
  tabPropsByViewId: Record<string, SpacedViewTabProps>;
  setTabPropsForViewId: (id: string, props: SpacedViewTabProps) => void;
  adaptForUiSize: {
    width: UI_SIZE_TYPE;
    height: UI_SIZE_TYPE;
    mainAxis: UI_SIZE_TYPE;
  };
  spaceDivision: SpaceDivision;
}>({
  tabPropsByViewId: {},
  setTabPropsForViewId: noop,
  adaptForUiSize: {
    width: UI_SIZE_TYPE.Normal,
    height: UI_SIZE_TYPE.Normal,
    mainAxis: UI_SIZE_TYPE.Normal,
  },
  spaceDivision: {
    layout: SPACE_LAYOUT.flex,
    orientation: SPACE_ORIENTATION.row,
    visibleViewIds: [],
    hiddenViewIds: [],
    parentStyle: undefined,
    styleByViewId: undefined,
  },
});

export const SpaceDivider = ({
  children,
  emptyState,
  extraNavContent,
  hideTabsForSingleView,
}: {
  emptyState: string;
  extraNavContent?: JSXInternal.Element;
  hideTabsForSingleView?: boolean;
  children:
    | VNode<SpacedViewChildProps>
    | VNode<SpacedViewChildProps>[]
    | ComponentChildren;
}) => {
  const ref = useRef<null | HTMLDivElement>(null);
  const { bounds, boundsChanged } = useViewBounds(ref);

  const thresholds = useSizeThresholds();

  const [lastActivatedKeyQueue, setLastActivatedKeyQueue] = useState<string[]>(
    []
  );

  const [tabPropsByViewId, setTabPropsByViewId] = useState<
    Record<string, SpacedViewTabProps>
  >({});
  const setTabPropsForViewId = useCallback(
    (id: string, props: SpacedViewTabProps) => {
      if (
        !isEqual(
          omit(tabPropsByViewId[id], functions(tabPropsByViewId[id])),
          omit(props, functions(tabPropsByViewId[id]))
        )
      ) {
        setTabPropsByViewId({
          ...tabPropsByViewId,
          [id]: props,
        });
      }
    },
    [tabPropsByViewId, setTabPropsByViewId]
  );

  const { viewByViewId, viewIdParentOrder, sectionByViewId } = useMemo(() => {
    const viewIdParentOrder: string[] = [];
    const viewByViewId: Record<string, VNode<SpacedViewChildProps>> = {};
    const sectionByViewId: Record<string, SPACE_SECTION> = {};
    Children.forEach(children, (child) => {
      const typedChild = child as VNode<SpacedViewChildProps>;
      const viewId = typedChild?.props?.viewId;
      if (!viewId) {
        return;
      }
      viewIdParentOrder.push(viewId);
      viewByViewId[viewId] = typedChild;
      sectionByViewId[viewId] =
        typedChild?.props?.section || SPACE_SECTION.Sidebar;
    });
    return { viewByViewId, viewIdParentOrder, sectionByViewId };
  }, [children]);

  const viewIdPriorityOrder = useMemo(
    () =>
      viewIdParentOrder.concat().sort((a, b) => {
        // Sort first by section
        if (sectionByViewId[a] !== sectionByViewId[b]) {
          return sectionByViewId[a] - sectionByViewId[b];
        }
        // Sort by which view was last activated
        const aActivationIndex = lastActivatedKeyQueue.indexOf(a);
        const bActivationIndex = lastActivatedKeyQueue.indexOf(b);
        if (aActivationIndex !== -1) {
          if (bActivationIndex !== -1) {
            return aActivationIndex - bActivationIndex;
          }
          return -1;
        } else if (bActivationIndex !== -1) {
          return 1;
        }
        // Sort by the order that the parent added the view
        return 0;
      }),
    [lastActivatedKeyQueue, viewIdParentOrder, sectionByViewId]
  );

  const rawSpaceDivision = useMemo(() => {
    return divideAvailableSpace({ bounds, thresholds, viewIdPriorityOrder });
  }, [bounds, thresholds, viewIdPriorityOrder]);

  const previousSpaceDivision = usePrevious(rawSpaceDivision);

  const spaceDivision = useMemo(
    () =>
      // To minimize thrashing, don't apply updated layouts unless the
      // viewport or visible views have actually changed
      !boundsChanged &&
      isEqual(
        new Set(rawSpaceDivision.visibleViewIds),
        new Set(previousSpaceDivision.visibleViewIds)
      )
        ? previousSpaceDivision
        : rawSpaceDivision,
    [boundsChanged, previousSpaceDivision, rawSpaceDivision]
  );

  const adaptForUiSize = useMemo(() => {
    const width =
      categorizeViewDimension({
        size: bounds.width,
        thresholds,
      }) || UI_SIZE_TYPE.Normal;
    const height =
      categorizeViewDimension({
        size: bounds.width,
        thresholds,
      }) || UI_SIZE_TYPE.Normal;
    const mainAxis =
      spaceDivision.orientation === SPACE_ORIENTATION.row ? width : height;
    return { width, height, mainAxis };
  }, [bounds, spaceDivision.orientation, thresholds]);

  const logViewInteraction = useCallback(
    (viewId: string) => {
      setLastActivatedKeyQueue([
        viewId,
        ...lastActivatedKeyQueue.filter((id) => id !== viewId),
      ]);
    },
    [lastActivatedKeyQueue, setLastActivatedKeyQueue]
  );

  return (
    <SpaceDividerContext.Provider
      value={{
        tabPropsByViewId,
        setTabPropsForViewId,
        adaptForUiSize,
        spaceDivision,
      }}
    >
      <div
        class={classNames(
          'SpaceDivider',
          spaceDivision.orientation,
          spaceDivision.layout,
          adaptForUiSize.mainAxis.toLowerCase()
        )}
        ref={ref}
      >
        <div class="offscreen">
          {spaceDivision.hiddenViewIds.map((viewId) => viewByViewId[viewId])}
        </div>
        <div class="wrapper" style={spaceDivision.parentStyle}>
          {spaceDivision.visibleViewIds.map((viewId) => viewByViewId[viewId])}
          {spaceDivision.visibleViewIds.length === 0 ? (
            <div class="emptyState">{emptyState}</div>
          ) : null}
        </div>
        {hideTabsForSingleView && viewIdParentOrder.length <= 1 ? null : (
          <nav class="tabs">
            <ul>
              {extraNavContent}
              {viewIdParentOrder.map((viewId) => {
                const tabProps = tabPropsByViewId[viewId] || LOADING_TAB_PROPS;
                const button = (
                  // @ts-expect-error: preact issues with SignalLike<>
                  <Button
                    {...omit(tabProps, ['label', 'class'])}
                    class={classNames(
                      {
                        active: spaceDivision.visibleViewIds.includes(viewId),
                      },
                      tabProps.class
                    )}
                    onClick={() => logViewInteraction(viewId)}
                  >
                    {tabProps.label}
                  </Button>
                );
                return <li key={viewId}>{button}</li>;
              })}
            </ul>
          </nav>
        )}
      </div>
    </SpaceDividerContext.Provider>
  );
};
