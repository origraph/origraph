import { BindingsFactory } from '@comunica/bindings-factory';
import { BrowserLevel } from 'browser-level';
import { DataFactory, Quad, StreamParser } from 'n3';
import { Quadstore } from 'quadstore';
import { Engine } from 'quadstore-comunica';
import { readableFromWeb } from 'readable-from-web';
import { AsyncLock } from '../utils/core/asyncLock';
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

    // TODO: need to check which ontology versions are already in use; don't
    // add stuff we already have in IndexedDB. Current implementation is
    // duplicating things on page reload, so I'm disabling this function for now
    // (re-enable once if you Clear site data)
    const ontologyVersions = ['v0.1.0'];

    await Promise.all(
      ontologyVersions.map(async (ontologyVersion) => {
        const response = await fetch(`vocabulary/${ontologyVersion}.trig`);
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
      let quads: Quad[] = [];
      let done = false;
      let resolve: (quad: Quad | null) => void;
      let reject: (error?: Error) => void;
      let promise = new Promise<Quad | null>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      const bindingsStream = await self.engine.queryBindings(await getSparql());
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
        console.log('quad', quad);
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
          } as QueryIncrementalOutput;
          if (input.forceStop) {
            return { quads } as QueryFinalOutput;
          }
        } else {
          return { progress: 1.0, quads } as QueryFinalOutput;
        }
      }
      return { quads } as QueryFinalOutput;
    }
    return generatorFn;
  }
}
