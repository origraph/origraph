import { GRAPH_LINK_DIRECTION, INTERPRETATION } from 'constants/semantic';
import { Delaunay } from 'd3';
import { immerable } from 'immer';
import isEqual from 'lodash.isequal';
import {
  InstanceEditorVisibleItems,
  SCOPE_LOOKUP,
} from 'utils/constructVisibleItems';
import { Point } from './constants';
import { NeldPositionGenerator } from './NeldPositionGenerator';

// const createRouteKey = (linkIri: string, index: number) =>
//   `${linkIri}:Route${index}`;

type BaseNeldItemProps<T> = {
  iri: string;
  scopeLookup: SCOPE_LOOKUP;
  coreProps?: T;
};

class BaseNeldItem<T> implements BaseNeldItemProps<T> {
  [immerable] = true;
  iri: string;
  scopeLookup: SCOPE_LOOKUP;
  _coreProps?: T;

  constructor({ iri, scopeLookup, coreProps }: BaseNeldItemProps<T>) {
    this.iri = iri;
    this.scopeLookup = scopeLookup;
    this._coreProps = coreProps;
  }

  get isInitialized() {
    return this._coreProps !== undefined;
  }

  initialize(props: T) {
    this._coreProps = props;
  }

  get props() {
    return {
      iri: this.iri,
      scopeLookup: this.scopeLookup,
      coreProps: this._coreProps,
    };
  }
}

type NeldNodeCoreProps = { position: Point };
type NeldNodeProps = BaseNeldItemProps<NeldNodeCoreProps> & {
  fixedPosition?: Point;
  isPinned?: boolean;
};

export class NeldNode
  extends BaseNeldItem<NeldNodeCoreProps>
  implements NeldNodeProps
{
  fixedPosition?: Point; // Used for interactions, whether or not layouts are running
  isPinned: boolean; // Used track whether the node should move in subsequent layouts, whether or not the node is currently a target of interactions

  constructor(props: NeldNodeProps) {
    super(props);
    this.fixedPosition = props.fixedPosition || undefined;
    this.isPinned = props.isPinned || false;
  }

  get currentPosition() {
    return this.fixedPosition || this.position;
  }

  get position() {
    return this._coreProps?.position || { x: NaN, y: NaN };
  }

  set position(position: Point) {
    this._coreProps = { position };
  }

  get props() {
    return {
      ...super.props,
      fixedPosition: this.fixedPosition,
      isPinned: this.isPinned,
    };
  }
}

type MstLink = {
  sourceIri: string;
  targetIri: string;
  squaredDistance: number;
};
type NeldGroupCoreProps = {
  mst: MstLink[];
  offsetByNodeIri: Record<string, number>;
};
type NeldGroupProps = BaseNeldItemProps<NeldGroupCoreProps> & {
  // groupMembers is redundantly copied from the results of
  // constructVisibleItems, but still stored here for convenience (cleaner types
  // and minimizing prop drilling of visibleItems everywhere)
  groupMembers: Set<string>;
};

export class NeldGroup
  extends BaseNeldItem<NeldGroupCoreProps>
  implements NeldGroupProps
{
  groupMembers: Set<string>;

  constructor(props: NeldGroupProps) {
    super(props);
    this.groupMembers = props.groupMembers;
  }

  get mst() {
    return this._coreProps?.mst || [];
  }

  getOffset(nodeIri: string) {
    return this._coreProps?.offsetByNodeIri?.[nodeIri] || 1;
  }
}

type NeldLinkCoreProps = {
  offset: number;
};
type NeldLinkProps = BaseNeldItemProps<NeldLinkCoreProps> & {
  // sourceIri, targetIri, and direction are redundantly copied from the results
  // of constructVisibleItems, but still stored here for convenience (cleaner
  // types and minimizing prop drilling of visibleItems everywhere)
  sourceIri: string;
  targetIri: string;
  direction: GRAPH_LINK_DIRECTION;
};

