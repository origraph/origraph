import { v4 as uuid } from 'uuid';
import { noop } from '../constants/empty';
import { VOCABULARY } from '../constants/vocabulary';

// Unless otherwise specified, jobs automatically clean themselves up after a minute; negative numbers won't cleanup
const DEFAULT_CLEANUP_DELAY = 60000;

export type BaseIncrementalInput = {
  forceStop?: boolean;
};
export type BaseIncrementalOutput = {
  progress?: number; // A number, 0-1, indicating how far along the job is
};

export type JobProps<
  InitialInput,
  IncrementalInput extends BaseIncrementalInput,
  IncrementalOutput extends BaseIncrementalOutput,
  FinalOutput,
> = {
  onUpdate?: (update: IncrementalOutput) => void;
  onError?: (error: Error) => void;
  onFinish?: (update: FinalOutput) => void;
  waitToStart?: boolean;
  cleanupDelay?: number;
  initialInput: InitialInput;
  generatorFn: (
    initialInput: InitialInput
  ) => AsyncGenerator<IncrementalOutput, FinalOutput, IncrementalInput>;
};

export const getNewJobIri = () =>
  `${VOCABULARY.constants.baseJobIri}-${uuid()}`;

export class Job<
  InitialInput,
  IncrementalInput extends BaseIncrementalInput,
  IncrementalOutput extends BaseIncrementalOutput,
  FinalOutput,
> {
  readonly iri: string;
  private _progress: number = 0;
  private cleanupDelay: number;
  private initialInput!: InitialInput;
  private runningPromise: Promise<FinalOutput> | null = null;
  private lastOutput: FinalOutput | IncrementalOutput | Error | null = null;
  private nextInput!: IncrementalInput;
  private onError: (error: Error) => void;
  private onFinish: (update: FinalOutput) => void;
  private onUpdate: (update: IncrementalOutput) => void;
  private onCleanup: () => void;
  private resolveStop: ((value: void) => void) | null = null;
  private generatorFn: (
    initialInput: InitialInput
  ) => AsyncGenerator<IncrementalOutput, FinalOutput, IncrementalInput>;

  constructor({
    onUpdate,
    onError,
    onFinish,
    onCleanup,
    waitToStart,
    cleanupDelay,
    initialInput,
    generatorFn,
  }: JobProps<
    InitialInput,
    IncrementalInput,
    IncrementalOutput,
    FinalOutput
  > & {
    onCleanup: () => void;
  }) {
    this.iri = getNewJobIri();
    this.cleanupDelay =
      cleanupDelay === undefined ? DEFAULT_CLEANUP_DELAY : cleanupDelay;
    this.reset(initialInput);
    this.onUpdate = onUpdate || noop;
    this.onError = onError || noop;
    this.onFinish = onFinish || noop;
    this.onCleanup = onCleanup;
    this.generatorFn = generatorFn;
    if (!waitToStart) {
      this.run();
    }
  }

  private reset(initialInput: InitialInput) {
    this.initialInput = initialInput;
    this.nextInput = {
      forceStop: false,
    } as IncrementalInput;
    this.lastOutput = null;
    this._progress = 0;
  }

  update(override: IncrementalInput) {
    Object.assign(this.nextInput, override);
  }

  get isRunning() {
    return this.runningPromise !== null;
  }

  get progress() {
    return this._progress;
  }

  async forceStop() {
    if (!this.isRunning) {
      return Promise.resolve();
    }
    this.nextInput.forceStop = true;
    return new Promise((resolve: (value: void) => void) => {
      this.resolveStop = resolve;
    });
  }

  async restart(initialInput: InitialInput) {
    if (this.isRunning) {
      await this.forceStop();
      this.reset(initialInput);
    }
    return await this.run();
  }

  async getResults(autoStartWith?: InitialInput) {
    if (this.isRunning) {
      return this.runningPromise;
    }
    if (autoStartWith) {
      return this.restart(autoStartWith);
    }
    return null;
  }

  private async run() {
    if (this.runningPromise) {
      return this.runningPromise;
    }
    this.runningPromise = new Promise((resolve, reject) => {
      (async () => {
        const iterator = this.generatorFn(this.initialInput);
        while (!this.nextInput.forceStop) {
          let done: boolean;
          let tickResult: FinalOutput | IncrementalOutput | Error;
          try {
            const iterResult = await iterator.next(this.nextInput);
            done = Boolean(iterResult.done);
            tickResult = iterResult.value;
          } catch (err) {
            done = true;
            this._progress = 0;
            this.nextInput.forceStop = true;
            this.lastOutput = err as Error;
            this.onError(this.lastOutput);
            break;
          }
          this.lastOutput = tickResult;
          if (done) {
            this.nextInput.forceStop = true;
            this._progress = 1.0;
            this.onFinish(tickResult as FinalOutput);
          } else {
            this._progress = (
              (tickResult as IncrementalOutput).progress === undefined
                ? 0.5
                : (tickResult as IncrementalOutput).progress
            ) as number;
            this.onUpdate(tickResult as IncrementalOutput);
          }
        }
        this.runningPromise = null;
        if (this.resolveStop) {
          this.resolveStop();
          this.resolveStop = null;
        }
        if (this.cleanupDelay >= 0) {
          globalThis.setTimeout(() => {
            this.onCleanup();
          }, this.cleanupDelay);
        }
        if (this.lastOutput instanceof Error) {
          reject(this.lastOutput);
        } else {
          resolve(this.lastOutput as FinalOutput);
        }
      })();
    });
    return this.runningPromise;
  }
}

export class JobManager {
  private jobsByIri: Record<string, unknown> = {};

  getJob<
    InitialInput,
    IncrementalInput extends BaseIncrementalInput,
    IncrementalOutput extends BaseIncrementalOutput,
    FinalOutput,
  >(
    iri: string
  ): Job<
    InitialInput,
    IncrementalInput,
    IncrementalOutput,
    FinalOutput
  > | null {
    return (
      (this.jobsByIri[iri] as Job<
        InitialInput,
        IncrementalInput,
        IncrementalOutput,
        FinalOutput
      >) || null
    );
  }

  createJob<
    InitialInput,
    IncrementalInput extends BaseIncrementalInput,
    IncrementalOutput extends BaseIncrementalOutput,
    FinalOutput,
  >(
    props: JobProps<
      InitialInput,
      IncrementalInput,
      IncrementalOutput,
      FinalOutput
    >
  ) {
    const job = new Job({
      ...props,
      onCleanup: () => {
        this.cleanupJob(job.iri);
      },
    });
    this.jobsByIri[job.iri] = job;
    return job;
  }

  cleanupJob(iri: string) {
    delete this.jobsByIri[iri];
  }
}
