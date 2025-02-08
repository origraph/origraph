import { Quad } from 'n3';
import { createContext, useContext, useMemo } from 'react';
import { Updater } from 'use-immer';
import { v4 as uuid } from 'uuid';
import { TrigViewState } from '../components/QueryView/TrigView/TrigView';
import { noop } from '../constants/empty';
import {
  defaultGraph,
  literal,
  namedNode,
  quad,
} from '../constants/n3DataFactory';
import { PerspectiveAspect, ViewType } from '../constants/vocabulary';
import { getPerspectiveMetadataQuery } from '../queries/perspectiveMetadata/perspectiveMetadata';
import { partitionSets } from '../utils/core/partitionSets';
import { useMutable } from '../utils/core/useMutable';
import { ComunicaInterface } from './Comunica';
import {
  BaseIncrementalInput,
  BaseIncrementalOutput,
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

type QueryFinalOutput = {
  quads: Quad[]; // TODO: maybe want to use streams instead of finalized lists?
};

type QueryIncrementalOutput = QueryFinalOutput & BaseIncrementalOutput;

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
    async function* generatorFn(initialInput: QueryState) {
      console.log('generatorFn', JSON.stringify(initialInput, null, 2));
      const testQuad = quad(
        namedNode('test:subject:result'),
        namedNode('test:predicate:result'),
        literal('test literal'),
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
        console.log('onUpdate', update);
      },
      onFinish: (update) => {
        this.initResultsQuery(perspectiveIri);
        console.log('onFinish', update);
      },
      onError: (error) => {
        console.warn('onError', error);
      },
      initialInput: perspectivesByIri[perspectiveIri].metadataQuery,
      generatorFn,
    });
    this.setPerspectivesByIri((draft) => {
      (draft[perspectiveIri].metadataQuery as QueryState).jobIri =
        metadataJob.iri;
    });
  }

  initResultsQuery(perspectiveIri: string) {
    const perspectivesByIri = this.getPerspectivesByIri();
    if (!perspectivesByIri[perspectiveIri].metadataQuery) {
      throw new Error(`Called initResultsQuery with metadataQuery missing`);
    }
    this.setPerspectivesByIri((draft) => {
      draft[perspectiveIri].resultsQuery = {
        currentQuads: [],
        // TODO: construct SPARQL from meta-sparql, fetched via metadataQuery!
        getSparql: async () => `SELECT * WHERE { ?s ?p ?o }`,
      };
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
          draft[iri] = {
            perspectiveIri: iri,
            metadataQuery: {
              getSparql: async () =>
                getPerspectiveMetadataQuery({ perspectiveIri: iri }),
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

export const useJob = (jobIri?: string) => {
  const perspectiveManager = useContext(PerspectiveContext);
  const getJob = useMutable(
    jobIri ? perspectiveManager.jobManager.getJob(jobIri) : null
  );
  return useMemo(getJob, [getJob]);
};
