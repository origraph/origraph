import { noop } from '../../constants/empty';

export class AsyncLock {
  disable: () => void;
  promise: Promise<void>;
  details: null | string;

  constructor() {
    this.disable = noop;
    this.promise = Promise.resolve();
    this.details = null;
  }

  enable(details: string) {
    this.details = details;
    this.promise = new Promise(
      (resolve) =>
        (this.disable = () => {
          this.details = null;
          resolve();
        })
    );
  }
}
