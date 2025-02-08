import { Quad } from 'n3';
import { createContext } from 'react';
import { v4 as uuid } from 'uuid';
import { TrigViewState } from '../components/QueryView/TrigView/TrigView';
import {
  defaultGraph,
  literal,
  namedNode,
  quad,
} from '../constants/n3DataFactory';
import { PerspectiveAspect, ViewType } from '../constants/vocabulary';
import { getPerspectiveMetadataQuery } from '../queries/perspectiveMetadata/perspectiveMetadata';
import { partitionSets } from '../utils/core/partitionSets';
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

// TODO: About to attempt MobX, because ugh, fuck React's anti-mutability dogma
// (no way in hell am I going back to Redux 😑🔫)
export class PerspectiveManager {
  jobManager: JobManager;
  comunicaInterface: ComunicaInterface;
  perspectivesByIri: Record<string, Perspective> = {};

  constructor() {
    this.jobManager = new JobManager();
    this.comunicaInterface = new ComunicaInterface();
  }

  async startMetadataQuery(perspectiveIri: string) {
    if (!this.comunicaInterface.ready) {
      await this.comunicaInterface.init();
    }
    if (!this.perspectivesByIri[perspectiveIri].metadataQuery) {
      throw new Error(`Called startMetadataQuery before it exists`);
    }
    if (this.perspectivesByIri[perspectiveIri].metadataQuery.jobIri) {
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
        if (!this.perspectivesByIri[perspectiveIri].metadataQuery) {
          throw new Error(
            `metadataQuery was unexpectedly set to null while it was running`
          );
        }
        this.perspectivesByIri[perspectiveIri].metadataQuery.currentQuads =
          update.quads;
        console.log('onUpdate', update);
      },
      onFinish: (update) => {
        console.log('onFinish', update);
      },
      onError: (error) => {
        console.warn('onError', error);
      },
      initialInput: this.perspectivesByIri[perspectiveIri].metadataQuery,
      generatorFn,
    });
    this.perspectivesByIri[perspectiveIri].metadataQuery.jobIri =
      metadataJob.iri;
  }

  updateOpenPerspectives(perspectiveIris: Set<string>) {
    const { onlyA: perspectiveIrisToOpen, onlyB: perspectiveIrisToClose } =
      partitionSets(
        perspectiveIris,
        new Set(Object.keys(this.perspectivesByIri))
      );
    perspectiveIrisToClose.forEach((iri) => {
      const closingPerspective = this.perspectivesByIri[iri];
      [
        closingPerspective.metadataQuery?.jobIri,
        closingPerspective.resultsQuery?.jobIri,
      ]
        .map((jobIri) => (jobIri ? this.jobManager.getJob(jobIri) : null))
        .forEach((job) => {
          job?.forceStop();
        });
      delete this.perspectivesByIri[iri];
    });
    perspectiveIrisToOpen.forEach((iri) => {
      this.perspectivesByIri[iri] = {
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
  }
}

export const PerspectiveContext = createContext(new PerspectiveManager());
