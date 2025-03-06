import { NODE_LINK_CONSTANTS, Point } from 'components/Neld/constants';
import { IncrementalUpdate } from 'constants/graphCache';
import * as d3 from 'd3';
import { DEFAULT_VIEW_BOUNDS } from '../../../utils/useViewBounds';
import { NeldGraph } from '../NeldGraph';
import {
  LayoutUpdate,
  MidLayoutGraphChanges,
  NeldPositionGenerator,
  NeldPositionGeneratorInitPositionProps,
  NeldPositionGeneratorRunLayoutProps,
} from '../NeldPositionGenerator';

const JITTER_RADIUS = 100;
const GRAVITY_MULTIPLIER = 0.01;
const MAX_GRAVITY_ALPHA = 0.0005;
const LINK_STRENGTH = 0.05;
const BOUNCE_SPEED = 20;
const CHARGE_STRENGTH = -300;
const N_TICKS = 100;

function getRandomPosition(center: Point) {
  return {
    x: center.x + Math.random() * JITTER_RADIUS - JITTER_RADIUS / 2,
    y: center.y + Math.random() * JITTER_RADIUS - JITTER_RADIUS / 2,
  };
}

function getCenter(bounds: DOMRectReadOnly) {
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
}

function gravityAndBounds() {
  let nodes: Array<d3.SimulationNodeDatum & Point> = [];
  let bounds: DOMRectReadOnly = DEFAULT_VIEW_BOUNDS;

  function force(alpha: number) {
    for (const node of nodes) {
      const radius = NODE_LINK_CONSTANTS.EDGE_WIDTH;
      // Kinda weird, but has a nice effect: apply gravity more strongly (within
      // a limit) at the beginning of a layout, but taper it off toward the end
      const gravityAlpha = Math.min(
        (alpha * GRAVITY_MULTIPLIER) ** 2,
        MAX_GRAVITY_ALPHA
      );

      const center = getCenter(bounds);

      if (node.x <= radius) {
        node.vx = BOUNCE_SPEED;
        node.x = radius;
      } else if (node.x >= bounds.width - radius) {
        node.vx = -BOUNCE_SPEED;
        node.x = bounds.width - radius;
      } else {
        const dx = center.x - node.x;
        node.vx = (node.vx || 0) + Math.sign(dx) * gravityAlpha * dx ** 2;
      }

      if (node.y <= radius) {
        node.vy = BOUNCE_SPEED;
        node.y = radius;
      } else if (node.y >= bounds.height - radius) {
        node.vy = -BOUNCE_SPEED;
        node.y = bounds.height - radius;
      } else {
        const dy = center.y - node.y;
        node.vy = (node.vy || 0) + Math.sign(dy) * gravityAlpha * dy ** 2;
      }
    }
  }

  force.initialize = (newNodes: Array<d3.SimulationNodeDatum & Point>) => {
    nodes = newNodes;
    return force;
  };

  force.bounds = (newBounds: DOMRectReadOnly) => {
    bounds = newBounds;
    return force;
  };

  return force;
}

interface SimulationTick extends IncrementalUpdate {
  skipYield: boolean;
}

export class D3ForceLayout extends NeldPositionGenerator {
  initPosition({ bounds }: NeldPositionGeneratorInitPositionProps) {
    return getRandomPosition(getCenter(bounds));
  }

