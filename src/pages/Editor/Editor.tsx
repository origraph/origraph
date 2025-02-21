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
import { useImmer } from 'use-immer';
import { TrigView } from '../../components/QueryView/TrigView/TrigView';
import { ViewComponent } from '../../components/QueryView/types';
import { noop } from '../../constants/empty';
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

const EditorViews = () => {
  const { viewStates } = useContext(EditorContext);

  const views = useMemo(() => {
    return viewStates.map((viewState) => {
      const ViewComponent = viewComponentByType[viewState.viewType];
      return <ViewComponent key={viewState.viewIri} {...viewState} />;
    });
  }, [viewStates]);

  // TODO: use GoldenLayout here...
  return <div className="EditorViews">{views}</div>;
};

export const Editor: FC = () => {
  const { searchParams } = useSearchParams();
  const [isOverviewActive, setIsOverviewActive] = useState<boolean>(false);
  const [selectedIris, setSelectedIris] = useState<Set<string>>(new Set());
  const [perspectivesByIri, setPerspectivesByIri] = useImmer<
    Record<string, Perspective>
  >({});
  const [perspectiveUpdateSideEffect, setPerspectiveUpdateSideEffect] =
    useState<() => void>(() => noop);
  const perspectivesByIriRef =
    useRef<Record<string, Perspective>>(perspectivesByIri);
  perspectivesByIriRef.current = perspectivesByIri;
  const [perspectiveManager] = useState<PerspectiveManager>(
    () =>
      new PerspectiveManager({
        getPerspectivesByIri: () => perspectivesByIriRef.current,
        setPerspectivesByIri,
        setPerspectiveUpdateSideEffect: setPerspectiveUpdateSideEffect,
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
      perspectiveManager.updateOpenPerspectives(perspectiveIris);
      perspectiveUpdateSideEffect();
    }
  }, [
    didPerspectiveIrisChange,
    justMounted,
    perspectiveIris,
    perspectiveManager,
    perspectiveUpdateSideEffect,
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
