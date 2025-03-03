import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactGridLayout, { Responsive, WidthProvider } from 'react-grid-layout';
import { useImmer } from 'use-immer';
import '../../../node_modules/react-grid-layout/css/styles.css';
import '../../../node_modules/react-resizable/css/styles.css';
import { TrigView } from '../../components/views/TrigView/TrigView';
import { ViewComponent } from '../../components/views/types';
import {
  PerspectiveAspect,
  ViewType,
  VOCABULARY,
} from '../../constants/vocabulary';
import {
  Perspective,
  PerspectiveContext,
  PerspectiveManager,
  ViewState,
} from '../../state/Perspectives';
import { useDidValueChange } from '../../utils/core/useDidValueChange';
import { useIsMounted } from '../../utils/core/useIsMounted';
import { useSearchParams } from '../../utils/core/useSearchParams';
import './Editor.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const viewComponentByType: Record<ViewType, ViewComponent> = {
  [ViewType.TrigView]: TrigView,
};

export const getEmptyEditorContext = () => ({
  togglePerspectiveIri: (_perspectiveIri: string, _add: boolean) => {},
  viewStates: [],
});

export const EditorContext = createContext<{
  togglePerspectiveIri: (perspectiveIri: string, add: boolean) => void;
  viewStates: ViewState[];
  // TODO: functions for manipulating the current selection
}>(getEmptyEditorContext());

const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS_PER_LAYOUT = { lg: 3, md: 2, sm: 2, xs: 1, xxs: 1 };

const EditorViews = () => {
  const { viewStates } = useContext(EditorContext);
  const [layouts, _setLayouts] = useState<ReactGridLayout.Layouts>({
    // TODO: figure this GrigLayout shit out
  });

  const views = useMemo(() => {
    const views = viewStates.map((viewState) => {
      const ViewComponent = viewComponentByType[viewState.viewType];
      return <ViewComponent key={viewState.viewIri} {...viewState} />;
    });
    return views;
  }, [viewStates]);

  return (
    <ResponsiveGridLayout
      autoSize={false}
      className="EditorViews"
      layouts={layouts}
      breakpoints={GRID_BREAKPOINTS}
      cols={COLS_PER_LAYOUT}
    >
      {views}
    </ResponsiveGridLayout>
  );
};

export const Editor: FC = () => {
  const { searchParams } = useSearchParams();
  const [isOverviewActive, setIsOverviewActive] = useState<boolean>(false);
  const [selectedIris, setSelectedIris] = useState<Set<string>>(new Set());
  const [perspectivesByIri, setPerspectivesByIri] = useImmer<
    Record<string, Perspective>
  >({});
  const perspectivesByIriRef =
    useRef<Record<string, Perspective>>(perspectivesByIri);
  perspectivesByIriRef.current = perspectivesByIri;
  const [perspectiveManager] = useState<PerspectiveManager>(
    () =>
      new PerspectiveManager({
        getPerspectivesByIri: () => perspectivesByIriRef.current,
        setPerspectivesByIri,
      })
  );

  const { justMounted } = useIsMounted();

  // Determine which queries are active
  const {
    // _projectIri,
    perspectiveIris,
  } = useMemo(() => {
    // queries from the URL
    const searchQueryIris =
      searchParams.perspeciveIris?.split(',')?.filter(Boolean) || [];

    const perspectiveIris = new Set([...searchQueryIris]);
    if (selectedIris.size > 0) {
      perspectiveIris.add(VOCABULARY.constants.selectionQueryIri);
    }

    if (isOverviewActive || searchQueryIris.length === 0) {
      perspectiveIris.add(VOCABULARY.constants.overviewQueryIri);
    }

    return {
      projectIri: searchParams.projectIri || null,
      perspectiveIris,
    };
  }, [
    searchParams.perspeciveIris,
    searchParams.projectIri,
    selectedIris.size,
    isOverviewActive,
  ]);

  const togglePerspectiveIri = useCallback(
    (perspectiveIri: string, add: boolean) => {
      if (add && perspectiveIris.has(perspectiveIri)) {
        return;
      } else if (!add && !perspectiveIris.has(perspectiveIri)) {
        return;
      } else if (perspectiveIri === VOCABULARY.constants.selectionQueryIri) {
        if (add) {
          return;
        }
        setSelectedIris(new Set());
      } else if (perspectiveIri === VOCABULARY.constants.overviewQueryIri) {
        setIsOverviewActive(add);
      }
    },
    [perspectiveIris]
  );

  const didPerspectiveIrisChange = useDidValueChange({
    value: perspectiveIris,
  });
  useEffect(() => {
    if (justMounted || didPerspectiveIrisChange) {
      const { openedPerspectiveIris } =
        perspectiveManager.updateOpenPerspectives(perspectiveIris);
      openedPerspectiveIris.forEach((perspectiveIri) => {
        perspectiveManager.startMetadataQuery(perspectiveIri);
      });
    }
  }, [
    didPerspectiveIrisChange,
    justMounted,
    perspectiveIris,
    perspectiveManager,
  ]);

  const viewStates: ViewState[] = useMemo(
    () =>
      Object.entries(perspectivesByIri).flatMap(
        ([perspectiveIri, perspective]) =>
          Object.entries(perspective.visibleAspects).flatMap(
            ([aspect, aspectMetadata]) =>
              Object.entries(aspectMetadata.views).flatMap(
                ([viewIri, viewMetadata]) => ({
                  perspectiveIri,
                  viewIri,
                  viewType: viewMetadata.type,
                  perspectiveAspect: aspect as PerspectiveAspect,
                })
              )
          )
      ),
    [perspectivesByIri]
  );

  return (
    <PerspectiveContext.Provider value={perspectiveManager}>
      <EditorContext.Provider
        value={{
          togglePerspectiveIri,
          viewStates,
        }}
      >
        <EditorViews />
      </EditorContext.Provider>
    </PerspectiveContext.Provider>
  );
};
