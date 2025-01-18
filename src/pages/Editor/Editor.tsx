import { useEffect, useMemo, useState } from 'react';
import TrigView from '../../components/QueryView/TrigView/TrigView';
import { QueryView } from '../../components/QueryView/types';
import { QueryAspect, ViewType, VOCABULARY } from '../../constants/vocabulary';
import {
  ComunicaInterfaceContext,
  getEmptyComunicaInterfaceContext,
} from '../../state/ComunicaInterface';
import { useSearchParams } from '../../utils/core/useSearchParams';

const viewComponentByType: Record<ViewType, QueryView> = {
  [ViewType.TrigView]: TrigView,
};

export type ViewState = {
  queryIri: string;
  queryAspect: QueryAspect; // TODO: might need to make this a whole immerable class, using QueryAspect as the lookup in order to instantiate?
  viewType: ViewType;
};

const getNewQueryViewStates = (queryIri: string) => [
  {
    queryIri,
    queryAspect: QueryAspect.ResultPage,
    viewType: ViewType.TrigView,
  },
];

export const Editor = () => {
  const { searchParams } = useSearchParams();
  const [isOverviewActive, setIsOverviewActive] = useState<boolean>(false);
  const [selectedIris, _setSelectedIris] = useState<Set<string>>(new Set());
  const [viewStatesByQueryIri, setViewStatesByQueryIri] = useState<
    Record<string, ViewState[]>
  >({});

  const comunicaInterface = useMemo(
    () => getEmptyComunicaInterfaceContext(), // TODO: do this correctly once I figure out where it goes (currently getting created twice)
    []
  );

  // Determine which queries are active
  const {
    // _projectIri,
    queryIris,
    activeViewsByQueryIri,
    openedQueryIris,
    closedQueryIris,
  } = useMemo(() => {
    // queries from the URL
    const searchQueryIris =
      searchParams.queryIri?.split(',')?.filter(Boolean) || [];

    const queryIris = [...searchQueryIris];
    if (selectedIris.size > 0) {
      queryIris.unshift(VOCABULARY.constants.selectionQueryIri);
    }

    if (isOverviewActive || searchQueryIris.length === 0) {
      queryIris.unshift(VOCABULARY.constants.overviewQueryIri);
    }

    const openedQueryIris: string[] = [];
    const closedQueryIris: string[] = [];
    const activeViewsByQueryIri: Record<string, ViewState[]> =
      Object.fromEntries(
        queryIris.map((queryIri) => [
          queryIri,
          viewStatesByQueryIri[queryIri] || getNewQueryViewStates(queryIri),
        ])
      );
    Object.keys(viewStatesByQueryIri).forEach((queryIri) => {
      if (!activeViewsByQueryIri[queryIri]) {
        closedQueryIris.push(queryIri);
      }
    });

    return {
      projectIri: searchParams.projectIri || null,
      queryIris,
      activeViewsByQueryIri,
      openedQueryIris,
      closedQueryIris,
    };
  }, [
    isOverviewActive,
    searchParams.projectIri,
    searchParams.queryIri,
    selectedIris.size,
    viewStatesByQueryIri,
  ]);

  // Update our state to reflect the above automatic query (in/)activation logic
  useEffect(() => {
    if (openedQueryIris.length > 0 || closedQueryIris.length > 0) {
      setViewStatesByQueryIri(activeViewsByQueryIri);
      if (
        !isOverviewActive &&
        openedQueryIris.includes(VOCABULARY.constants.overviewQueryIri)
      ) {
        setIsOverviewActive(true);
      } else if (
        isOverviewActive &&
        closedQueryIris.includes(VOCABULARY.constants.overviewQueryIri)
      ) {
        setIsOverviewActive(false);
      }
    }
  }, [
    activeViewsByQueryIri,
    closedQueryIris,
    closedQueryIris.length,
    isOverviewActive,
    openedQueryIris,
    openedQueryIris.length,
  ]);

  // Render all the necessary views
  const allViews = useMemo(() => {
    return queryIris.flatMap((queryIri) =>
      activeViewsByQueryIri[queryIri].map((viewState, viewIndex) => {
        const ViewComponent = viewComponentByType[viewState.viewType];
        // TODO: maybe need to wrap in some kind of query context object?
        return (
          <ViewComponent
            key={`${viewState.queryIri}-${viewIndex}`}
            {...viewState}
          />
        );
      })
    );
  }, [activeViewsByQueryIri, queryIris]);

  // TODO: use GoldenLayout instead of this arbitrary flexbox thing
  return (
    <ComunicaInterfaceContext value={comunicaInterface}>
      {allViews}
    </ComunicaInterfaceContext>
  );
};
