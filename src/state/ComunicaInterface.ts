import { BindingsFactory } from '@comunica/bindings-factory';
import { BrowserLevel } from 'browser-level';
import { DataFactory } from 'n3';
import { Quadstore } from 'quadstore';
import { Engine } from 'quadstore-comunica';
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

    this.store.open().then(() => {
      console.log('Comunica ready');
    });
  }

  // handleNavigation({ projectId }: { projectId: string }) {}
}
