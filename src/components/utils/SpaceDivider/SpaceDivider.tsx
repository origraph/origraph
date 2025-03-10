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
  useMemo,
  useRef,
  useState,
} from 'react';
import { BaseViewState } from '../../../state/Perspectives';
import { omit } from '../../../utils/core/omit';
import usePrevious from '../../../utils/core/usePrevious';
import {
  categorizeViewDimension,
  UI_SIZE_TYPE,
  useSizeThresholds,
} from '../../../utils/ui/useSizeThresholds';
import { useViewBounds } from '../../../utils/ui/useViewBounds';
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
    return divideAvailableSpace({ bounds, thresholds, viewIriPriorityOrder });
  }, [bounds, thresholds, viewIriPriorityOrder]);

  const previousSpaceDivision = usePrevious(rawSpaceDivision);

  const spaceDivision = useMemo(
    () =>
      // To minimize thrashing, don't apply updated layouts unless the
      // viewport or visible views have actually changed
      !boundsChanged &&
      isEqual(
        new Set(rawSpaceDivision.visibleViewIris),
        new Set(previousSpaceDivision.visibleViewIris)
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
    (viewIri: string) => {
      setLastActivatedViewIriQueue([
        viewIri,
        ...lastActivatedViewIriQueue.filter((id) => id !== viewIri),
      ]);
    },
    [lastActivatedViewIriQueue, setLastActivatedViewIriQueue]
  );

  const visibleElements = useMemo(
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
    [spaceDivision.visibleViewIris, spaceDivision.stylesByViewIri]
  );

  return (
    <SpaceDividerContext.Provider
      value={{
        spaceSize: adaptForUiSize,
        spaceDivision,
      }}
    >
      <div
        {...omit(props, ['children', 'emptyState'])}
        className={classNames(
          'SpaceDivider',
          spaceDivision.orientation,
          spaceDivision.layout,
          adaptForUiSize.mainAxis.toLowerCase(),
          props.className
        )}
        ref={ref}
      >
        <div className="SpaceDivider-offscreen">
          {spaceDivision.hiddenViewIris.map(
            (viewIri) => childByViewIri[viewIri]
          )}
        </div>
        <div className="SpaceDivider-content" style={spaceDivision.parentStyle}>
          {visibleElements}
          {spaceDivision.visibleViewIris.length === 0 ? (
            <div className="SpaceDivider-emptyState">{props.emptyState}</div>
          ) : null}
        </div>
      </div>
    </SpaceDividerContext.Provider>
  );
};
