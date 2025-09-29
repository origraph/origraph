import { Quad } from 'n3';
import { createContext, useContext, useMemo } from 'react';
import { Updater } from 'use-immer';
import { v4 as uuid } from 'uuid';
import { SPACE_SECTION } from '../components/utils/SpaceDivider/SpaceDivider';
import { TreeTableViewState } from '../components/views/TreeTableView/TreeTableView';
import { TrigViewState } from '../components/views/TrigView/TrigView';
import { noop } from '../constants/empty';
import { PerspectiveAspect, ViewType } from '../constants/vocabulary';
import { getDirectQuadsQuery } from '../queries/getDirectQuadsQuery/getDirectQuadsQuery';
import { partitionSets } from '../utils/core/partitionSets';
import { queryQuadsToSparql } from '../utils/core/queryQuadsToSparql';
import { useMutable } from '../utils/core/useMutable';
import { ComunicaInterface } from './Comunica';
import {
  BaseIncrementalInput,
  BaseIncrementalOutput,
  Job,
  JobManager,
} from './Jobs';

export type ViewMetadata = {
  type: ViewType;
};

export enum QueryPhase {
  INITIALIZING = 'Initializing...',
  QUERYING = 'Querying...',
  COMPLETED = 'Query Complete',
}

export type QueryState = {
  phase: QueryPhase;
  limit?: number;
  offset?: number;
  currentQuads: Quad[];
  quadsDropped: number;
  getSparql: () => Promise<string>;
  setSparql?: (update: string) => Promise<void>;
  jobIri?: string;
};

export type QueryFinalOutput = { quads: Quad[] };

export type QueryIncrementalOutput = BaseIncrementalOutput & {
  quadCache: Quad[];
  lastQuadChunk: Quad[];
  quadsDropped: number;
};

type PerspectiveAspectMetadata = {
  views: Record<string, ViewMetadata>;
};

type PerspectiveAspects = Partial<
  Record<PerspectiveAspect, PerspectiveAspectMetadata>
>;

export type ViewDescription = {
  title: string;
  subtitle: string;
};

export type BaseViewState = {
  perspectiveIri: string;
  viewIri: string;
  viewType: ViewType;
  perspectiveAspect: PerspectiveAspect;
  section?: SPACE_SECTION;
  style?: CSSStyleDeclaration /* Needed to forward styles from SpaceDivider; see also: https://github.com/facebook/react/issues/32531#issuecomment-2712091021 */;
  description: ViewDescription;
  setDescription: (newTitle: Partial<ViewDescription>) => void;
};

export type ViewState = TrigViewState | TreeTableViewState;

export type Perspective = {
  perspectiveIri: string;
  queryDefinition: QueryState | null;
  resultsPage: QueryState | null;
  visibleAspects: PerspectiveAspects;
};

export const getNewViewIri = (viewType: ViewType) => `${viewType}-${uuid()}`;

export const getDefaultAspectsForNewlyOpenedPerspective = (): Partial<
  Record<PerspectiveAspect, PerspectiveAspectMetadata>
> => ({
  [PerspectiveAspect.QueryDefinition]: {
    views: {
      [getNewViewIri(ViewType.TrigView)]: {
        type: ViewType.TrigView,
      },
    },
  },
  [PerspectiveAspect.ResultPage]: {
    views: {
      [getNewViewIri(ViewType.TrigView)]: {
        type: ViewType.TrigView,
      },
      [getNewViewIri(ViewType.TreeTableView)]: {
        type: ViewType.TreeTableView,
      },
    },
  },
});

interface PerspectiveManagerProps {
  getPerspectivesByIri: () => Record<string, Perspective>;
  setPerspectivesByIri: Updater<Record<string, Perspective>>;
}

export class PerspectiveManager implements PerspectiveManagerProps {
  jobManager: JobManager;
  comunicaInterface: ComunicaInterface;
  getPerspectivesByIri: () => Record<string, Perspective>;
  setPerspectivesByIri: Updater<Record<string, Perspective>>;

