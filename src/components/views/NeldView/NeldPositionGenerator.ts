import { IncrementalUpdate } from 'constants/graphCache';
import { GRAPH_LINK_DIRECTION } from 'constants/semantic';
import omit from 'lodash.omit';
import { PIN_MODE, Point, POINTER_MODE } from './constants';
import { NeldGraph, NeldLink, NeldNode } from './NeldGraph';

export interface LayoutUpdate extends IncrementalUpdate {
  positionsByIri: Record<string, Point>;
}

export type NeldLayout = {
  label: string;
  positionGenerator: NeldPositionGenerator;
};

export enum LAYOUT_NAME {
  D3ForceLayout = 'Force-directed Layout',
}

export type NeldSettings = {
  currentLayout: LAYOUT_NAME;
  autoLayoutIsEnabled: boolean;
  pinMode: PIN_MODE;
  pointerMode: POINTER_MODE;
  showHelp: boolean;
};

export const DEFAULT_NODE_LINK_SETTINGS: NeldSettings = {
  currentLayout: LAYOUT_NAME.D3ForceLayout,
  autoLayoutIsEnabled: true,
  pinMode: PIN_MODE.Selected,
  pointerMode: POINTER_MODE.Move,
  showHelp: true,
};

export type NeldPositionGeneratorRunLayoutProps = {
  currentGraph: NeldGraph;
  bounds: DOMRectReadOnly;
  onTick: (update: LayoutUpdate) => void;
};
export type MidLayoutGraphChanges = Partial<
  Omit<NeldPositionGeneratorRunLayoutProps, 'onTick'> & {
    forceStop: boolean;
  }
>;

export type NeldPositionGeneratorInitPositionProps = {
  node: NeldNode;
  bounds: DOMRectReadOnly;
};

export type NeldPositionGeneratorComputeLinkOffsetProps = {
  link: NeldLink;
  source: NeldNode;
  target: NeldNode;
  direction: GRAPH_LINK_DIRECTION;
};

export abstract class NeldPositionGenerator {
  private lastUpdate: MidLayoutGraphChanges = {};
  private resolveStop: ((value: void) => void) | null = null;
  isRunning: boolean = false;

  update(props: Partial<NeldPositionGeneratorRunLayoutProps>) {
    this.lastUpdate = {
      ...props,
    };
  }

  async stopLayout() {
    if (!this.isRunning) {
      return Promise.resolve();
    }
    this.lastUpdate.forceStop = true;
    return new Promise((resolve: (value: void) => void) => {
      this.resolveStop = resolve;
    });
  }

  async runLayout(props: NeldPositionGeneratorRunLayoutProps) {
    this.lastUpdate = {
      ...omit(props, 'onTick'),
      forceStop: false,
    };
    this.isRunning = true;
    const iterator = this.performLayout(props);
    let lastTickResult: LayoutUpdate = { positionsByIri: {}, percentDone: 0 };
    while (!this.lastUpdate.forceStop) {
      const iteratorResult = await iterator.next(this.lastUpdate);
      if (iteratorResult.done) {
        this.lastUpdate.forceStop = true;
      }
      lastTickResult = iteratorResult.value;
      props.onTick(iteratorResult.value);
    }
    this.isRunning = false;
    if (this.resolveStop) {
      this.resolveStop();
      this.resolveStop = null;
    }
    return lastTickResult;
  }

  protected abstract performLayout(
    props: NeldPositionGeneratorRunLayoutProps
  ): AsyncGenerator<LayoutUpdate, LayoutUpdate, MidLayoutGraphChanges>;

  abstract initPosition(props: NeldPositionGeneratorInitPositionProps): Point;
}
