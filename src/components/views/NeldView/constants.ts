export const NODE_LINK_CONSTANTS = {
  EDGE_WIDTH: 16,
  NODE_SIZE: 24,
  PROXY_SIZE: 36,
  GROUP_BASE_GAP: 20,
  GROUP_OVERLAP_GAP: 10,
  PARALLEL_ARC_OFFSET: 1.5,
} as const;

const nodeRadius = NODE_LINK_CONSTANTS.NODE_SIZE / 2;
export const GENERIC_ITEM_PATH = `M-${nodeRadius},0L0,-${nodeRadius}L${nodeRadius},0L0,${nodeRadius}Z`;

export enum PIN_MODE {
  None = 'None',
  Selected = 'Selected',
  Unselected = 'Unselected',
  // manual = "Manual",
}

export const PIN_MODE_LABELS: Record<PIN_MODE, string> = {
  None: 'Move all nodes',
  Selected: 'Only move unselected',
  Unselected: 'Only move selected',
} as const;

// Note: these should correspond to SVG files in static/img!
export enum POINTER_MODE {
  Move = 'Move',
  Select = 'Select',
  AddNodes = 'AddNodes',
  AddLinks = 'AddLinks',
}

export const POINTER_MODE_LABELS: Record<POINTER_MODE, string> = {
  Move: 'Move',
  Select: 'Select',
  AddNodes: 'Add nodes',
  AddLinks: 'Add links',
} as const;

export const POINTER_MODE_KEYBOARD_MODIFIERS: Partial<
  Record<POINTER_MODE, string>
> = {
  Select: 'Shift',
  AddNodes: 'Control',
  AddLinks: 'Alt',
};

export type Point = {
  x: number;
  y: number;
};