export class NeldLink
  extends BaseNeldItem<NeldLinkCoreProps>
  implements NeldLinkProps
{
  sourceIri: string;
  targetIri: string;
  direction: GRAPH_LINK_DIRECTION;

  constructor(props: NeldLinkProps) {
    super(props);
    this.sourceIri = props.sourceIri;
    this.targetIri = props.targetIri;
    this.direction = props.direction;
  }
  get offset() {
    return this._coreProps?.offset || 0;
  }

  set offset(offset: number) {
    this._coreProps = { offset };
  }
}

export class NeldGraph {
  nodesByIri: Record<string, NeldNode> = {};
  linksByIri: Record<string, NeldLink> = {};
  groupsByIri: Record<string, NeldGroup> = {};
  groupOrder: string[] = [];
  topGroupByNodeIri: Record<string, string> = {};
  _newNodePositions: Record<string, Point> = {};
  [immerable] = true;

  setNodePosition({ iri, position }: { iri: string; position: Point }) {
    if (!this.nodesByIri[iri]) {
      // The node hasn't actually been created yet; save the position until
      // it is actually initialized
      this._newNodePositions[iri] = position;
    } else {
      this.nodesByIri[iri].position = position;
    }
  }

  static initFromVisibleItems({
    visibleItems,
    layout,
    bounds,
    priorGraph,
  }: {
    visibleItems: InstanceEditorVisibleItems;
    layout: NeldPositionGenerator;
    priorGraph?: NeldGraph;
    bounds: DOMRectReadOnly;
  }) {
    const newNodePositions = Object.assign(
      {},
      priorGraph?._newNodePositions || {}
    );

    const graph = new NeldGraph();

    Object.entries(visibleItems.scopeLookupByIri).forEach(
      ([iri, scopeLookup]) => {
        const item = visibleItems[scopeLookup][iri];
        if (!item) {
          throw new Error(`Visible item ${iri} was never initialized`);
        }
        if (item.interpretation === INTERPRETATION.Link) {
          const priorLink = priorGraph?.linksByIri?.[iri];
          // If link endpoints have changed (ghost to real item or vice-versa),
          // preserve the previous position
          if (
            priorLink?.sourceIri &&
            item.sourceIri &&
            priorLink.sourceIri !== item.sourceIri &&
            priorGraph?.nodesByIri?.[priorLink.sourceIri]
          ) {
            newNodePositions[item.sourceIri] =
              priorGraph?.nodesByIri[priorLink.sourceIri].currentPosition;
          }
          if (
            priorLink?.targetIri &&
            item.targetIri &&
            priorLink.targetIri !== item.targetIri &&
            priorGraph?.nodesByIri?.[priorLink.targetIri]
          ) {
            newNodePositions[item.targetIri] =
              priorGraph?.nodesByIri[priorLink.targetIri].currentPosition;
          }
          graph.linksByIri[iri] = new NeldLink({
            ...(priorLink?.props || {}),
            sourceIri: item.sourceIri as string,
            targetIri: item.targetIri as string,
            direction: item.direction,
            iri,
            scopeLookup,
          });
        } else if (item.interpretation === INTERPRETATION.Group) {
          const groupMembers = new Set([
            ...Array.from(item.externalReferences.groupMembers).filter((iri) =>
              Boolean(visibleItems.loadedScope[iri])
            ),
            ...(visibleItems.proxiesByParentGroupIri[iri] || []),
          ]);
          graph.groupOrder.push(iri);
          graph.groupsByIri[iri] = new NeldGroup({
            ...(priorGraph?.groupsByIri?.[iri]?.props || {}),
            groupMembers,
            iri,
            scopeLookup,
          });
        } else if (item.interpretation !== INTERPRETATION.Attribute) {
          // We don't (yet) show attributes on the canvas
          graph.nodesByIri[iri] = new NeldNode({
            ...priorGraph?.nodesByIri?.[iri]?.props,
            iri,
            scopeLookup,
          });
        }
      }
    );

    // TODO: copy over any route nodes that are in priorGraph

    // Ensure that all nodes are initialized
    Object.values(graph.nodesByIri).forEach((node) => {
      if (newNodePositions[node.iri]) {
        node.position = newNodePositions[node.iri];
        delete newNodePositions[node.iri];
      } else if (!node.isInitialized) {
        node.position = layout.initPosition({ node, bounds });
      }
    });
    // Preserve any positions for nodes that we still haven't seen
    graph._newNodePositions = newNodePositions;

    // With node positions initialized, initialize the links and groups
    graph.updateLinks();
    graph.updateGroups();

    return graph;
  }

