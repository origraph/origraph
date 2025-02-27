import { Quad } from 'n3';
import { createContext, useContext, useMemo } from 'react';
import { Updater } from 'use-immer';
import { v4 as uuid } from 'uuid';
import { TrigViewState } from '../components/QueryView/TrigView/TrigView';
import { noop } from '../constants/empty';
import { PerspectiveAspect, ViewType } from '../constants/vocabulary';
import { getDirectQuads } from '../queries/getDirectQuadsQuery/getDirectQuadsQuery';
import { partitionSets } from '../utils/core/partitionSets';
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

interface PerspectiveManagerProps {
  getPerspectivesByIri: () => Record<string, Perspective>;
  setPerspectivesByIri: Updater<Record<string, Perspective>>;
  setPerspectiveUpdateSideEffect: (callback: () => void) => void;
}

export class PerspectiveManager implements PerspectiveManagerProps {
  jobManager: JobManager;
  comunicaInterface: ComunicaInterface;
  getPerspectivesByIri: () => Record<string, Perspective>;
  setPerspectivesByIri: Updater<Record<string, Perspective>>;
  setPerspectiveUpdateSideEffect: (callback: () => void) => void;

  constructor(props: PerspectiveManagerProps) {
    this.jobManager = new JobManager();
    this.comunicaInterface = new ComunicaInterface();
    this.getPerspectivesByIri = props.getPerspectivesByIri;
    this.setPerspectivesByIri = props.setPerspectivesByIri;
    this.setPerspectiveUpdateSideEffect = props.setPerspectiveUpdateSideEffect;
  }

  async startMetadataQuery(perspectiveIri: string) {
    await this.comunicaInterface.init();
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
    const _metaQuads =
      (await metadataJob?.getResults())?.quads ||
      perspectivesByIri[perspectiveIri].metadataQuery.currentQuads;
    const sparql = `SELECT * WHERE { { ?s ?p ?o . BIND(<default:graph> AS ?g) } UNION { GRAPH ?g { ?s ?p ?o . } } }`; // queryQuadsToSparql(metaQuads);
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
    const { onlyA: perspectiveIrisToOpen, onlyB: perspectiveIrisToClose } =
      partitionSets(perspectiveIris, new Set(Object.keys(perspectivesByIri)));
    if (perspectiveIrisToOpen.size > 0) {
      // Some awkwardness here, as a result of sitting between non-mutable react
      // state, and mutable running Job state. Only start jobs AFTER React has
      // finished saving info about new perspectives
      this.setPerspectiveUpdateSideEffect(() => {
        perspectiveIrisToOpen.forEach((iri) => {
          this.startMetadataQuery(iri);
        });
      });
    }
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
          draft[iri] = {
            perspectiveIri: iri,
            metadataQuery: {
              getSparql: async () => getDirectQuads({ iri }),
              currentQuads: [],
            },
            resultsQuery: null,
            visibleAspects: getDefaultAspectsForNewlyOpenedPerspective(),
          };
        });
      });
    }
  }
}

export const PerspectiveContext = createContext(
  new PerspectiveManager({
    getPerspectivesByIri: () => ({}),
    setPerspectivesByIri: noop,
    setPerspectiveUpdateSideEffect: noop,
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