  async *performLayout({
    currentGraph,
    bounds,
  }: NeldPositionGeneratorRunLayoutProps): AsyncGenerator<
    LayoutUpdate,
    LayoutUpdate,
    MidLayoutGraphChanges
  > {
    const initD3Graph = (currentGraph: NeldGraph) => {
      // D3 pollutes its input, and honestly only needs some basic information
      // anyway; construct a minimal graph based on keys since we don't need to
      // persist the simulation (yes, I know, this is technically a FIFTH copy of
      // the graph, in addition to what's in quadstore, what's in lru-cache, and
      // what's in visibleItems, and the NeldGraph)
      const nodeIndexLookup: Record<string, number> = {};
      const nodeKeyLookup: Record<number, string> = {};
      const d3Graph: {
        nodes: d3.SimulationNodeDatum[];
        links: d3.SimulationLinkDatum<d3.SimulationNodeDatum>[];
      } = {
        nodes: [],
        links: [],
      };
      Object.entries(currentGraph.nodesByIri).forEach(([key, neldNode]) => {
        nodeIndexLookup[key] = d3Graph.nodes.length;
        nodeKeyLookup[d3Graph.nodes.length] = key;
        const node: d3.SimulationNodeDatum = {
          ...neldNode.position,
        };
        if (neldNode.isPinned) {
          node.fx = node.x;
          node.fy = node.y;
        }
        d3Graph.nodes.push(node);
      });
      Object.values(currentGraph.linksByIri).forEach((link) => {
        d3Graph.links.push({
          source: nodeIndexLookup[link.sourceIri],
          target: nodeIndexLookup[link.targetIri],
        });
      });
      const getPositionsByKey = () =>
        Object.fromEntries(
          d3Graph.nodes.map(({ x, y }, index) => [
            nodeKeyLookup[index],
            { x: x as number, y: y as number },
          ])
        );
      return { d3Graph, getPositionsByKey };
    };
    let { d3Graph, getPositionsByKey } = initD3Graph(currentGraph);

    // Set up the simulation
    const simulation = d3
      .forceSimulation(d3Graph.nodes)
      .force('gravityAndBounds', gravityAndBounds().bounds(bounds))
      .force('link', d3.forceLink(d3Graph.links).strength(LINK_STRENGTH))
      .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
      .force(
        'collide',
        d3.forceCollide(() => NODE_LINK_CONSTANTS.EDGE_WIDTH)
      );

    // Convert alpha into percentDone, tick callback into async generator
    const tickResolves: Array<(tick: SimulationTick) => void> = [];
    const tickPromises: Promise<SimulationTick>[] = Array.from(
      new Array(N_TICKS)
    ).map(
      (_, index) =>
        new Promise((resolve) => {
          tickResolves[index] = resolve;
        })
    );

    const totalAlpha = simulation.alpha() - simulation.alphaTarget();
    let nextTickIndex = 0;
    simulation.on('tick', () => {
      const relativeAlpha =
        (simulation.alpha() - simulation.alphaTarget()) / totalAlpha;
      // Alpha decays exponentially, usually from 1 to 0. For fairly regular
      // "percent done" ticks over time (not just progress; this is also to
      // suppress early jitter), this is kind of a hand-wavy thing that
      // seems to work:
      const amountDone = Math.min(1, -Math.log(Math.max(relativeAlpha, 0.01)));
      const currentTickIndex = Math.floor(amountDone * N_TICKS);
      while (nextTickIndex < currentTickIndex) {
        // Skip any indices that we've moved past; only actually yield anything
        // for the last one
        tickResolves[nextTickIndex]({
          skipYield: nextTickIndex < currentTickIndex - 1,
          percentDone: 100 * amountDone,
        });
        nextTickIndex++;
      }
      nextTickIndex = currentTickIndex;
    });
    simulation.on('end', () => {
      while (nextTickIndex < N_TICKS) {
        // Make sure all the promises resolve; skip them all. The return
        // statement handles the final 100% result
        tickResolves[nextTickIndex]({
          skipYield: true,
          percentDone: 100,
        });
        nextTickIndex++;
      }
    });

    for await (const tick of tickPromises) {
      if (!tick.skipYield) {
        const cleanPositionsByKey = getPositionsByKey();
        const settingsUpdate = yield {
          percentDone: tick.percentDone,
          positionsByIri: cleanPositionsByKey,
        };
        if (settingsUpdate.currentGraph) {
          const newD3Graph = initD3Graph(settingsUpdate.currentGraph);
          d3Graph = newD3Graph.d3Graph;
          getPositionsByKey = newD3Graph.getPositionsByKey;
          const currentAlpha = simulation.alpha();
          simulation.nodes(d3Graph.nodes);
          (
            simulation.force('link') as d3.ForceLink<
              d3.SimulationNodeDatum,
              d3.SimulationLinkDatum<d3.SimulationNodeDatum>
            >
          ).links(d3Graph.links);
          simulation.alpha(currentAlpha);
        }
        if (settingsUpdate.forceStop) {
          return {
            percentDone: tick.percentDone,
            positionsByIri: cleanPositionsByKey,
          };
        }
        if (settingsUpdate.bounds) {
          (
            simulation.force('gravityAndBounds') as ReturnType<
              typeof gravityAndBounds
            >
          ).bounds(settingsUpdate.bounds);
        }
      }
    }

    return {
      percentDone: 100,
      positionsByIri: getPositionsByKey(),
    };
  }
}
