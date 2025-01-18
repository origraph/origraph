import { Bindings, BindingsFactory } from '@comunica/bindings-factory';
import { BrowserLevel } from 'browser-level';
import { DataFactory } from 'n3';
import { Quadstore } from 'quadstore';
import { Engine } from 'quadstore-comunica';
import { createContext } from 'react';
import { AsyncLock } from '../utils/core/asyncLock';

export class ComunicaInterface {
  protected txnLock: AsyncLock = new AsyncLock();
  protected operationPercentDone: number = 100;
  store: Quadstore;
  engine: Engine;
  bindingsFactory: BindingsFactory;

  constructor() {
    this.store = new Quadstore({
      backend: new BrowserLevel('origraph'),
      dataFactory: DataFactory,
    });
    this.engine = new Engine(this.store);
    this.bindingsFactory = new BindingsFactory();

    this.store.open().then(async () => {
      await this.syncOrigraphVocabulary();
      console.log('Comunica ready');
    });
  }

  async syncOrigraphVocabulary() {
    // TODO: load Origraph ontologies ensuring that:
    // 1. the latest available version is in the database
    // 2. any version that stored projects use
    // const ontologyVersions = ['0.1'];
    // Someday, it would be really cool if we could do something like
    // https://phiresky.github.io/blog/2021/hosting-sqlite-databases-on-github-pages/
    // to have a totally separate-but-queryable interface for our small ontology files
    // instead of ingesting them into quadstore
  }

  async runSelectQuery<TResult>({
    query,
    transformResult = (value: Bindings) => value as TResult,
  }: {
    query: string;
    transformResult?: (result: Bindings) => TResult;
  }) {
    const bindings = await this.engine.queryBindings(query);
    const quads: TResult[] = [];
    bindings.on('data', (result) => {
      quads.push(transformResult(result));
    });
    return new Promise<TResult[]>((resolve, reject) => {
      bindings.on('end', () => {
        // TODO: maybe return something like { quads: [], quadsBySubjectIri: {}, ... }?
        resolve(quads);
      });
      bindings.on('error', reject);
    });
  }
}

export const getEmptyComunicaInterfaceContext = () => {
  return { comunicaInterface: new ComunicaInterface() };
};

export const ComunicaInterfaceContext = createContext(
  getEmptyComunicaInterfaceContext()
);