  updateLinks() {
    // Assign parallel link offsets, split by direction
    const directedLinkIrisByKeyPair: Record<string, string[]> = {};
    const undirectedLinkIrisByKeyPair: Record<string, string[]> = {};
    Object.entries(this.linksByIri).forEach(([iri, link]) => {
      const source = this.nodesByIri[link.sourceIri];
      const target = this.nodesByIri[link.targetIri];
      const baseKeyPair = `${source.iri}_${target.iri}`;
      if (link.direction === GRAPH_LINK_DIRECTION.Directed) {
        if (directedLinkIrisByKeyPair[baseKeyPair]) {
          directedLinkIrisByKeyPair[baseKeyPair].push(link.iri);
        } else {
          directedLinkIrisByKeyPair[baseKeyPair] = [iri];
        }
      } else {
        const reverseKey = `${target.iri}_${source.iri}`;
        if (undirectedLinkIrisByKeyPair[baseKeyPair]) {
          undirectedLinkIrisByKeyPair[baseKeyPair].push(iri);
        } else if (undirectedLinkIrisByKeyPair[reverseKey]) {
          undirectedLinkIrisByKeyPair[reverseKey].push(iri);
        } else {
          undirectedLinkIrisByKeyPair[baseKeyPair] = [iri];
        }
      }
    });

    // Center the undirected links
    Object.values(undirectedLinkIrisByKeyPair).forEach((iris) => {
      iris.forEach((iri, index) => {
        this.linksByIri[iri].offset =
          iris.length * ((index + 0.5) / iris.length - 0.5);
      });
    });

    // Add directed links offset to the right
    Object.entries(directedLinkIrisByKeyPair).forEach(([forwardKey, iris]) => {
      const link = this.linksByIri[iris[0]];
      const reverseKey = `${link.targetIri}_${link.sourceIri}`;
      const baseOffset =
        forwardKey in undirectedLinkIrisByKeyPair
          ? undirectedLinkIrisByKeyPair[forwardKey].length / 2
          : reverseKey in undirectedLinkIrisByKeyPair
          ? undirectedLinkIrisByKeyPair[reverseKey].length / 2
          : 1;
      iris.forEach((iri, index) => {
        this.linksByIri[iri].offset = baseOffset + index;
      });
    });
  }

