import { GraphCache } from 'constants/graphCache';
import {
  createGhostIri,
  ERROR_PLACEHOLDER_IRI,
  GHOST_TYPE,
  GRAPH_LINK_DIRECTION,
  GraphLink,
  INTERPRETATION,
  InterpretationIri,
  PERIPHERY_ITERATION_MODE,
  ScopeLinkDetails,
  ScopeNote,
} from 'constants/semantic';
import isEqual from 'lodash.isequal';

const groupsAndNodes = new Set([INTERPRETATION.Group, INTERPRETATION.Node]);
const inferPeripheryInterpretation = (
  a: InterpretationIri,
  b: InterpretationIri
) => {
  if (a === b) {
    return a;
  }
  if (isEqual(new Set([a, b]), groupsAndNodes)) {
    return INTERPRETATION.Group;
  }
  return INTERPRETATION.Item;
};

export const constructPeriphery = ({
  scope,
  graphCache,
  peripheryIterationModes,
}: {
  scope: Record<string, ScopeNote>;
  graphCache: GraphCache;
  peripheryIterationModes: Set<PERIPHERY_ITERATION_MODE>;
}) => {
  const periphery: Record<string, ScopeNote> = {};

  const addPeripheryNote = (iri: string, note: ScopeNote) => {
    if (periphery[iri]) {
      periphery[iri].interpretation = inferPeripheryInterpretation(
        periphery[iri].interpretation,
        note.interpretation
      );
      // TODO: for now, should be impossible to have conflicting ghostType /
      // linkDetails, but might eventually need to do something like
      // Object.assign(periphery[iri], note)
    } else {
      periphery[iri] = note;
    }
  };

  // Collect all loaded references to things that aren't in the scope
  Object.keys(scope).forEach((iri) => {
    const item = graphCache.itemsByIri.peek(iri);
    if (item) {
      if (item.interpretation === INTERPRETATION.Link) {
        // Always include link endpoints
        if (item.sourceIri) {
          if (!scope[item.sourceIri]) {
            addPeripheryNote(item.sourceIri, {
              interpretation: INTERPRETATION.Node,
            });
          }
        } else {
          const ghostIri = createGhostIri(item.iri, GHOST_TYPE.LinkSource);
          if (!scope[ghostIri]) {
            addPeripheryNote(ghostIri, {
              interpretation: INTERPRETATION.Node,
              ghostType: GHOST_TYPE.LinkSource,
            });
          }
        }
        if (item.targetIri) {
          if (!scope[item.targetIri]) {
            addPeripheryNote(item.targetIri, {
              interpretation: INTERPRETATION.Node,
            });
          }
        } else {
          const ghostIri = createGhostIri(item.iri, GHOST_TYPE.LinkTarget);
          if (!scope[ghostIri]) {
            addPeripheryNote(ghostIri, {
              interpretation: INTERPRETATION.Node,
              ghostType: GHOST_TYPE.LinkTarget,
            });
          }
        }
      } else if (item.interpretation === INTERPRETATION.Attribute) {
        // Always include items that attributes describe
        if (item.describesIri) {
          if (!scope[item.describesIri]) {
            addPeripheryNote(item.describesIri, {
              interpretation: INTERPRETATION.Node,
            });
          }
        } else {
          const ghostIri = createGhostIri(
            item.iri,
            GHOST_TYPE.AttributeDescribes
          );
          if (!scope[ghostIri]) {
            addPeripheryNote(ghostIri, {
              interpretation: INTERPRETATION.Node,
              ghostType: GHOST_TYPE.AttributeDescribes,
            });
          }
        }
      }
      if (peripheryIterationModes.has(PERIPHERY_ITERATION_MODE.NodeNeighbors)) {
        // Include links in the periphery, and whatever we know about its other endpoint
        item.externalReferences.linkReferences.forEach((linkIri) => {
          if (!scope[linkIri]) {
            let sourceIri: string;
            let targetIri: string;
            const loadedLink = graphCache.itemsByIri.peek(linkIri) as
              | GraphLink
              | undefined;
            if (loadedLink) {
              // Link is in the cache, but not in the scope; make a copy of its
              // information for the periphery
              if (loadedLink.sourceIri === item.iri) {
                sourceIri = item.iri;
                if (loadedLink.targetIri) {
                  targetIri = loadedLink.targetIri;
                  if (!scope[loadedLink.targetIri]) {
                    addPeripheryNote(loadedLink.targetIri, {
                      interpretation: INTERPRETATION.Node,
                    });
                  }
                } else {
                  targetIri = createGhostIri(linkIri, GHOST_TYPE.LinkTarget);
                  if (!scope[targetIri]) {
                    addPeripheryNote(targetIri, {
                      interpretation: INTERPRETATION.Node,
                      ghostType: GHOST_TYPE.LinkTarget,
                    });
                  }
                }
              } else if (loadedLink.targetIri === item.iri) {
                targetIri = item.iri;
                if (loadedLink.sourceIri) {
                  sourceIri = loadedLink.sourceIri;
                  if (!scope[loadedLink.sourceIri]) {
                    addPeripheryNote(loadedLink.sourceIri, {
                      interpretation: INTERPRETATION.Node,
                    });
                  }
                } else {
                  sourceIri = createGhostIri(linkIri, GHOST_TYPE.LinkSource);
                  if (!scope[sourceIri]) {
                    addPeripheryNote(sourceIri, {
                      interpretation: INTERPRETATION.Node,
                      ghostType: GHOST_TYPE.LinkSource,
                    });
                  }
                }
              } else {
                sourceIri = ERROR_PLACEHOLDER_IRI;
                targetIri = ERROR_PLACEHOLDER_IRI;
                console.warn(
                  `Encountered link ${linkIri} that does not have expected reference to ${item.iri}`
                );
              }
              addPeripheryNote(linkIri, {
                interpretation: INTERPRETATION.Link,
                linkDetails: {
                  sourceIri,
                  targetIri,
                  direction: loadedLink.direction,
                },
              });
            } else {
              // The referenced link isn't loaded, and it's not in the scope. We
              // don't know anything about its direction, even if another scoped
              // item also references this linkIri. If this is the first time a
              // scoped item has referenced it, create an undirected note with
              // this item as the source, and a ghost as the target. If the
              // other otherwise we ignore existing notes (but warn if this
              // endpoint doesn't match the target)
              const ghostNeighborIri = createGhostIri(
                linkIri,
                GHOST_TYPE.NeighborNode
              );
              if (!periphery[linkIri]) {
                // If this is the first time a scoped item has referenced
                // linkIri, create an undirected note with this item as the
                // source, and a NeighborNode ghost as the target (that may or
                // may not actually exist)
                addPeripheryNote(linkIri, {
                  interpretation: INTERPRETATION.Link,
                  linkDetails: {
                    sourceIri: item.iri,
                    targetIri: ghostNeighborIri,
                    direction: GRAPH_LINK_DIRECTION.Undirected,
                  },
                });
                addPeripheryNote(ghostNeighborIri, {
                  interpretation: INTERPRETATION.Node,
                  ghostType: GHOST_TYPE.NeighborNode,
                });
              } else if (!periphery[ghostNeighborIri]) {
                // If the ghost node has already been deleted (see next else
                // block), that means that there are more than two items that
                // reference linkIri
                // TODO: auto-convert to a hyperedge???
                console.warn(
                  `Ignoring ${
                    item.iri
                  } reference to unloaded link ${linkIri}, because the link has already been referenced at least twice: ${JSON.stringify(
                    periphery[linkIri]
                  )}\nTODO: should probably auto-interpret unloaded periphery links with >2 references as hyperedges?`
                );
              } else {
                // This is the second time a scoped item has referenced linkIri;
                // update the periphery note to signal us as the targetIri
                // instead of the ghost, and remove the ghost
                delete periphery[ghostNeighborIri];
                (periphery[linkIri].linkDetails as ScopeLinkDetails).targetIri =
                  item.iri;
              }
            }
          }
        });
      }
      if (peripheryIterationModes.has(PERIPHERY_ITERATION_MODE.ParentGroups)) {
        // Include referenced parent groups
        item.groupMemberships.forEach((parentIri) => {
          if (!scope[parentIri]) {
            addPeripheryNote(parentIri, {
              interpretation: INTERPRETATION.Group,
            });
          }
        });
      }
      if (peripheryIterationModes.has(PERIPHERY_ITERATION_MODE.GroupChildren)) {
        // Include referenced children of groups
        item.externalReferences.groupMembers.forEach((childIri) => {
          if (!scope[childIri]) {
            addPeripheryNote(childIri, { interpretation: INTERPRETATION.Node });
          }
        });
      }
      if (
        peripheryIterationModes.has(
          PERIPHERY_ITERATION_MODE.InheritedModelConcepts
        )
      ) {
        // Include referenced model concepts
        item.inheritsFrom.forEach((modelConceptIri) => {
          if (!scope[modelConceptIri]) {
            addPeripheryNote(modelConceptIri, {
              interpretation: item.interpretation,
            });
          }
        });
      }
    }
  });
  return periphery;
};
