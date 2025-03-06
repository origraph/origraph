import { GraphCache } from 'constants/graphCache';
import {
  AnyGraphItem,
  AttributeValue,
  createGhostIri,
  getEmptyGraphItemExternalReferences,
  GHOST_TYPE,
  GRAPH_LINK_DIRECTION,
  GraphAttribute,
  GraphGroup,
  GraphLink,
  GROUP_ORDER,
  GROUP_ORDER_DIRECTION,
  INTERPRETATION,
  InterpretationHumanLabelByIri,
  InterpretationIri,
  ScopeLinkDetails,
  ScopeNote,
} from 'constants/semantic';
import { createItemFromProps } from './createItemFromProps';
import { sortByRecentInteraction } from './groupOrder/sortByRecentInteraction';

const createProxyIri = (groupIris: Set<string>, isEmpty?: boolean) =>
  `${Array.from(groupIris).sort().join(':')}${isEmpty ? ':empty' : ''}:proxy`;

type HierarchyItem = {
  iri: string;
  isAlias?: boolean;
  groupChildren?: OrderedHierarchyLevel;
  attributeChildren?: OrderedHierarchyLevel;
};
type OrderedHierarchyLevel = HierarchyItem[];

/*
  About all the weird terminology:

  "Scope" refers to an arbitrary subset of graph items, that should be treated
  as an independent source of truth. Depending on whether or not a scoped item
  is available in the cache, we describe it as either a "loaded scope" item, or
  an "unloaded scope" iri.

  Whenever we see a loaded scope item, we store copies of its interpretation,
  label, and source/target/direction if it's a link, to assist in basic
  rendering if/when it becomes unloaded, and all we have is its IRI. Although
  this represents a memory leak, this information should only be auto-removed
  when an item is actually deleted, not when it merely falls out of cache.
  Informed by visualizations that keep them apprised of the growing scope size,
  it's up to the user to configure how the scope should be cleared when it gets
  too big (and/or do it manually).

  Additionally, any IRI referenced by a loaded scope item, that is not also in
  the scope, is considered either a "loaded periphery" item or "unloaded
  periphery" iri, depending on whether it is available in the cache.
  
  Only loaded items are guaranteed to actually exist. For example, newly-created
  links have auto-generated, in-scope, but not-yet-interpreted "ghost" endpoints
  (that we know have not yet been saved to the quadstore). Similarly, detached
  attributes may describe "ghost," not-yet-interpreted items. Finally, although
  unloaded scope links attempt to keep a note of their endpoints and direction,
  any unloaded periphery links will not have any information about their other
  endpoint or direction. The endpoints of such links may or may not exist and
  have interpretations; we don't know.

  Both for data abstraction expressiveness and to reduce clutter, collapsible
  group items themselves further subdivide items beyond loaded / unloaded, scope
  / periphery. Whenever a group is collapsed, we create "proxy" items to
  represent all items within a given group partition.
  
  Depending on hideLinksWithHiddenEndpoints, links and hyperedges may be
  entirely hidden, if all of their endpoints are hidden. Otherwise, they will
  appear as self-edges on their closest proxy. Additionally, depending on the
  collapseLinks setting, parallel links that would appear with the same
  direction and endpoint (especially for links connecting the same proxies) may
  also be collapsed into link proxies. 

  For convenience, constructVisibleItems creates temporary GraphItems for all
  unloaded IRIs and proxy items. These generally should not be stored in the
  database, but are set to save into the scratch graph if that ever becomes
  necessary.
  */
export enum SCOPE_LOOKUP {
  LoadedScope = 'loadedScope',
  UnloadedScope = 'unloadedScope',
  LoadedPeriphery = 'loadedPeriphery',
  UnloadedPeriphery = 'unloadedPeriphery',
  Proxies = 'proxies',
  Ghosts = 'ghosts',
}
export type InstanceEditorVisibleItems = {
  loadedScope: Record<string, AnyGraphItem>;
  unloadedScope: Record<string, AnyGraphItem>;
  loadedPeriphery: Record<string, AnyGraphItem>;
  unloadedPeriphery: Record<string, AnyGraphItem>;
  proxies: Record<string, AnyGraphItem>;
  ghosts: Record<string, AnyGraphItem>;
  scopeLookupByIri: Record<string, SCOPE_LOOKUP>;
  proxiesByHiddenIri: Record<string, string>;
  proxiesByParentGroupIri: Record<string, Set<string>>;
  hierarchy: HierarchyItem;
  visiblePathsFromRoot: Record<string, string[][]>;
};