  updateGroups() {
    const groupMemberships: Record<string, Set<string>> = {};
    const mstLinksByGroupIri: Record<string, MstLink[]> = {};

    Object.entries(this.groupsByIri).forEach(([groupIri, group]) => {
      // Compute euclidean minimum spanning trees for each visible group; doing
      // a lazy Prim's algorithm based on d3 Delaunay for now. Could easily be a
      // faster / better way to do this...
      const memberOrder = Array.from(group.groupMembers);
      const memberOrderIndexByIri = Object.fromEntries(
        memberOrder.map((iri, index) => [iri, index])
      );
      const delaunay = new Delaunay(
        memberOrder.flatMap((iri) => [
          this.nodesByIri[iri].position.x,
          this.nodesByIri[iri].position.y,
        ])
      );
      const unconnectedNodes = new Set(memberOrder); // mutable copy of group.groupMembers
      const mst: MstLink[] = [];
      if (unconnectedNodes.size > 1) {
        while (unconnectedNodes.size > 0) {
          let potentialLinks: Array<{ sourceIri: string; targetIri: string }>;
          if (mst.length === 0) {
            potentialLinks = Array.from(delaunay.neighbors(0))
              .filter((neighborIndex) => neighborIndex >= 0)
              .map((neighborIndex) => {
                return {
                  sourceIri: memberOrder[0],
                  targetIri: memberOrder[neighborIndex],
                };
              });
          } else {
            potentialLinks = mst
              .flatMap(({ sourceIri, targetIri }) => [
                memberOrderIndexByIri[sourceIri],
                memberOrderIndexByIri[targetIri],
              ])
              .flatMap((connectedIndex) =>
                Array.from(delaunay.neighbors(connectedIndex))
                  .filter((neighborIndex) =>
                    unconnectedNodes.has(memberOrder[neighborIndex])
                  )
                  .map((neighborIndex) => ({
                    sourceIri: memberOrder[connectedIndex],
                    targetIri: memberOrder[neighborIndex],
                  }))
              );
          }
          if (potentialLinks.length === 0) {
            throw new Error(
              `Unexpectedly could not find potential links to complete MST: ${JSON.stringify(
                { memberOrder, unconnectedNodes, mst },
                null,
                2
              )}`
            );
          }
          const newLink = {
            sourceIri: '',
            targetIri: '',
            squaredDistance: Infinity,
          };
          potentialLinks.forEach(({ sourceIri, targetIri }) => {
            const sourcePosition = this.nodesByIri[sourceIri].position;
            const targetPosition = this.nodesByIri[targetIri].position;
            const squaredDistance =
              (sourcePosition.x - targetPosition.x) ** 2 +
              (sourcePosition.y - targetPosition.y) ** 2;
            if (squaredDistance < newLink.squaredDistance) {
              newLink.sourceIri = sourceIri;
              newLink.targetIri = targetIri;
              newLink.squaredDistance = squaredDistance;
            }
          });
          mst.push(newLink);
          unconnectedNodes.delete(newLink.sourceIri);
          unconnectedNodes.delete(newLink.targetIri);
        }
      }
      mstLinksByGroupIri[groupIri] = mst;

      memberOrder.forEach((nodeIri) => {
        if (!groupMemberships[nodeIri]) {
          groupMemberships[nodeIri] = new Set();
        }
        groupMemberships[nodeIri].add(groupIri);
      });
    });

    const allOffsets: Record<string, Record<string, number>> = {};
    this.topGroupByNodeIri = {};
    Object.entries(groupMemberships).forEach(([nodeIri, groupIris]) => {
      const groupOrderForNode = this.groupOrder.filter((iri) =>
        groupIris.has(iri)
      );
      groupOrderForNode.forEach((groupIri, index) => {
        if (!allOffsets[groupIri]) {
          allOffsets[groupIri] = {};
        }
        allOffsets[groupIri][nodeIri] = groupOrderForNode.length - index;
      });
      this.topGroupByNodeIri[nodeIri] =
        groupOrderForNode[groupOrderForNode.length - 1];
    });

    Object.entries(this.groupsByIri).forEach(([groupIri, group]) => {
      group.initialize({
        mst: mstLinksByGroupIri[groupIri],
        offsetByNodeIri: allOffsets[groupIri],
      });
    });
  }

  isEqualForLayout(other: NeldGraph) {
    // For the sake of the layout, we have only changed if the items that we're
    // showing have changed... for now, don't compare _newNodePositions or worry
    // about details beyond which IRI is showing. TODO: might need to revise
    // this, if autoLayout is on, but not appropriately responding to a changed
    // detail
    return (
      isEqual(this.groupOrder, other.groupOrder) &&
      isEqual(
        new Set(Object.keys(this.nodesByIri)),
        new Set(Object.keys(other.nodesByIri))
      ) &&
      isEqual(
        new Set(Object.keys(this.linksByIri)),
        new Set(Object.keys(other.linksByIri))
      ) &&
      isEqual(
        new Set(Object.keys(this.groupsByIri)),
        new Set(Object.keys(other.groupsByIri))
      )
    );
  }

  isEmpty() {
    return (
      Object.keys(this.nodesByIri).length === 0 &&
      Object.keys(this.linksByIri).length === 0 &&
      Object.keys(this.groupsByIri).length === 0
    );
  }
}
