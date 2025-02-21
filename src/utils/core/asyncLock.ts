export class AsyncLock<T> {
  disable: (finishedValue: T) => void;
  promise: Promise<T>;
  value: T;
  private waitingResolves: Array<(value: T) => void> = [];

  constructor(initialValue: T) {
    this.disable = (_finishedValue: T) => {};
    this.promise = Promise.resolve(initialValue);
    this.value = initialValue;
  }

  enable(currentValue: T) {
    this.value = currentValue;
    this.promise = new Promise<T>((resolve) => {
      this.waitingResolves.push(resolve);
      this.disable = (finishedValue: T) => {
        this.value = finishedValue;
        this.waitingResolves.forEach((waitingResolve) =>
          waitingResolve(finishedValue)
        );
        this.waitingResolves = [];
        this.promise = Promise.resolve(finishedValue);
      };
    });
  }
}