  constructor(props: PerspectiveManagerProps) {
    this.jobManager = new JobManager();
    this.comunicaInterface = new ComunicaInterface();
    this.getPerspectivesByIri = props.getPerspectivesByIri;
    this.setPerspectivesByIri = props.setPerspectivesByIri;
  }

  async startQueryDefinition(perspectiveIri: string) {
    await this.comunicaInterface.init();
    const perspectivesByIri = this.getPerspectivesByIri();
    if (!perspectivesByIri[perspectiveIri].queryDefinition) {
      throw new Error(`Called startQueryDefinition before it exists`);
    }
    if (perspectivesByIri[perspectiveIri].queryDefinition.jobIri) {
      throw new Error(`startQueryDefinition called when jobId already exists`);
    }
    const queryDefinitionJob = this.jobManager.createJob<
      QueryState,
      BaseIncrementalInput,
      QueryIncrementalOutput,
      QueryFinalOutput
    >({
      onUpdate: (update) => {
        this.setPerspectivesByIri((draft) => {
          if (!draft[perspectiveIri].queryDefinition) {
            throw new Error(
              `queryDefinition was unexpectedly set to null while it was running`
            );
          }
          draft[perspectiveIri].queryDefinition.currentQuads = update.quadCache;
          draft[perspectiveIri].queryDefinition.quadsDropped +=
            update.quadsDropped;
        });
      },
      onFinish: async (update) => {
        this.setPerspectivesByIri((draft) => {
          if (!draft[perspectiveIri].queryDefinition) {
            throw new Error(
              `queryDefinition was unexpectedly set to null while it was finishing`
            );
          }
          draft[perspectiveIri].queryDefinition.currentQuads = update.quads;
          draft[perspectiveIri].queryDefinition.phase = QueryPhase.COMPLETED;
        });
        const resultsPage = await this.initResultsPage(perspectiveIri);
        const resultsJob = this.jobManager.getJob(resultsPage.jobIri as string);
        resultsJob?.restart(resultsPage);
      },
      onError: (error) => {
        console.warn('Error while querying for queryDefinition:', error);
      },
      initialInput: perspectivesByIri[perspectiveIri].queryDefinition,
      generatorFn: this.comunicaInterface.getSelectQueryGeneratorFunction(),
    });
    this.setPerspectivesByIri((draft) => {
      (draft[perspectiveIri].queryDefinition as QueryState).jobIri =
        queryDefinitionJob.iri;
    });
  }

