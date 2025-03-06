import classNames from 'classnames';
import { Icon } from 'components/basic-ui/Icon';
import { CREATE_MISSING_MODE } from 'constants/graphCache';
import { INTERPRETATION } from 'constants/semantic';
import isEqual from 'lodash.isequal';
import { InstanceEditorContext } from 'pages/InstanceEditor';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { tinykeys } from 'tinykeys';
import { useImmer } from 'use-immer';
import { drawPointyArc } from 'utils';
import { drawSqueezedLink } from 'utils/drawSqeezedLink';
import { getInstanceEditorVisibleItem } from 'utils/getInstanceEditorVisibleItem';
import { useDeviceInfo } from 'utils/useDeviceInfo';
import { useDidValueChange } from 'utils/useDidValueChange';
import { useIsMounted } from 'utils/useIsMounted';
import usePrevious from 'utils/usePrevious';
import { useViewBounds } from 'utils/useViewBounds';
import {
  GENERIC_ITEM_PATH,
  NODE_LINK_CONSTANTS,
  Point,
  POINTER_MODE,
  POINTER_MODE_KEYBOARD_MODIFIERS,
} from './constants';
import { D3ForceLayout } from './layouts/D3ForceLayout';
import { NeldGraph, NeldGroup } from './NeldGraph';
import { NeldMenu } from './NeldMenu';
import {
  DEFAULT_NODE_LINK_SETTINGS,
  LAYOUT_NAME,
  LayoutUpdate,
  MidLayoutGraphChanges,
  NeldSettings,
} from './NeldPositionGenerator';

export const initLayout = (label: LAYOUT_NAME) => {
  switch (label) {
    case LAYOUT_NAME.D3ForceLayout:
      return new D3ForceLayout();
    default:
      throw new Error(`Unknown layout: ${label}`);
  }
};

const simulateMouseForTouch = (event: TouchEvent) => {
  const touch = event.changedTouches[0]; // Unsure if I might still need: event.originalEvent?.touches[0] || ;
  event.preventDefault();
  return {
    x: touch.pageX,
    y: touch.pageY,
  };
};

