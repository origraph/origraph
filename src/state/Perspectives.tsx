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

export type QueryState = {
  limit?: number;
  offset?: number;
  currentQuads: Quad[];
  getSparql: () => Promise<string>;
  setSparql?: (update: string) => Promise<void>;
  jobIri?: string;
};

export type QueryFinalOutput = { quads: Quad[] };

export type QueryIncrementalOutput = BaseIncrementalOutput & {
  quadCache: Quad[];
  lastQuadChunk: Quad[];
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
  metadataQuery: QueryState | null;
  resultsQuery: QueryState | null;
  visibleAspects: PerspectiveAspects;
};

export const getNewViewIri = (viewType: ViewType) => `${viewType}-${uuid()}`;

export const getDefaultAspectsForNewlyOpenedPerspective = (): Partial<
  Record<PerspectiveAspect, PerspectiveAspectMetadata>
> => ({
  [PerspectiveAspect.PerspectiveQuery]: {
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

  async startMetadataQuery(perspectiveIri: string) {
    await this.comunicaInterface.init();
    console.log('startMetadataQuery', perspectiveIri);
    const perspectivesByIri = this.getPerspectivesByIri();
    if (!perspectivesByIri[perspectiveIri].metadataQuery) {
      throw new Error(`Called startMetadataQuery before it exists`);
    }
    if (perspectivesByIri[perspectiveIri].metadataQuery.jobIri) {
      throw new Error(`startMetadataQuery called when jobId already exists`);
    }
    const metadataJob = this.jobManager.createJob<
      QueryState,
      BaseIncrementalInput,
      QueryIncrementalOutput,
      QueryFinalOutput
    >({
      onUpdate: (update) => {
        this.setPerspectivesByIri((draft) => {
          if (!draft[perspectiveIri].metadataQuery) {
            throw new Error(
              `metadataQuery was unexpectedly set to null while it was running`
            );
          }
          draft[perspectiveIri].metadataQuery.currentQuads = update.quadCache;
        });
        console.log('metadataQuery onUpdate', update);
      },
      onFinish: async (update) => {
        console.log('metadataQuery onFinish', update);
        const resultsQuery = await this.initResultsQuery(perspectiveIri);
        const job = this.jobManager.getJob(resultsQuery.jobIri as string);
        job?.restart(resultsQuery);
      },
      onError: (error) => {
        console.warn('metadataQuery onError', error);
      },
      initialInput: perspectivesByIri[perspectiveIri].metadataQuery,
      generatorFn: this.comunicaInterface.getSelectQueryGeneratorFunction(),
    });
    this.setPerspectivesByIri((draft) => {
      (draft[perspectiveIri].metadataQuery as QueryState).jobIri =
        metadataJob.iri;
    });
  }

  async initResultsQuery(perspectiveIri: string) {
    const perspectivesByIri = this.getPerspectivesByIri();
    if (!perspectivesByIri[perspectiveIri].metadataQuery) {
      throw new Error(`Called initResultsQuery with metadataQuery missing`);
    }
    if (perspectivesByIri[perspectiveIri].resultsQuery) {
      console.warn(
        `Called initResultsQuery when resultsQuery already exists; TODO: need to manually clean up / replace the results job`
      );
    }
    const metadataJobIri =
      perspectivesByIri[perspectiveIri].metadataQuery.jobIri;
    const metadataJob = metadataJobIri
      ? this.jobManager.getJob<
          QueryState,
          BaseIncrementalInput,
          QueryIncrementalOutput,
          QueryFinalOutput
        >(metadataJobIri)
      : null;
    // If the metadata job has already been cleaned up, we can safely default to
    // metadataQuery.currentQuads
    const metaQuads =
      (await metadataJob?.getResults())?.quads ||
      perspectivesByIri[perspectiveIri].metadataQuery.currentQuads;
    const sparql = queryQuadsToSparql(metaQuads);
    const resultsQuery: QueryState = {
      currentQuads: [],
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
          if (!draft[perspectiveIri].resultsQuery) {
            throw new Error(
              `resultsQuery was unexpectedly set to null while it was running`
            );
          }
          draft[perspectiveIri].resultsQuery.currentQuads = update.quadCache;
        });
        console.log('resultsQuery onUpdate', update);
      },
      onFinish: (update) => {
        console.log('resultsQuery onFinish', update);
      },
      onError: (error) => {
        console.warn('resultsQuery onError', error);
      },
      initialInput: resultsQuery,
      generatorFn: this.comunicaInterface.getSelectQueryGeneratorFunction(),
      waitToStart: true,
      cleanupDelay: -1, // Don't auto-cleanup results jobs, so it's easy to restart the perspective query
    });
    resultsQuery.jobIri = resultsJob.iri;
    this.setPerspectivesByIri((draft) => {
      draft[perspectiveIri].resultsQuery = resultsQuery;
    });
    return resultsQuery;
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
            closingPerspective.metadataQuery?.jobIri,
            closingPerspective.resultsQuery?.jobIri,
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
            metadataQuery: {
              getSparql: async () => getDirectQuadsQuery({ iri }),
              currentQuads: [],
            },
            resultsQuery: null,
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
