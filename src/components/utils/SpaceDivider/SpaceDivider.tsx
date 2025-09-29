import classNames from 'classnames';
import isEqual from 'lodash.isequal';
import {
  Children,
  cloneElement,
  createContext,
  FC,
  HTMLAttributes,
  isValidElement,
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import useDebouncedEffect from 'use-debounced-effect';
import { noop } from '../../../constants/empty';
import { BaseViewState } from '../../../state/Perspectives';
import { omit } from '../../../utils/core/omit';
import usePrevious from '../../../utils/core/usePrevious';
import {
  categorizeViewDimension,
  UI_SIZE_TYPE,
  useSizeThresholds,
} from '../../../utils/ui/useSizeThresholds';
import { useViewBounds } from '../../../utils/ui/useViewBounds';
import { TitleBar } from '../TitleBar/TitleBar';
import {
  divideAvailableSpace,
  SPACE_LAYOUT,
  SPACE_ORIENTATION,
  SpaceDivision,
} from './divideAvailableSpace';
import './SpaceDivider.css';

export enum SPACE_SECTION {
  Main = 1,
  Sidebar = 2,
}

export const SpaceDividerContext = createContext<{
  spaceSize: {
    width: UI_SIZE_TYPE;
    height: UI_SIZE_TYPE;
    mainAxis: UI_SIZE_TYPE;
  };
  spaceDivision: SpaceDivision;
  tempShrinkStaticSizes: boolean;
  minimizeView: (viewIri: string) => void;
  restoreView: (viewIri: string) => void;
}>({
  spaceSize: {
    width: UI_SIZE_TYPE.Normal,
    height: UI_SIZE_TYPE.Normal,
    mainAxis: UI_SIZE_TYPE.Normal,
  },
  spaceDivision: {
    layout: SPACE_LAYOUT.flex,
    orientation: SPACE_ORIENTATION.row,
    visibleViewIris: [],
    hiddenViewIris: [],
    parentStyle: { display: 'flex' },
    stylesByViewIri: undefined,
    rectanglesByViewIri: undefined,
  },
  tempShrinkStaticSizes: true,
  minimizeView: noop,
  restoreView: noop,
});

type SpaceDividerChild = ReactElement<HTMLElement & BaseViewState>;

type SpaceDividerProps = HTMLAttributes<HTMLDivElement> & {
  children: SpaceDividerChild[];
  emptyState: ReactNode;
};

export const SpaceDivider: FC<SpaceDividerProps> = (props) => {
  const ref = useRef<null | HTMLDivElement>(null);
  const { bounds, boundsChanged } = useViewBounds(ref);
  const thresholds = useSizeThresholds();
  const [lastActivatedViewIriQueue, setLastActivatedViewIriQueue] = useState<
    string[]
  >([]);
  const [explicitlyMinimizedViewIriOrder, setExplicitlyMinimizedViewIriOrder] =
    useState<string[]>([]);
  const [tempShrink, setTempShrink] = useState(true);

  const { childByViewIri, parentViewIriOrder, sectionByViewIri } =
    useMemo(() => {
      const childByViewIri: Record<string, SpaceDividerChild> = {};
      const parentViewIriOrder: string[] = [];
      const sectionByViewIri: Record<string, SPACE_SECTION> = {};
      Children.forEach(props.children, (child) => {
        if (!isValidElement(child) || !child?.props?.viewIri) {
          return;
        }
        childByViewIri[child.props.viewIri] = child;
        parentViewIriOrder.push(child.props.viewIri);
        sectionByViewIri[child.props.viewIri] =
          child.props.section || SPACE_SECTION.Sidebar;
      });
      return { childByViewIri, parentViewIriOrder, sectionByViewIri };
    }, [props.children]);

  const viewIriPriorityOrder = useMemo(
    () =>
      parentViewIriOrder.concat().sort((a, b) => {
        // Sort first by section
        if (sectionByViewIri[a] !== sectionByViewIri[b]) {
          return sectionByViewIri[a] - sectionByViewIri[b];
        }
        // Sort by which view was last activated
        const aActivationIndex = lastActivatedViewIriQueue.indexOf(a);
        const bActivationIndex = lastActivatedViewIriQueue.indexOf(b);
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
    [lastActivatedViewIriQueue, parentViewIriOrder, sectionByViewIri]
  );

  const rawSpaceDivision = useMemo(() => {
    return divideAvailableSpace({
      bounds,
      thresholds,
      viewIriPriorityOrder,
      explicitlyMinimizedViewIriOrder,
    });
  }, [
    bounds,
    explicitlyMinimizedViewIriOrder,
    thresholds,
    viewIriPriorityOrder,
  ]);

  const previousSpaceDivision = usePrevious(rawSpaceDivision);
  const { spaceDivision, spaceDivisionUpdated } = useMemo(
    () =>
      // To minimize thrashing, don't apply updated layouts unless the
      // viewport or visible views have actually changed
      !boundsChanged &&
      isEqual(
        new Set(rawSpaceDivision.visibleViewIris),
        new Set(previousSpaceDivision.visibleViewIris)
      )
        ? {
            spaceDivision: previousSpaceDivision,
            spaceDivisionUpdated: false,
          }
        : {
            spaceDivision: rawSpaceDivision,
            spaceDivisionUpdated: true,
          },
    [boundsChanged, previousSpaceDivision, rawSpaceDivision]
  );

  useEffect(() => {
    // For views that apply inline sizes, tell them to temporarily shrink
    // themselves after a layout change, so that CSS won't be influenced.
    if (spaceDivisionUpdated) {
      setTempShrink(true);
    }
  }, [spaceDivisionUpdated, setTempShrink]);

  useDebouncedEffect(
    () => {
      // After the new layout has settled, tell statically-sized elements
      // to update themselves based on the new layout
      if (tempShrink) {
        setTempShrink(false);
      }
    },
    { timeout: 200, ignoreInitialCall: false },
    [tempShrink, setTempShrink]
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
    (viewIri: string) => {
      setLastActivatedViewIriQueue([
        viewIri,
        ...lastActivatedViewIriQueue.filter((id) => id !== viewIri),
      ]);
    },
    [lastActivatedViewIriQueue, setLastActivatedViewIriQueue]
  );

  const visibleViews = useMemo(
    () =>
      spaceDivision.visibleViewIris.map((viewIri) => {
        const mergedStyles = {
          ...(spaceDivision.stylesByViewIri?.[viewIri] || {}),
        } as CSSStyleDeclaration;
        return cloneElement(childByViewIri[viewIri], {
          ...childByViewIri[viewIri].props,
          style: mergedStyles,
          onfocus: () => logViewInteraction(viewIri),
        });
      }),
    [
      spaceDivision.visibleViewIris,
      spaceDivision.stylesByViewIri,
      childByViewIri,
      logViewInteraction,
    ]
  );

  const hiddenViewTitleBars = useMemo(
    () =>
      spaceDivision.hiddenViewIris.map((viewIri) => {
        return <TitleBar key={viewIri} viewIri={viewIri} minimized />;
      }),
    [spaceDivision.hiddenViewIris]
  );

  const minimizeView = useCallback(
    (viewIri: string) => {
      if (!explicitlyMinimizedViewIriOrder.includes(viewIri)) {
        setExplicitlyMinimizedViewIriOrder([
          ...explicitlyMinimizedViewIriOrder,
          viewIri,
        ]);
      }
    },
    [explicitlyMinimizedViewIriOrder]
  );

  const restoreView = useCallback(
    (viewIri: string) => {
      logViewInteraction(viewIri);
      if (explicitlyMinimizedViewIriOrder.includes(viewIri)) {
        setExplicitlyMinimizedViewIriOrder(
          explicitlyMinimizedViewIriOrder.filter((iri) => iri !== viewIri)
        );
      }
    },
    [explicitlyMinimizedViewIriOrder, logViewInteraction]
  );

  return (
    <SpaceDividerContext.Provider
      value={{
        spaceSize: adaptForUiSize,
        spaceDivision,
        tempShrinkStaticSizes: tempShrink,
        minimizeView,
        restoreView,
      }}
    >
      <div
        {...omit(props, ['children', 'emptyState'])}
        className={classNames(
          'SpaceDivider',
          spaceDivision.orientation,
          spaceDivision.layout,
          adaptForUiSize.mainAxis.toLowerCase(),
          props.className,
          { hasMinimizedViews: spaceDivision.hiddenViewIris.length > 0 }
        )}
        ref={ref}
      >
        {spaceDivision.hiddenViewIris.length > 0 ? (
          <>
            <div className="SpaceDivider-offscreen">
              {spaceDivision.hiddenViewIris.map(
                (viewIri) => childByViewIri[viewIri]
              )}
            </div>
            <div className="SpaceDivider-minimizedTitles">
              {hiddenViewTitleBars}
            </div>
          </>
        ) : null}
        <div className="SpaceDivider-content" style={spaceDivision.parentStyle}>
          {visibleViews}
          {spaceDivision.visibleViewIris.length === 0 ? (
            <div className="SpaceDivider-emptyState">{props.emptyState}</div>
          ) : null}
        </div>
      </div>
    </SpaceDividerContext.Provider>
  );
};