  async initResultsPage(perspectiveIri: string) {
    const perspectivesByIri = this.getPerspectivesByIri();
    if (!perspectivesByIri[perspectiveIri].queryDefinition) {
      throw new Error(`Called initResultsQuery with queryDefinition missing`);
    }
    if (perspectivesByIri[perspectiveIri].resultsPage) {
      console.warn(
        `Called initResultsQuery when resultsPage already exists; TODO: need to manually clean up / replace the results job`
      );
    }
    const metadataJobIri =
      perspectivesByIri[perspectiveIri].queryDefinition.jobIri;
    const metadataJob = metadataJobIri
      ? this.jobManager.getJob<
          QueryState,
          BaseIncrementalInput,
          QueryIncrementalOutput,
          QueryFinalOutput
        >(metadataJobIri)
      : null;
    // If the query definition job has already been cleaned up, we can safely
    // default to queryDefinition.currentQuads
    const metaQuads =
      (await metadataJob?.getResults())?.quads ||
      perspectivesByIri[perspectiveIri].queryDefinition.currentQuads;
    const sparql = queryQuadsToSparql(metaQuads);
    const resultsPage: QueryState = {
      phase: QueryPhase.INITIALIZING,
      currentQuads: [],
      quadsDropped: 0,
      getSparql: async () => sparql,
    };

    const resultsJob = this.jobManager.createJob<
      QueryState,
      BaseIncrementalInput,
      QueryIncrementalOutput,
      QueryFinalOutput
    >({
      onUpdate: (update) => {
        this.setPerspectivesByIri((draft) => {
          if (!draft[perspectiveIri].resultsPage) {
            throw new Error(
              `resultsPage was unexpectedly set to null while it was running`
            );
          }
          draft[perspectiveIri].resultsPage.currentQuads = update.quadCache;
          draft[perspectiveIri].resultsPage.quadsDropped += update.quadsDropped;
        });
      },
      onFinish: (update) => {
        this.setPerspectivesByIri((draft) => {
          if (!draft[perspectiveIri].resultsPage) {
            throw new Error(
              `resultsPage was unexpectedly set to null while it finishing`
            );
          }
          draft[perspectiveIri].resultsPage.currentQuads = update.quads;
          draft[perspectiveIri].resultsPage.phase = QueryPhase.COMPLETED;
        });
      },
      onError: (error) => {
        console.warn('Error while querying for resultsPage:', error);
      },
      initialInput: resultsPage,
      generatorFn: this.comunicaInterface.getSelectQueryGeneratorFunction(),
      waitToStart: true,
      cleanupDelay: -1, // Don't auto-cleanup results jobs, so it's easy to restart the perspective query
    });
    resultsPage.jobIri = resultsJob.iri;
    resultsPage.phase = QueryPhase.QUERYING;
    this.setPerspectivesByIri((draft) => {
      draft[perspectiveIri].resultsPage = resultsPage;
    });
    return resultsPage;
  }

  updateOpenPerspectives(perspectiveIris: Set<string>) {
    const perspectivesByIri = this.getPerspectivesByIri();
    const { onlyA: openedPerspectiveIris, onlyB: closedPerspectiveIris } =
      partitionSets(perspectiveIris, new Set(Object.keys(perspectivesByIri)));
    if (openedPerspectiveIris.size > 0 || closedPerspectiveIris.size > 0) {
      this.setPerspectivesByIri((draft) => {
        closedPerspectiveIris.forEach((iri) => {
          const closingPerspective = draft[iri];
          [
            closingPerspective.queryDefinition?.jobIri,
            closingPerspective.resultsPage?.jobIri,
          ]
            .map((jobIri) => (jobIri ? this.jobManager.getJob(jobIri) : null))
            .forEach((job) => {
              job?.forceStop();
            });
          delete draft[iri];
        });
        openedPerspectiveIris.forEach((iri) => {
          draft[iri] = {
            perspectiveIri: iri,
            queryDefinition: {
              phase: QueryPhase.INITIALIZING,
              getSparql: async () => getDirectQuadsQuery({ iri }),
              currentQuads: [],
              quadsDropped: 0,
            },
            resultsPage: null,
            visibleAspects: getDefaultAspectsForNewlyOpenedPerspective(),
          };
        });
      });
    }
    return { openedPerspectiveIris, closedPerspectiveIris };
  }
}

export const PerspectiveContext = createContext(
  new PerspectiveManager({
    getPerspectivesByIri: () => ({}),
    setPerspectivesByIri: noop,
  })
);

export const usePerspective = (perspectiveIri: string) =>
  useContext(PerspectiveContext).getPerspectivesByIri()[perspectiveIri] || null;

export const useJob = <
  QueryState,
  IncrementalInput extends BaseIncrementalInput,
  IncrementalOutput extends QueryIncrementalOutput,
  QueryFinalOutput,
>(
  jobIri?: string
): Job<
  QueryState,
  IncrementalInput,
  IncrementalOutput,
  QueryFinalOutput
> | null => {
  const perspectiveManager = useContext(PerspectiveContext);
  const getJob = useMutable<Job<
    QueryState,
    IncrementalInput,
    IncrementalOutput,
    QueryFinalOutput
  > | null>(jobIri ? perspectiveManager.jobManager.getJob(jobIri) : null);
  return useMemo(getJob, [getJob]);
};
