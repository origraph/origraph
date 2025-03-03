import { BindingsFactory } from '@comunica/bindings-factory';
import { BrowserLevel } from 'browser-level';
import { DataFactory, Quad, StreamParser } from 'n3';
import { Quadstore } from 'quadstore';
import { Engine } from 'quadstore-comunica';
import { readableFromWeb } from 'readable-from-web';
import { EXTERNAL_VOCABULARY } from '../constants/iris';
import { VOCABULARY } from '../constants/vocabulary';
import { getVocabulariesQuery } from '../queries/getVocabularies/getVocabularies';
import { AsyncLock } from '../utils/core/asyncLock';
import { getVersionNumberFromOrigraphVocabIri } from '../utils/core/getVersionNumberFromOrigraphVocabIri';
import { partitionSets } from '../utils/core/partitionSets';
import { BaseIncrementalInput } from './Jobs';
import {
  QueryFinalOutput,
  QueryIncrementalOutput,
  QueryState,
} from './Perspectives';

enum LockStates {
  UNINITIALIZED = 'UNINITIALIZED',
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
  READING = 'READING',
  WRITING = 'WRITING',
}
type LockState = (typeof LockStates)[keyof typeof LockStates];

export class ComunicaInterface {
  protected operationPercentDone: number = 100;
  store: Quadstore;
  engine: Engine;
  bindingsFactory: BindingsFactory;
  lock: AsyncLock<LockState> = new AsyncLock(
    LockStates.UNINITIALIZED as LockState
  );
  projectsByVocabulary: Record<string, Set<string>> = {};
  installedVocabularies: Set<string> = new Set();

  constructor() {
    this.store = new Quadstore({
      backend: new BrowserLevel('origraph'),
      dataFactory: DataFactory,
    });
    this.engine = new Engine(this.store);
    this.bindingsFactory = new BindingsFactory();
  }

  async init() {
    if (this.lock.value !== LockStates.UNINITIALIZED) {
      return this.lock.promise;
    }
    this.lock.enable(LockStates.INITIALIZING);
    await this.store.open();
    await this.syncOrigraphVocabulary();
    console.log('Comunica ready');
    this.lock.disable(LockStates.READY);
    return LockStates.READY;
  }

  async syncOrigraphVocabulary() {
    // Load Origraph ontologies ensuring that:
    // 1. the latest available version is in the database, as well as
    // 2. any version that stored projects use

    // TODO: Someday, it would be really cool if we could do something like
    // https://phiresky.github.io/blog/2021/hosting-sqlite-databases-on-github-pages/
    // to have a totally separate-but-read-only-queryable interface for flat
    // ontology files instead of ingesting them into quadstore. But these files
    // are still tiny, so there shouldn't be noticeable overhead for now...

    this.projectsByVocabulary = {};
    this.installedVocabularies = new Set();

    for await (const { quad } of this.selectQuery({
      sparql: getVocabulariesQuery(),
    })) {
      if (
        quad.predicate.value ===
        EXTERNAL_VOCABULARY.irisByPrefix.void.vocabulary
      ) {
        const project = quad.subject.value;
        const vocabulary = quad.object.value;
        this.projectsByVocabulary[vocabulary] = new Set([
          project,
          ...(this.projectsByVocabulary[vocabulary] || []),
        ]);
      } else if (
        quad.subject.value ===
          VOCABULARY.irisByPrefix.origraphGlobal.vocabularies &&
        quad.predicate.value ===
          VOCABULARY.irisByPrefix.origraphGlobal.installed_version
      ) {
        this.installedVocabularies.add(quad.object.value);
      }
    }

    const requiredVocabularies = new Set([
      VOCABULARY.versionIri,
      ...Object.keys(this.projectsByVocabulary),
    ]);

    const {
      // onlyA: vocabulariesToRemove, TODO
      onlyB: vocabulariesToInstall,
    } = partitionSets(this.installedVocabularies, requiredVocabularies);

    await Promise.all(
      Array.from(vocabulariesToInstall).map(async (vocabularyIri: string) => {
        const versionNumber =
          getVersionNumberFromOrigraphVocabIri(vocabularyIri);
        const response = await fetch(`vocabulary/v${versionNumber}.trig`);
        if (response.ok && response.body) {
          const parser = new StreamParser({ format: 'application/trig' });
          return await this.store.putStream(
            readableFromWeb(response.body).pipe(parser),
            { batchSize: 100 }
          );
        }
      })
    );
  }

  async *selectQuery<T extends BaseIncrementalInput | undefined>({
    sparql,
    maxCachedQuads,
  }: {
    sparql: string;
    maxCachedQuads?: number;
  }): AsyncGenerator<QueryIncrementalOutput, QueryFinalOutput, T> {
    let quads: Quad[] = [];
    let done = false;
    let resolve: (quad: Quad | null) => void;
    let reject: (error?: Error) => void;
    let promise = new Promise<Quad | null>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const bindingsStream = await this.engine.queryBindings(sparql);
    bindingsStream.on('data', (binding) => {
      const quad = new Quad(
        binding.get('s'),
        binding.get('p'),
        binding.get('o'),
        binding.get('g')
      );
      resolve(quad);
    });
    bindingsStream.on('error', (err) => {
      reject(err);
    });
    bindingsStream.on('end', () => {
      done = true;
      resolve(null);
    });

    while (!done) {
      const quad = await promise;
      promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      if (quad) {
        quads = [
          ...(maxCachedQuads !== undefined && quads.length >= maxCachedQuads
            ? quads.slice(maxCachedQuads - quads.length + 1)
            : quads),
          quad,
        ];
        const input = yield {
          progress: 0.5,
          quads,
          quad,
        } as QueryIncrementalOutput;
        if (input?.forceStop) {
          return { quads } as QueryFinalOutput;
        }
      } else {
        return { progress: 1.0, quads } as QueryFinalOutput;
      }
    }
    return { quads } as QueryFinalOutput;
  }

  getSelectQueryGeneratorFunction(maxCachedQuads?: number) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    async function* generatorFn({
      getSparql,
    }: QueryState): AsyncGenerator<
      QueryIncrementalOutput,
      QueryFinalOutput,
      BaseIncrementalInput
    > {
      const iterator = self.selectQuery({
        sparql: await getSparql(),
        maxCachedQuads,
      });

      let lastInput: BaseIncrementalInput = { forceStop: false };
      while (true) {
        const output = await iterator.next(lastInput);
        if (!lastInput.forceStop && !output.done) {
          lastInput = yield output.value;
        } else {
          return output.value;
        }
      }
    }
    return generatorFn;
  }
}