export const Neld = () => {
  const wrapperRef = useRef<null | HTMLDivElement>(null);

  const {
    selectedIris,
    setSelectedIris,
    visibleItems,
    dbProxy,
    expandedGroups,
  } = useContext(InstanceEditorContext);

  const [settings, setSettings] = useState<NeldSettings>(
    DEFAULT_NODE_LINK_SETTINGS
  );

  const isMounted = useIsMounted();
  const { hasFinePointer, hasCoarsePointer } = useDeviceInfo();

  const { bounds, boundsChanged, boundsInitialized } =
    useViewBounds(wrapperRef);

  const [percentDone, setPercentDone] = useState(0);
  const [layoutShouldRestart, setLayoutShouldRestart] = useState(true);
  const [initialLayoutComplete, setInitialLayoutComplete] = useState(false);
  const [rubberBandPosition, setRubberBandPosition] = useState<null | Point>(
    null
  );
  const [keyboardModeStack, setKeyboardModeStack] = useState<POINTER_MODE[]>(
    []
  );
  const [dragOrigin, setDragOrigin] = useState<null | Point>(null);
  const [pointerItemIri, setPointerItemIri] = useState<string | null>(null);
  const isDraggingItem = useMemo(
    () => !rubberBandPosition && dragOrigin !== null && selectedIris.length > 0,
    [rubberBandPosition, dragOrigin, selectedIris.length]
  );
  const isRubberBanding = useMemo(
    () => rubberBandPosition && dragOrigin !== null,
    [dragOrigin, rubberBandPosition]
  );

  const currentLayout = useMemo(
    () => initLayout(settings.currentLayout),
    [settings.currentLayout]
  );

  const [localGraph, setLocalGraph] = useImmer<NeldGraph>(() =>
    NeldGraph.initFromVisibleItems({
      visibleItems,
      layout: currentLayout,
      bounds,
    })
  );
  const layoutNeedsUpdatedLocalGraph = useDidValueChange<NeldGraph>({
    value: localGraph,
    isEqual: (a, b) => a.isEqualForLayout(b),
  });

  const previousItemIris = usePrevious(visibleItems.scopeLookupByIri);
  useEffect(() => {
    if (isEqual(previousItemIris, visibleItems.scopeLookupByIri)) {
      return;
    }

    // Fully re-initialize the local graph (copying over layout info)
    setLocalGraph(() =>
      NeldGraph.initFromVisibleItems({
        visibleItems,
        layout: currentLayout,
        bounds,
        priorGraph: localGraph,
      })
    );
  }, [
    bounds,
    currentLayout,
    localGraph,
    previousItemIris,
    setLocalGraph,
    visibleItems,
  ]);

  const { rubberBandedIris, rubberBandIsSubtractive } = useMemo(() => {
    if (!isRubberBanding) {
      return {
        rubberBandedIris: [],
        rubberBandIsSubtractive: false,
      };
    }
    const origin = dragOrigin as Point;
    const bandDelta = {
      x: origin.x - (rubberBandPosition as Point).x,
      y: origin.y - (rubberBandPosition as Point).y,
    };
    const squaredDeltasByPointIri: Record<string, number> = {};
    Object.entries(localGraph.nodesByIri).forEach(
      ([
        iri,
        {
          position: { x, y },
        },
      ]) => {
        const delta = { x: origin.x - x, y: origin.y - y };
        if (
          Math.sign(delta.x) === Math.sign(bandDelta.x) &&
          Math.sign(delta.y) === Math.sign(bandDelta.y) &&
          Math.abs(delta.x) <=
            Math.abs(bandDelta.x) - NODE_LINK_CONSTANTS.NODE_SIZE / 2 &&
          Math.abs(delta.y) <=
            Math.abs(bandDelta.y) - NODE_LINK_CONSTANTS.NODE_SIZE / 2
        ) {
          // When selecting via rubber band, we want to sort by the distance from the dragged origin point
          squaredDeltasByPointIri[iri] = delta.x ** 2 + delta.y ** 2;
        }
      }
    );
    const rubberBandedIris = Object.keys(squaredDeltasByPointIri).sort(
      (a, b) => squaredDeltasByPointIri[a] - squaredDeltasByPointIri[b]
    );
    const rubberBandIsSubtractive =
      (settings.pointerMode === POINTER_MODE.Select &&
        rubberBandedIris.every((iri) => selectedIris.includes(iri))) ||
      (settings.pointerMode !== POINTER_MODE.Select &&
        rubberBandedIris.length === 0);
    return {
      rubberBandedIris,
      rubberBandIsSubtractive,
    };
  }, [
    dragOrigin,
    isRubberBanding,
    localGraph.nodesByIri,
    rubberBandPosition,
    selectedIris,
    settings.pointerMode,
  ]);

  const pointerHelp = useMemo(() => {
    let verb =
      hasFinePointer && hasCoarsePointer
        ? `Click / tap`
        : hasCoarsePointer
        ? 'Tap'
        : 'Click';
    let instructions;
    if (settings.pointerMode === POINTER_MODE.AddNodes) {
      instructions = ' the background to create a node';
    } else if (settings.pointerMode === POINTER_MODE.AddLinks) {
      if (selectedIris.length === 0) {
        instructions = ' a node to start a link';
      } else if (selectedIris.length === 1 && !isRubberBanding) {
        instructions = ' a node to complete a link';
      } else {
        instructions =
          "... something. Easter Egg Discovered! Let us know what behavior (cross-product? create a chain in selection order?) you'd like to see!";
      }
    } else if (isRubberBanding) {
      verb = '';
      if (rubberBandedIris.length === 0) {
        instructions = 'Drag to select multiple items';
      } else if (rubberBandIsSubtractive) {
        instructions = 'Release to deselect';
      } else {
        instructions = 'Release to select';
      }
    } else if (settings.pointerMode === POINTER_MODE.Select) {
      instructions = ' to toggle whether an item is selected';
    } else if (selectedIris.length === 0) {
      instructions = ' a node or link to select';
    } else {
      verb = '';
      instructions =
        'Drag selected items to move them; click the background to deselect';
    }
    return (
      <>
        <Icon src={`../static/img/${settings.pointerMode}.svg`} />
        <div>
          {verb}
          {instructions}
        </div>
      </>
    );
  }, [
    hasFinePointer,
    hasCoarsePointer,
    settings.pointerMode,
    isRubberBanding,
    selectedIris.length,
    rubberBandedIris.length,
    rubberBandIsSubtractive,
  ]);

  const onTick = useCallback(
    ({ positionsByIri, percentDone }: LayoutUpdate) => {
      setPercentDone(percentDone);
      setLocalGraph((draft) => {
        Object.entries(positionsByIri).forEach(([iri, position]) => {
          if (draft.nodesByIri[iri]) {
            draft.nodesByIri[iri].position = position;
          }
        });
        // Link offsets should be fine after position changes, but we need to recompute minimum spanning trees
        draft.updateGroups();
      });
    },
    [setLocalGraph]
  );

  useEffect(() => {
    if (boundsInitialized && !localGraph.isEmpty() && layoutShouldRestart) {
      // Initial layout, or layout has been restarted
      setLayoutShouldRestart(false);
      // Stop the layout (if it's running) and restart it
      currentLayout.stopLayout().then(() => {
        // TODO: if I ever want to save the final layout result, runLayout
        // returns the last tick
        currentLayout
          .runLayout({
            currentGraph: localGraph,
            onTick,
            bounds,
          })
          .then(() => {
            setInitialLayoutComplete(true);
          });
      });
    } else {
      // Don't restart the current layout if any of the dependencies change,
      // but update its information, whether or not it's running
      const update: MidLayoutGraphChanges = {};
      if (bounds && boundsChanged) {
        update.bounds = bounds;
      }
      if (layoutNeedsUpdatedLocalGraph) {
        update.currentGraph = localGraph;
      }
      currentLayout.update(update);
    }
  }, [
    bounds,
    layoutShouldRestart,
    setLayoutShouldRestart,
    currentLayout,
    localGraph,
    onTick,
    boundsChanged,
    layoutNeedsUpdatedLocalGraph,
    boundsInitialized,
  ]);

  useEffect(() => {
    if (
      settings.autoLayoutIsEnabled &&
      initialLayoutComplete &&
      (boundsChanged || layoutNeedsUpdatedLocalGraph) &&
      !localGraph.isEmpty() &&
      boundsInitialized
    ) {
      // Auto-layout should only happen in response to bounds changing after
      // initialization, or the graph having new data, after the initial layout
      // has already completed TODO: probably need to get even more
      // sophisticated beyond layoutNeedsUpdatedLocalGraph (which we shouldn't
      // change for mid-layout updates); that will be true when new stuff has
      // been added, but for this effect, we probably 1. DON'T want to be
      // shaking things around after the user has added stuff directly to the
      // canvas, but 2. we DO want to move stuff to sensible locations when
      // things have been added via BaseballCard menus
      setLayoutShouldRestart(true);
    }
  }, [
    boundsChanged,
    boundsInitialized,
    currentLayout.isRunning,
    initialLayoutComplete,
    layoutNeedsUpdatedLocalGraph,
    localGraph,
    settings.autoLayoutIsEnabled,
  ]);

  const updatePointerModeFromKeyboard = useCallback(
    ({
      modeStack,
      resetMode,
    }:
      | {
          modeStack?: POINTER_MODE[];
          resetMode?: never;
        }
      | {
          modeStack?: never;
          resetMode?: POINTER_MODE;
        }) => {
      if (!isDraggingItem && !isRubberBanding) {
        const pointerMode =
          (modeStack || keyboardModeStack)[0] || POINTER_MODE.Move;
        setSettings({
          ...settings,
          pointerMode,
        });
      } else if (resetMode) {
        setSettings({
          ...settings,
          pointerMode: resetMode,
        });
      }
    },
    [isDraggingItem, isRubberBanding, keyboardModeStack, setSettings, settings]
  );
  const toggleKeyboardPointerMode = useCallback(
    (newMode: POINTER_MODE, isPressed: boolean) => {
      let modeStack = keyboardModeStack;
      if (!isPressed) {
        modeStack = keyboardModeStack.filter((mode) => mode !== newMode);
      } else if (!keyboardModeStack.includes(newMode)) {
        modeStack = keyboardModeStack.concat([newMode]);
      }
      setKeyboardModeStack(modeStack);
      updatePointerModeFromKeyboard({ modeStack });
    },
    [keyboardModeStack, setKeyboardModeStack, updatePointerModeFromKeyboard]
  );

  useEffect(() => {
    const unsubscribeKeydown = tinykeys(
      window,
      Object.fromEntries(
        Object.entries(POINTER_MODE_KEYBOARD_MODIFIERS).map(([mode, key]) => [
          key,
          () => toggleKeyboardPointerMode(mode as POINTER_MODE, true),
        ])
      ),
      { event: 'keydown' }
    );
    const unsubscribeKeyup = tinykeys(
      window,
      Object.fromEntries(
        Object.entries(POINTER_MODE_KEYBOARD_MODIFIERS).map(([mode, key]) => [
          key,
          () => toggleKeyboardPointerMode(mode as POINTER_MODE, false),
        ])
      ),
      { event: 'keyup' }
    );
    return () => {
      unsubscribeKeydown();
      unsubscribeKeyup();
    };
  }, [toggleKeyboardPointerMode]);

  useEffect(() => {
    if (isMounted) {
      const listener = () => {
        const modeStack: POINTER_MODE[] = [];
        setKeyboardModeStack(modeStack);
        updatePointerModeFromKeyboard({ modeStack });
      };
      window.addEventListener('blur', listener);
      return () => window.removeEventListener('blur', listener);
    }
  }, [isMounted, setKeyboardModeStack, updatePointerModeFromKeyboard]);

  const handleShapeMouseDown = useCallback(
    ({ iri, point }: { iri: string; point: Point }) => {
      if (isDraggingItem || isRubberBanding) {
        // Ignore additional touches for now
        return;
      }
      setPointerItemIri(iri);
      setRubberBandPosition(null);
      if (settings.pointerMode === POINTER_MODE.Select) {
        // Toggle the clicked iri
        if (selectedIris.includes(iri)) {
          setSelectedIris(selectedIris.filter((otherIri) => otherIri !== iri));
        } else {
          setSelectedIris(selectedIris.concat([iri]));
        }
        // Don't drag or mess with the layout when clicking items in selection mode
        setDragOrigin(null);
        return;
      }
      if (settings.pointerMode === POINTER_MODE.AddLinks) {
        if (selectedIris.length === 0) {
          dbProxy.connect({
            links: [
              {
                sourceIri: iri,
                namedGraph: dbProxy.currentNamedGraphs.Instance,
              },
            ],
            missingMode: CREATE_MISSING_MODE.Ignore,
          });
        } else if (selectedIris.length === 1) {
          const linkIri = selectedIris[0];
          console.log(
            `TODO: find the link that we started before... or if ${linkIri} is a node, create a new one`
          );
        }
        // Don't drag when clicking items in addLinks mode
        setDragOrigin(null);
      } else {
        // In all other cases, (addNodes and addLinks-minus-a-selection default
        // to move mode when clicking an item), only change the selection if the
        // clicked id is not already selected
        if (!selectedIris.includes(iri)) {
          setSelectedIris([iri]);
        }
        setDragOrigin({
          x: point.x - bounds.left,
          y: point.y - bounds.top,
        });
      }
      currentLayout.stopLayout();
    },
    [
      isDraggingItem,
      isRubberBanding,
      settings.pointerMode,
      currentLayout,
      selectedIris,
      setSelectedIris,
      dbProxy,
      bounds.left,
      bounds.top,
    ]
  );

  const handleBackgroundMouseDown = useCallback(
    ({ point: rawPoint }: { point: Point }) => {
      if (isDraggingItem || isRubberBanding || pointerItemIri) {
        // Ignore additional touches for now, and ignore bubbled events
        // already handled by handleShapeMouseDown
        return;
      }
      const point = {
        x: rawPoint.x - bounds.left,
        y: rawPoint.y - bounds.top,
      };
      if (settings.pointerMode === POINTER_MODE.AddNodes) {
        dbProxy
          .createNodes({
            nodes: [
              {
                namedGraph: dbProxy.currentNamedGraphs.Instance,
              },
            ],
          })
          .then((txnResult) => {
            setLocalGraph((draft) => {
              txnResult.createdItems.forEach(({ iri }) => {
                draft.setNodePosition({ iri, position: point });
              });
            });
          });
        // TODO: maybe some weirdness with timing... in theory, should
        // setDragOrigin if the mouse is still down? Wait to do thse
        // after addNode() is finished and selected?
        setDragOrigin(null);
        setRubberBandPosition(null);
      } else {
        setRubberBandPosition(point);
        setDragOrigin(point);
      }
      currentLayout.stopLayout();
    },
    [
      bounds.left,
      bounds.top,
      currentLayout,
      dbProxy,
      isDraggingItem,
      isRubberBanding,
      pointerItemIri,
      setLocalGraph,
      settings.pointerMode,
    ]
  );

  const handleDrag = useCallback(
    ({ point }: { point: Point }) => {
      if (isRubberBanding) {
        setRubberBandPosition({
          x: point.x - bounds.left,
          y: point.y - bounds.top,
        });
      } else if (isDraggingItem) {
        const offset = {
          x: point.x - bounds.left - (dragOrigin?.x || 0),
          y: point.y - bounds.top - (dragOrigin?.y || 0),
        };
        const newPositionsByIri: Record<string, Point> = {};
        const fixPosition = (iri: string) => {
          newPositionsByIri[iri] = {
            x: localGraph.nodesByIri[iri].position.x + offset.x,
            y: localGraph.nodesByIri[iri].position.y + offset.y,
          };
        };

        selectedIris.forEach((iri) => {
          const link = localGraph.linksByIri[iri];
          if (link) {
            fixPosition(link.sourceIri);
            fixPosition(link.targetIri);
          } else {
            const group = localGraph.groupsByIri[iri];
            if (group) {
              group.groupMembers.forEach((iri) => fixPosition(iri));
            } else {
              const node = localGraph.nodesByIri[iri];
              if (node) {
                fixPosition(node.iri);
              }
            }
          }
        });
        setLocalGraph((draft) => {
          Object.entries(newPositionsByIri).forEach(([iri, fixedPosition]) => {
            draft.nodesByIri[iri].fixedPosition = fixedPosition;
          });
          // Need to recompute minimum spanning trees as nodes get dragged around
          draft.updateGroups();
        });
      }
    },
    [
      isRubberBanding,
      isDraggingItem,
      bounds.left,
      bounds.top,
      dragOrigin?.x,
      dragOrigin?.y,
      selectedIris,
      setLocalGraph,
      localGraph.nodesByIri,
      localGraph.linksByIri,
      localGraph.groupsByIri,
    ]
  );

  const handleMouseUp = useCallback(() => {
    setPointerItemIri(null);
    if (isDraggingItem) {
      setLocalGraph((draft) => {
        Object.values(draft.nodesByIri).forEach((draftNode) => {
          if (draftNode.fixedPosition) {
            draftNode.position = draftNode.fixedPosition;
            draftNode.fixedPosition = undefined;
          }
        });
      });
      setDragOrigin(null);
      // TODO: maybe need another option, beyond just "auto layout," to enable
      // auto-cleanup of nearby nodes when something has been dragged; although
      // calling setLayoutShouldRestart(true) here kinda works, it's a bit too
      // heavy-handed / widespread an effect. Might even be cool to have a
      // number setting, i.e. "auto-layout up to N hops away," or inverse-square
      // setting that moves nearby nodes a lot, but farther ones less ("near"
      // could mean both network topology, as well as physically near things on
      // screen)
    } else if (isRubberBanding) {
      if (settings.pointerMode === POINTER_MODE.AddLinks) {
        if (selectedIris.length > 1) {
          console.warn(`TODO: unknown what to do here...`);
        } else if (rubberBandedIris.length > 0) {
          // Create new link(s) to each of the rubberbanded targets
          dbProxy.connect({
            links: rubberBandedIris.map((targetIri) => ({
              namedGraph: dbProxy.currentNamedGraphs.Instance,
              targetIri,
              sourceIri: selectedIris[0],
            })),
            missingMode: CREATE_MISSING_MODE.Ignore,
          });
        } else {
          // Nothing rubber-banded, create a link to a ghost node
          dbProxy.connect({
            links: [
              {
                namedGraph: dbProxy.currentNamedGraphs.Instance,
                sourceIri: selectedIris[0],
              },
            ],
            missingMode: CREATE_MISSING_MODE.Ignore,
          });
        }
      } else if (settings.pointerMode === POINTER_MODE.Select) {
        if (rubberBandIsSubtractive) {
          setSelectedIris(
            selectedIris.filter((iri) => rubberBandedIris.includes(iri))
          );
        } else {
          setSelectedIris(selectedIris.concat(rubberBandedIris));
        }
      } else {
        setSelectedIris(rubberBandedIris);
      }
      setRubberBandPosition(null);
      setDragOrigin(null);
      updatePointerModeFromKeyboard({ resetMode: POINTER_MODE.Move });
    }
  }, [
    isDraggingItem,
    isRubberBanding,
    setLocalGraph,
    settings.pointerMode,
    updatePointerModeFromKeyboard,
    selectedIris,
    rubberBandedIris,
    dbProxy,
    rubberBandIsSubtractive,
    setSelectedIris,
  ]);

  const { renderedLinks, renderedNodes, renderedGroups } = useMemo(() => {
    const renderedLinks = Object.values(localGraph.linksByIri)
      .map((link) => {
        const source = localGraph.nodesByIri[link.sourceIri];
        const target = localGraph.nodesByIri[link.targetIri];
        if (
          !link.isInitialized ||
          !source ||
          !target ||
          !source.isInitialized ||
          !target.isInitialized
        ) {
          return null;
        }
        const additiveRubberBanded =
          !rubberBandIsSubtractive &&
          rubberBandedIris.includes(link.iri) &&
          !selectedIris.includes(link.iri);
        const subtractiveRubberBanded =
          rubberBandIsSubtractive &&
          rubberBandedIris.includes(link.iri) &&
          selectedIris.includes(link.iri);
        return (
          <g
            key={link.iri}
            class={classNames('link', {
              selected:
                !subtractiveRubberBanded && selectedIris.includes(link.iri),
              additiveRubberBanded,
              subtractiveRubberBanded,
            })}
            onMouseDown={(event) =>
              handleShapeMouseDown({
                iri: link.iri,
                point: { x: event.x, y: event.y },
              })
            }
            onTouchStart={(event) =>
              handleShapeMouseDown({
                iri: link.iri,
                point: simulateMouseForTouch(event),
              })
            }
          >
            <path
              d={drawPointyArc({
                source: source.currentPosition,
                target: target.currentPosition,
                offset: link.offset,
              })}
            />
          </g>
        );
      })
      .filter(Boolean);
    const renderedNodes = Object.values(localGraph.nodesByIri)
      .map((node) => {
        if (!node.isInitialized) {
          return null;
        }
        const item = getInstanceEditorVisibleItem({
          iri: node.iri,
          visibleItems,
          includeProxy: true,
        });
        const { x, y } = node.currentPosition;
        const additiveRubberBanded =
          !rubberBandIsSubtractive &&
          rubberBandedIris.includes(node.iri) &&
          !selectedIris.includes(node.iri);
        const subtractiveRubberBanded =
          rubberBandIsSubtractive &&
          rubberBandedIris.includes(node.iri) &&
          selectedIris.includes(node.iri);
        const isProxy = Boolean(visibleItems.proxies[node.iri]);
        const isEmptyProxy = isProxy && item?.proxyFor.size === 0;
        const proxyIntersectionCount = isProxy
          ? Math.min(3, visibleItems.visiblePathsFromRoot[node.iri].length)
          : null;
        const proxyTopGroup = isProxy
          ? localGraph.topGroupByNodeIri[node.iri]
          : null;
        const glyph = isEmptyProxy ? null : isProxy ? (
          <Icon
            class="glyph"
            src={`../static/img/Proxy${proxyIntersectionCount}.svg`}
            embedInSvg={{
              size: NODE_LINK_CONSTANTS.PROXY_SIZE,
              mask: `../static/img/ProxyMask.svg`,
              wrapperClass: classNames({
                topContainingGroupIsCollapsed:
                  proxyTopGroup && !expandedGroups.has(proxyTopGroup),
              }),
            }}
          />
        ) : item?.interpretation === INTERPRETATION.Node ? (
          <circle class="glyph" r={NODE_LINK_CONSTANTS.NODE_SIZE / 2} />
        ) : item?.interpretation === INTERPRETATION.Hyperedge ? (
          <circle class="glyph" r={NODE_LINK_CONSTANTS.EDGE_WIDTH / 2} />
        ) : (
          <path class="glyph" d={GENERIC_ITEM_PATH} />
        );
        return (
          <g
            key={node.iri}
            class={classNames('node', node.scopeLookup, item?.ghostType, {
              selected:
                !subtractiveRubberBanded && selectedIris.includes(node.iri),
              additiveRubberBanded,
              subtractiveRubberBanded,
            })}
            transform={`translate(${x},${y})`}
            onMouseDown={(event) =>
              handleShapeMouseDown({
                iri: node.iri,
                point: { x: event.x, y: event.y },
              })
            }
            onTouchStart={(event) =>
              handleShapeMouseDown({
                iri: node.iri,
                point: simulateMouseForTouch(event),
              })
            }
          >
            {glyph}
          </g>
        );
      })
      .filter(Boolean);
    const getCenterAndRadius = (group: NeldGroup, nodeIri: string) => {
      const isProxy = Boolean(visibleItems.proxies[nodeIri]);
      return {
        center: localGraph.nodesByIri[nodeIri].currentPosition,
        radius:
          NODE_LINK_CONSTANTS.GROUP_BASE_GAP +
          (group._coreProps?.offsetByNodeIri?.[nodeIri] || 0) *
            NODE_LINK_CONSTANTS.GROUP_OVERLAP_GAP +
          (isProxy
            ? NODE_LINK_CONSTANTS.PROXY_SIZE / 2
            : NODE_LINK_CONSTANTS.NODE_SIZE / 2),
      };
    };
    const renderedGroups = localGraph.groupOrder.map((groupIri) => {
      const group = localGraph.groupsByIri[groupIri];
      // Draw the circles with arcs, because we want to union them together in the same
      // path string as the MST links... but drawing circles with arcs is weirdly fraught
      // (borrowing this solution: https://stackoverflow.com/a/10477334)
      const groupOutlineChunks = Array.from(group.groupMembers)
        .map((iri) => getCenterAndRadius(group, iri))
        .map(
          ({ center, radius }) => `\
M${center.x + radius},${center.y}\
a${radius},${radius},0,1,0,${-radius * 2},0\
a${radius},${radius},0,1,0,${radius * 2},0`
        );
      group.mst.forEach((mstLink) => {
        const { center: source, radius: sourceRadius } = getCenterAndRadius(
          group,
          mstLink.sourceIri
        );
        const { center: target, radius: targetRadius } = getCenterAndRadius(
          group,
          mstLink.targetIri
        );

        // TODO: there are some odd bugs w.r.t. path unions with just circles,
        // but it seems to be a little better if we start with non-circles,
        // hence unshift() instead of push(). See: https://github.com/r-flash/PathBool.js/issues/4
        groupOutlineChunks.push(
          drawSqueezedLink({ source, target, sourceRadius, targetRadius })
        );
      });
      const paths = groupOutlineChunks.map((d, index) => (
        <path key={index} d={d} />
      ));
      return (
        <g
          key={group.iri}
          class={classNames('group', group.scopeLookup, {
            selected: selectedIris.includes(group.iri),
            collapsed: !expandedGroups.has(group.iri),
          })}
          onMouseDown={(event) =>
            handleShapeMouseDown({
              iri: group.iri,
              point: { x: event.x, y: event.y },
            })
          }
          onTouchStart={(event) =>
            handleShapeMouseDown({
              iri: group.iri,
              point: simulateMouseForTouch(event),
            })
          }
        >
          {paths}
        </g>
      );
    });
    return { renderedLinks, renderedNodes, renderedGroups };
  }, [
    localGraph.linksByIri,
    localGraph.nodesByIri,
    localGraph.groupOrder,
    localGraph.topGroupByNodeIri,
    localGraph.groupsByIri,
    rubberBandIsSubtractive,
    rubberBandedIris,
    selectedIris,
    handleShapeMouseDown,
    visibleItems,
    expandedGroups,
  ]);

  return (
    <>
      <div class="Neld">
        {settings.showHelp ? <div class="helpText">{pointerHelp}</div> : null}
        <div
          class={classNames('svgWrapper', { rubberBanding: isRubberBanding })}
          ref={wrapperRef}
        >
          <svg
            width={bounds.width}
            height={bounds.height}
            onMouseDown={(event) =>
              handleBackgroundMouseDown({ point: { x: event.x, y: event.y } })
            }
            onTouchStart={(event) =>
              handleBackgroundMouseDown({ point: simulateMouseForTouch(event) })
            }
            onMouseMove={(event) =>
              handleDrag({ point: { x: event.x, y: event.y } })
            }
            onTouchMove={(event) =>
              handleDrag({ point: simulateMouseForTouch(event) })
            }
            onMouseUp={() => handleMouseUp()}
            onTouchEnd={() => handleMouseUp()}
            onMouseLeave={() => handleMouseUp()}
            // TODO: mouseleave touch equivalent? Also, this is kinda lazy;
            // should probably pan when dragging something to the edge
          >
            <rect
              class="background"
              x="0"
              y="0"
              width={bounds.width}
              height={bounds.height}
            />
            {isRubberBanding ? (
              <rect
                class="rubberBand"
                x={Math.min(dragOrigin?.x || 0, rubberBandPosition?.x || 0)}
                y={Math.min(dragOrigin?.y || 0, rubberBandPosition?.y || 0)}
                width={Math.abs(
                  (dragOrigin?.x || 0) - (rubberBandPosition?.x || 0)
                )}
                height={Math.abs(
                  (dragOrigin?.y || 0) - (rubberBandPosition?.y || 0)
                )}
              />
            ) : null}
            <g class="groups">{renderedGroups}</g>
            <g class="links">{renderedLinks}</g>
            <g class="nodes">{renderedNodes}</g>
          </svg>
        </div>
        <NeldMenu
          settings={settings}
          setSettings={setSettings}
          layoutIsRunning={currentLayout.isRunning}
          stopLayout={() => currentLayout.stopLayout()}
          restartLayout={() => setLayoutShouldRestart(true)}
        />
        <div
          class={classNames('progressBar', {
            running: currentLayout.isRunning,
          })}
        >
          <div class="bar" style={`width:${percentDone}%`} />
        </div>
      </div>
    </>
  );
};