export const getEmptyInstanceEditorContextItems =
  (): InstanceEditorVisibleItems => ({
    loadedScope: {},
    unloadedScope: {},
    loadedPeriphery: {},
    unloadedPeriphery: {},
    proxies: {},
    ghosts: {},
    scopeLookupByIri: {},
    proxiesByHiddenIri: {},
    proxiesByParentGroupIri: {},
    hierarchy: { iri: '' },
    visiblePathsFromRoot: {},
  });

export const constructVisibleItems = ({
  collapseLinks,
  defaultSort,
  defaultSortDirection,
  expandedGroups,
  graphCache,
  hideLinksWithHiddenEndpoints,
  periphery,
  scope,
  tempNamedGraph,
}: {
  collapseLinks: boolean;
  defaultSort: GROUP_ORDER;
  defaultSortDirection: GROUP_ORDER_DIRECTION;
  expandedGroups: Set<string>;
  graphCache: GraphCache;
  hideLinksWithHiddenEndpoints: boolean;
  periphery: Record<string, ScopeNote>;
  scope: Record<string, ScopeNote>;
  tempNamedGraph: string;
}) => {
  const visibleItems = getEmptyInstanceEditorContextItems();
  const allIris = [...Object.keys(scope), ...Object.keys(periphery)];

  // Construct temporary lookups for unloaded things, based on the loaded
  // information that we have.
  const unloadedGroupMemberships: Record<string, Set<string>> = {};
  const unloadedGroupMembers: Record<string, Set<string>> = {};
  const unloadedItemAttributes: Record<string, Set<string>> = {};
  const ghostItemAttributes: Record<string, Set<string>> = {};
  allIris.forEach((iri) => {
    const item = graphCache.itemsByIri.peek(iri);
    item?.externalReferences?.groupMembers.forEach((childIri) => {
      if (!graphCache.itemsByIri.peek(childIri)) {
        if (!unloadedGroupMemberships[childIri]) {
          unloadedGroupMemberships[childIri] = new Set();
        }
        unloadedGroupMemberships[childIri].add(iri);
        const childInterpretation = (scope[childIri] || periphery[childIri])
          .interpretation;
        if (
          item.interpretation === INTERPRETATION.Hyperedge &&
          childInterpretation !== INTERPRETATION.Link
        ) {
          console.warn(
            `Unexpectedly encountered unloaded non-link ${childIri} (${InterpretationHumanLabelByIri[childInterpretation]}) as member of loaded hyperedge ${iri}`
          );
        }
      }
    });
    item?.groupMemberships?.forEach((parentIri) => {
      if (!graphCache.itemsByIri.peek(parentIri)) {
        if (!unloadedGroupMembers[parentIri]) {
          unloadedGroupMembers[parentIri] = new Set();
        }
        unloadedGroupMembers[parentIri].add(iri);
        const parentInterpretation = (scope[parentIri] || periphery[parentIri])
          .interpretation;
        if (
          parentInterpretation === INTERPRETATION.Hyperedge &&
          item.interpretation !== INTERPRETATION.Link
        ) {
          console.warn(
            `Unexpectedly encountered loaded non-link ${iri} (${
              InterpretationHumanLabelByIri[item.interpretation]
            }) as member of unloaded hyperedge ${parentIri}`
          );
        }
      }
    });
    if (item?.interpretation === INTERPRETATION.Attribute) {
      if (item.describesIri) {
        if (!graphCache.itemsByIri.peek(item.describesIri)) {
          if (!unloadedItemAttributes[item.describesIri]) {
            unloadedItemAttributes[item.describesIri] = new Set();
          }
          unloadedItemAttributes[item.describesIri].add(iri);
        }
      } else {
        const ghostIri = createGhostIri(iri, GHOST_TYPE.AttributeDescribes);
        if (!ghostItemAttributes[ghostIri]) {
          ghostItemAttributes[ghostIri] = new Set();
        }
        ghostItemAttributes[ghostIri].add(iri);
      }
    }
  });

  // Build the initial hierarchy of visible "main" (i.e. non-link,
  // non-attribute) items. Items are visible when they either have 1. no group
  // memberships (root items; this should include all ghosts), or 2. have at
  // least one uncollapsed path from the root AND have no collapsed path from
  // the root
  const mainRoots: string[] = allIris.filter((iri) => {
    const note = scope[iri] || periphery[iri];
    if (note.ghostType) {
      return true;
    }
    if (
      note.interpretation === INTERPRETATION.Link ||
      note.interpretation === INTERPRETATION.Hyperedge ||
      note.interpretation === INTERPRETATION.Attribute
    ) {
      return false;
    }
    return (
      !unloadedGroupMemberships[iri] &&
      !graphCache.itemsByIri.peek(iri)?.groupMemberships?.size
    );
  });
  if (defaultSort === GROUP_ORDER.RecentInteraction) {
    sortByRecentInteraction({
      iris: mainRoots,
      graphCache,
      direction: defaultSortDirection,
    });
  }
  type VisibleQueueItem = {
    iri: string;
    path: string[];
  };
  const visibleNonLinkQueue: Array<VisibleQueueItem> = mainRoots.map((iri) => ({
    iri,
    path: [iri],
  }));

  const getHierarchyItem = (
    path: string[],
    currentItem: HierarchyItem = visibleItems.hierarchy
  ) => {
    if (path.length === 0) {
      return currentItem;
    }
    const groupChild = currentItem.groupChildren?.find(
      ({ iri }) => iri === path[0]
    );
    if (groupChild) {
      return getHierarchyItem(path.slice(1), groupChild);
    }
    const attributeChild = currentItem.attributeChildren?.find(
      ({ iri }) => iri === path[0]
    );
    if (attributeChild) {
      return getHierarchyItem(path.slice(1), attributeChild);
    }
    return null;
  };
  const addHierarchyItem = ({
    path,
    interpretation,
    isAlias,
  }: {
    path: string[];
    interpretation: InterpretationIri;
    isAlias?: boolean;
  }) => {
    if (path.length === 0) {
      throw new Error(
        `Cannot add a ${InterpretationHumanLabelByIri[interpretation]} item with an empty path`
      );
    }
    const parentHierarchyItem =
      path.length === 1
        ? visibleItems.hierarchy
        : getHierarchyItem(path.slice(0, -1));
    if (!parentHierarchyItem) {
      throw new Error(
        `Could not find parent, in order to add item to hierarchy: ${JSON.stringify(
          { path, hierarchy: visibleItems.hierarchy },
          null,
          2
        )}`
      );
    }
    if (interpretation === INTERPRETATION.Attribute) {
      if (!parentHierarchyItem.attributeChildren) {
        parentHierarchyItem.attributeChildren = [];
      }
      parentHierarchyItem.attributeChildren.push({
        iri: path[path.length - 1],
        isAlias,
      });
    } else {
      if (!parentHierarchyItem.groupChildren) {
        parentHierarchyItem.groupChildren = [];
      }
      parentHierarchyItem.groupChildren.push({
        iri: path[path.length - 1],
        isAlias,
      });
    }
  };
  const clearHierarchyItem = (path: string[]) => {
    if (path.length === 0) {
      throw new Error(`Cannot clear item with an empty path`);
    }
    const parentHierarchyItem =
      path.length === 1
        ? visibleItems.hierarchy
        : getHierarchyItem(path.slice(0, -1));
    const itemIri = path[path.length - 1];
    if (!parentHierarchyItem) {
      throw new Error(
        `Could not find parent to clear hidden item from hierarchy: ${JSON.stringify(
          { path, hierarchy: visibleItems.hierarchy },
          null,
          2
        )}`
      );
    }
    parentHierarchyItem.attributeChildren =
      parentHierarchyItem.attributeChildren?.filter(
        ({ iri }) => iri !== itemIri
      ) || [];
    if (parentHierarchyItem.attributeChildren.length === 0) {
      delete parentHierarchyItem.attributeChildren;
    }
    parentHierarchyItem.groupChildren =
      parentHierarchyItem.groupChildren?.filter(({ iri }) => iri !== itemIri) ||
      [];
    if (parentHierarchyItem.groupChildren.length === 0) {
      delete parentHierarchyItem.groupChildren;
    }
  };
  // Function to populate loadedScope, loadedPeriphery, unloadedScope, and
  // unloadedPeriphery, creating fake items as needed
  const addItem = (
    iri: string,
    note: ScopeNote = scope[iri] || periphery[iri],
    proxyFor?: Set<string>
  ) => {
    let item = graphCache.itemsByIri.peek(iri);
    if (
      item?.interpretation === INTERPRETATION.Link &&
      (item.sourceIri === undefined || item.targetIri === undefined)
    ) {
      // Because ghost nodes are added to visibleItems on the fly, and not
      // stored in the cache, we need to replace any links in visibleItems that
      // have missing endpoints with copies that reference their ghost endpoints
      item = new GraphLink({
        ...item,
        sourceIri: (note.linkDetails as ScopeLinkDetails).sourceIri,
        targetIri: (note.linkDetails as ScopeLinkDetails).targetIri,
      });
    }
    if (item) {
      if (scope[iri]) {
        visibleItems.loadedScope[iri] = item;
        visibleItems.scopeLookupByIri[iri] = SCOPE_LOOKUP.LoadedScope;
      } else if (periphery[iri]) {
        visibleItems.loadedPeriphery[iri] = item;
        visibleItems.scopeLookupByIri[iri] = SCOPE_LOOKUP.LoadedPeriphery;
      } else {
        throw new Error(
          `Unexpectedly tried to add loaded item to the hierarchy, that is neither in the scope nor periphery: ${iri}`
        );
      }
    } else {
      const externalReferences = getEmptyGraphItemExternalReferences();
      if (note.ghostType) {
        [...Object.entries(scope), ...Object.entries(periphery)].forEach(
          ([otherIri, otherNote]) => {
            if (
              otherNote.linkDetails?.sourceIri === iri ||
              otherNote?.linkDetails?.targetIri === iri
            ) {
              externalReferences.linkReferences.add(otherIri);
            }
          }
        );
      }
      const fakeItem = createItemFromProps({
        props: {
          iri,
          namedGraph: tempNamedGraph,
          label: new GraphAttribute({
            namedGraph: tempNamedGraph,
            values: [
              new AttributeValue({
                stringValue:
                  note.label ||
                  `Temporary ${
                    InterpretationHumanLabelByIri[note.interpretation]
                  }`,
              }),
            ],
          }),
          proxyFor,
          externalReferences,
          ghostType: note.ghostType,
          ...(note.linkDetails || {}),
        },
        interpretation: note.interpretation,
        namedGraphForConflictQuads: tempNamedGraph,
      });
      if (proxyFor) {
        visibleItems.proxies[iri] = fakeItem;
        visibleItems.scopeLookupByIri[iri] = SCOPE_LOOKUP.Proxies;
        proxyFor.forEach((hiddenIri) => {
          visibleItems.proxiesByHiddenIri[hiddenIri] = iri;
        });
      } else if (note.ghostType) {
        visibleItems.ghosts[iri] = fakeItem;
        visibleItems.scopeLookupByIri[iri] = SCOPE_LOOKUP.Ghosts;
      } else if (scope[iri]) {
        visibleItems.unloadedScope[iri] = fakeItem;
        visibleItems.scopeLookupByIri[iri] = SCOPE_LOOKUP.UnloadedScope;
      } else if (periphery[iri]) {
        visibleItems.unloadedPeriphery[iri] = fakeItem;
        visibleItems.scopeLookupByIri[iri] = SCOPE_LOOKUP.UnloadedPeriphery;
      } else {
        throw new Error(
          `Unexpectedly tried to add unloaded item to the hierarchy, that is neither in the scope nor periphery: ${iri}`
        );
      }
    }
  };

  // The set of iris that are immediate children of collapsed groups
  const immediatelyCollapsedGroupMembers = new Set<string>();
  const traverseVisibleHierarchy = ({ iri, path }: VisibleQueueItem) => {
    const item = graphCache.itemsByIri.peek(iri);
    const note = scope[iri] || periphery[iri];

    if (visibleItems.visiblePathsFromRoot[iri]) {
      visibleItems.visiblePathsFromRoot[iri].push(path);
      addHierarchyItem({
        path,
        interpretation: note.interpretation,
        isAlias: true,
      });
      return;
    }
    visibleItems.visiblePathsFromRoot[iri] = [path];
    addHierarchyItem({ path, interpretation: note.interpretation });

    // Some views may or may not display attributes as expandable; these
    // expanded separately
    const attributeChildren = Array.from(
      item?.externalReferences?.attributes ||
        unloadedItemAttributes[iri] ||
        ghostItemAttributes[iri] ||
        []
    ).filter((childIri) => {
      const isAttribute =
        (scope[childIri] || periphery[childIri])?.interpretation ===
        INTERPRETATION.Attribute;
      if (!isAttribute) {
        console.warn(
          `Ignoring unexpected non-attribute ${childIri} listed as attribute of ${iri}`
        );
      }
    });
    if (
      attributeChildren.length > 0 &&
      note.interpretation === INTERPRETATION.Attribute
    ) {
      console.warn(
        `Attribute ${iri} unexpectedly has attributes of its own: ${JSON.stringify(
          attributeChildren,
          null,
          2
        )}; ignoring...`
      );
    }
    // TODO: not supporting views that expand attributes yet... when we do, some form of this needs
    // to come back here:
    // if (itemsWithExpandedAttributes.has(iri)) {
    //   // TODO: sort attributes... probably based on the model? And/or maybe need to generalize orderBy beyond groups?
    //   visibleNonLinkQueue.push(
    //     ...attributeChildren.map((childIri) => ({
    //       iri: childIri,
    //       path: path.concat([childIri]),
    //     }))
    //   );
    // }

    const groupChildren = Array.from(
      item?.externalReferences?.groupMembers || unloadedGroupMembers[iri] || []
    ).filter((childIri) => {
      const childNote = scope[childIri] || periphery[childIri];
      const usuallyNotChildOfGroup =
        childNote.interpretation === INTERPRETATION.Attribute ||
        childNote.interpretation === INTERPRETATION.Link ||
        childNote.interpretation === INTERPRETATION.Hyperedge;
      if (usuallyNotChildOfGroup) {
        console.warn(
          `Ignoring ${childIri}; items of type ${
            InterpretationHumanLabelByIri[childNote.interpretation]
          } are not normally rendered when direct members of a group (${iri})`
        );
      }
      return !usuallyNotChildOfGroup;
    });
    if (
      groupChildren.length > 0 &&
      note.interpretation !== INTERPRETATION.Group
    ) {
      console.warn(
        `Non-group ${iri} (${
          InterpretationHumanLabelByIri[note.interpretation]
        }) unexpectedly has group members: ${JSON.stringify(
          groupChildren,
          null,
          2
        )}`
      );
    } else if (
      groupChildren.length === 0 &&
      note.interpretation === INTERPRETATION.Group
    ) {
      const proxyIri = createProxyIri(new Set([iri]), true);
      addItem(
        proxyIri,
        {
          interpretation: INTERPRETATION.Node,
          label: `Bug, er, uh... easter egg discovered! You shouldn't be able to see empty group proxy nodes!`,
        },
        new Set()
      );
      visibleItems.proxiesByParentGroupIri[iri] = new Set([proxyIri]);
      visibleItems.visiblePathsFromRoot[proxyIri] = [path.concat([proxyIri])];
    }
    if (expandedGroups.has(iri)) {
      // Groups are collapsed by default
      const orderBy = (item as GraphGroup).orderBy || defaultSort;
      const direction =
        (item as GraphGroup).orderDirection || defaultSortDirection;
      if (orderBy === GROUP_ORDER.RecentInteraction) {
        sortByRecentInteraction({
          iris: groupChildren,
          graphCache,
          direction,
        });
      }
      visibleNonLinkQueue.push(
        ...groupChildren.map((childIri) => ({
          iri: childIri,
          path: path.concat([childIri]),
        }))
      );
    } else if (groupChildren.length > 0) {
      groupChildren.forEach((childIri) =>
        immediatelyCollapsedGroupMembers.add(childIri)
      );
    }
  };
  while (visibleNonLinkQueue.length > 0) {
    traverseVisibleHierarchy(visibleNonLinkQueue.shift() as VisibleQueueItem);
  }

  type HiddenQueueItem = {
    iri: string;
    visibleProxyIri: string;
  };
  const hiddenNonLinkQueue: HiddenQueueItem[] = [];
  const traverseHiddenHierarchy = ({
    iri,
    visibleProxyIri,
  }: HiddenQueueItem) => {
    if (visibleItems.proxiesByHiddenIri[iri]) {
      if (visibleItems.proxiesByHiddenIri[iri] !== visibleProxyIri) {
        // TODO: before removing this warning and switching to a set of all
        // relevant proxies, figure out how to better draw sourceIri / targetIri
        // down below. Drawing a link to the same endpoint (that's just
        // represented by multiple proxies) as a hyperedge is probably correct,
        // but also confusing?
        console.warn(
          `Ignoring additional proxy for ${iri}: ${visibleProxyIri} (only using ${visibleItems.proxiesByHiddenIri[iri]} as its canonical proxy)`
        );
      }
      return;
    }
    visibleItems.proxiesByHiddenIri[iri] = visibleProxyIri;

    // Remove any paths to hiddenIri; even if other routes would make
    // hiddenIri visible, ANY collapsed ancestors mean that they should be
    // replaced by proxies
    (visibleItems.visiblePathsFromRoot[iri] || []).forEach((path) => {
      clearHierarchyItem(path);
    });
    delete visibleItems.visiblePathsFromRoot[iri];

    // Add all non-link children to the queue (hidden attributes can be
    // treated the same as hidden items)
    const hiddenChildren =
      graphCache.itemsByIri.peek(iri)?.externalReferences?.groupMembers ||
      unloadedGroupMembers[iri] ||
      new Set();
    hiddenChildren.forEach((childIri) => {
      const childNote = scope[childIri] || periphery[childIri];
      if (
        childNote.interpretation !== INTERPRETATION.Link &&
        childNote.interpretation !== INTERPRETATION.Hyperedge
      ) {
        hiddenNonLinkQueue.push({
          iri: childIri,
          visibleProxyIri,
        });
      }
    });
  };

  // Before recursing the hidden part of the hierarchy, determine which proxies
  // are necessary for intersecting subsets of collapsed groups
  immediatelyCollapsedGroupMembers.forEach((hiddenIri) => {
    const hiddenItem = graphCache.itemsByIri.peek(hiddenIri);
    const visibleParentIris = new Set(
      Array.from(
        hiddenItem?.groupMemberships ||
          unloadedGroupMemberships[hiddenIri] ||
          []
      ).filter((parentIri) => visibleItems.visiblePathsFromRoot[parentIri])
    );
    if (visibleParentIris.size === 0) {
      // I don't think this should ever happen...?
      console.warn(
        `Skipping proxy for hidden item ${hiddenIri} with no visible parents`
      );
      return;
    }
    // Create / add to the proxy item
    const proxyIri = createProxyIri(visibleParentIris);
    if (!visibleItems.proxies[proxyIri]) {
      addItem(
        proxyIri,
        {
          interpretation: INTERPRETATION.Node,
          label: `Proxy node`,
        },
        visibleParentIris
      );
      visibleItems.visiblePathsFromRoot[proxyIri] = Array.from(
        visibleParentIris
      ).reduce<string[][]>(
        (agg, visibleParentIri) =>
          agg.concat(
            visibleItems.visiblePathsFromRoot[visibleParentIri].map(
              (parentPath) => parentPath.concat([proxyIri])
            )
          ),
        []
      );
      visibleParentIris.forEach((parentGroupIri) => {
        if (!visibleItems.proxiesByParentGroupIri[parentGroupIri]) {
          visibleItems.proxiesByParentGroupIri[parentGroupIri] = new Set();
        }
        visibleItems.proxiesByParentGroupIri[parentGroupIri].add(proxyIri);
      });
    }

    // Handle cleanup + populate proxiesByHiddenIri + queue up hiddenIri's children for recursion
    traverseHiddenHierarchy({ iri: hiddenIri, visibleProxyIri: proxyIri });
  });
  // Recursively finish cleanup + populating proxiesByHiddenIri
  while (hiddenNonLinkQueue.length > 0) {
    traverseHiddenHierarchy(hiddenNonLinkQueue.shift() as HiddenQueueItem);
  }

  // Now that we know that the hierarchy, visiblePathsFromRoot are correct and
  // all the proxies exist, add all visible "main" (non-link) items to
  // loadedScope, loadedPeriphery, unloadedScope, unloadedPeriphery, and ghosts
  // (we've already added the proxies)
  Object.keys(visibleItems.visiblePathsFromRoot).forEach((iri) => {
    if (!visibleItems.proxies[iri]) {
      addItem(iri);
    }
  });

  // Depending on the settings, finish visibleItems by adding links and
  // hyperedges directly, or bundling edges with the same endpoints under
  // proxies
  const proxyNotesByEndpointIris: Record<
    string,
    { note: ScopeNote; proxyFor: Set<string> }
  > = {};
  allIris.forEach((iri) => {
    const note = scope[iri] || periphery[iri];
    if (note.interpretation === INTERPRETATION.Link) {
      const item = graphCache.itemsByIri.peek(iri);
      if (
        Array.from(
          item?.groupMemberships || unloadedGroupMembers[iri] || []
        ).some(
          (parentIri) =>
            (scope[parentIri] || periphery[parentIri]).interpretation ===
            INTERPRETATION.Hyperedge
        )
      ) {
        // Skip links that are part of a hyperedge
        return;
      }
      const details = note.linkDetails as ScopeLinkDetails;
      const isSourceVisible = Boolean(
        visibleItems.visiblePathsFromRoot[details.sourceIri]
      );
      const isTargetVisible = Boolean(
        visibleItems.visiblePathsFromRoot[details.targetIri]
      );
      if (
        hideLinksWithHiddenEndpoints &&
        !isSourceVisible &&
        !isTargetVisible
      ) {
        return;
      }
      if (isSourceVisible && isTargetVisible && !collapseLinks) {
        // Add the link directly if it's fully visible; no proxy necessary
        addItem(iri, note);
        return;
      }
      const sourceIri = isSourceVisible
        ? details.sourceIri
        : visibleItems.proxiesByHiddenIri[details.sourceIri];
      const targetIri = isTargetVisible
        ? details.targetIri
        : visibleItems.proxiesByHiddenIri[details.targetIri];
      const endpointIris =
        details.direction === GRAPH_LINK_DIRECTION.Directed
          ? `${sourceIri}:${targetIri}:DirectedProxy`
          : `${[sourceIri, targetIri].sort().join(':')}:UndirectedProxy`;
      if (!sourceIri || !targetIri) {
        console.warn(
          `Ignoring link ${iri} because no visible or proxy item could be found for at least one of its endpoints: ${JSON.stringify(
            { sourceIri, targetIri },
            null,
            2
          )}`
        );
        return;
      }
      if (!proxyNotesByEndpointIris[endpointIris]) {
        proxyNotesByEndpointIris[endpointIris] = {
          note: {
            interpretation: INTERPRETATION.Link,
            linkDetails: {
              sourceIri,
              targetIri,
              direction: details.direction,
            },
          },
          proxyFor: new Set(),
        };
      }
      proxyNotesByEndpointIris[endpointIris].proxyFor.add(iri);
    } else if (note.interpretation === INTERPRETATION.Hyperedge) {
      throw new Error(`TODO: need to add hyperedges`);
    }
  });
  Object.entries(proxyNotesByEndpointIris).forEach(
    ([endpointIris, { note, proxyFor }]) =>
      addItem(endpointIris, note, proxyFor)
  );

  return visibleItems;
};
