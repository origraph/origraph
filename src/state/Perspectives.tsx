import { DataFactory, Quad } from 'n3';
import { createContext, useContext, useMemo } from 'react';
import { Updater } from 'use-immer';
import { v4 as uuid } from 'uuid';
import { TrigViewState } from '../components/QueryView/TrigView/TrigView';
import { noop } from '../constants/empty';
import { PerspectiveAspect, ViewType } from '../constants/vocabulary';
import { getDirectQuads } from '../queries/getDirectQuadsQuery/getDirectQuadsQuery';
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
const { namedNode, quad, literal, defaultGraph } = DataFactory;

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

export type QueryFinalOutput = {
  quads: Quad[]; // TODO: maybe want to use streams instead of finalized lists?
};

export type QueryIncrementalOutput = QueryFinalOutput & BaseIncrementalOutput;

type PerspectiveAspectMetadata = {
  views: Record<string, ViewMetadata>;
};

type PerspectiveAspects = Partial<
  Record<PerspectiveAspect, PerspectiveAspectMetadata>
>;

export type BaseViewState = {
  perspectiveIri: string;
  viewIri: string;
  viewType: ViewType;
  perspectiveAspect: PerspectiveAspect;
};

export type ViewState = TrigViewState; // & OtherViewState;

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
  [PerspectiveAspect.ResultPage]: {
    views: {
      [getNewViewIri(ViewType.TrigView)]: {
        type: ViewType.TrigView,
      },
    },
  },
});

export class PerspectiveManager {
  jobManager: JobManager;
  comunicaInterface: ComunicaInterface;
  getPerspectivesByIri: () => Record<string, Perspective>;
  setPerspectivesByIri: Updater<Record<string, Perspective>>;

  constructor(
    getPerspectivesByIri: () => Record<string, Perspective>,
    setPerspectivesByIri: Updater<Record<string, Perspective>>
  ) {
    this.jobManager = new JobManager();
    this.comunicaInterface = new ComunicaInterface();
    this.getPerspectivesByIri = getPerspectivesByIri;
    this.setPerspectivesByIri = setPerspectivesByIri;
  }

  async startMetadataQuery(perspectiveIri: string) {
    if (!this.comunicaInterface.ready) {
      await this.comunicaInterface.init();
    }
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
          draft[perspectiveIri].metadataQuery.currentQuads = update.quads;
        });
        console.log('metadataQuery onUpdate', update);
      },
      onFinish: (update) => {
        this.initResultsQuery(perspectiveIri);
        console.log('metadataQuery onFinish', update);
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

    async function* generatorFn(initialInput: QueryState) {
      console.log(
        'resultsQuery generatorFn',
        JSON.stringify(initialInput, null, 2)
      );
      const testQuad = quad(
        namedNode('test:results:subject:result'),
        namedNode('test:results:predicate:result'),
        literal('test results literal'),
        defaultGraph()
      );
      yield {
        progress: 0.25,
        quads: [testQuad],
      };
      return {
        quads: [testQuad],
      };
    }
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
          draft[perspectiveIri].resultsQuery.currentQuads = update.quads;
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
      generatorFn,
      cleanupDelay: -1, // Don't auto-cleanup results jobs, so it's easy to restart the perspective query
    });
    resultsQuery.jobIri = resultsJob.iri;
    this.setPerspectivesByIri((draft) => {
      draft[perspectiveIri].resultsQuery = resultsQuery;
    });
  }

  updateOpenPerspectives(perspectiveIris: Set<string>) {
    const perspectivesByIri = this.getPerspectivesByIri();
    const { onlyA: perspectiveIrisToOpen, onlyB: perspectiveIrisToClose } =
      partitionSets(perspectiveIris, new Set(Object.keys(perspectivesByIri)));
    if (perspectiveIrisToOpen.size > 0 || perspectiveIrisToClose.size > 0) {
      this.setPerspectivesByIri((draft) => {
        perspectiveIrisToClose.forEach((iri) => {
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
        perspectiveIrisToOpen.forEach((iri) => {
          console.log('opening perspective:', iri, getDirectQuads({ iri }));
          draft[iri] = {
            perspectiveIri: iri,
            metadataQuery: {
              getSparql: async () => getDirectQuads({ iri }),
              currentQuads: [],
            },
            resultsQuery: null,
            visibleAspects: getDefaultAspectsForNewlyOpenedPerspective(),
          };
          this.startMetadataQuery(iri);
        });
      });
    }
  }
}

export const PerspectiveContext = createContext(
  new PerspectiveManager(() => ({}), noop)
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
