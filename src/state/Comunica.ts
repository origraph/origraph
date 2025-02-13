import { Bindings, BindingsFactory } from '@comunica/bindings-factory';
import { BrowserLevel } from 'browser-level';
import { DataFactory, Quad } from 'n3';
import { Quadstore } from 'quadstore';
import { Engine } from 'quadstore-comunica';
import { AsyncLock } from '../utils/core/asyncLock';
import {
  QueryFinalOutput,
  QueryIncrementalOutput,
  QueryState,
} from './Perspectives';

export class ComunicaInterface {
  protected txnLock: AsyncLock = new AsyncLock();
  protected operationPercentDone: number = 100;
  store: Quadstore;
  engine: Engine;
  bindingsFactory: BindingsFactory;
  ready: boolean = false;

  constructor() {
    this.store = new Quadstore({
      backend: new BrowserLevel('origraph'),
      dataFactory: DataFactory,
    });
    this.engine = new Engine(this.store);
    this.bindingsFactory = new BindingsFactory();
  }

  async init() {
    await this.store.open();
    await this.syncOrigraphVocabulary();
    this.ready = true;
    console.log('Comunica ready');
  }

  async syncOrigraphVocabulary() {
    // Load Origraph ontologies ensuring that:
    // 1. the latest available version is in the database, as well as
    // 2. any version that stored projects use

    // TODO: Someday, it would be really cool if we could do something like
    // https://phiresky.github.io/blog/2021/hosting-sqlite-databases-on-github-pages/
    // to have a totally separate-but-queryable interface for flat ontology
    // files instead of ingesting them into quadstore

    console.log('syncOrigraphVocabulary');

    // TODO: need to check which ontology versions are already in use;
    // just hard-coding v0.1.0 for now:
    const ontologyVersions = ['v0.1.0'];

    /*
    await Promise.all(
      ontologyVersions.map(async (ontologyVersion) => {
        const response = await fetch(`/vocabulary/${ontologyVersion}.trig`);
        for await (const chunk of response.body) {
          // TODO: continue here, ugh, nothing like finally learning streams the hard way
        }
      })
    );

    await this.store.multiPut();
    */
  }

  getSelectQueryGeneratorFunction(maxCachedQuads?: number) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    async function* generatorFn({ getSparql }: QueryState) {
      const quads: Quad[] = [];
      const bindingsStream = await self.engine.queryBindings(await getSparql());
      // TODO: this type cast seems wrong... in theory it should work per the docs:
      //
      // but typescript doesn't like it. If it actually works, I should submit
      // my first comunica PR to fix the type; maybe-relevant issue:
      // https://github.com/comunica/comunica/issues/1037
      for await (const bindings of bindingsStream as unknown as AsyncIterable<Bindings>) {
        if (maxCachedQuads !== undefined) {
          const extraQuads = maxCachedQuads - (quads.length + 1);
          if (extraQuads > 0) {
            quads.splice(0, extraQuads);
          }
        }
        console.log('bindings:', bindings);
        // quads.push(bindings);
        yield { progress: 0.25, quads } as QueryIncrementalOutput;
      }
      return {
        quads,
      } as QueryFinalOutput;
    }
    return generatorFn;
  }
}
