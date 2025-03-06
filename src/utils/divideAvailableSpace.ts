import { Point } from 'components/Neld/constants';
import {
    Threshold,
    UI_SIZE_TYPE,
    categorizeViewDimension,
} from './useSizeThresholds';

export enum SPACE_ORIENTATION {
  row = 'row',
  column = 'column',
}

export enum SPACE_LAYOUT {
  flex = 'flex',
  grid = 'grid',
}

export type SpaceDivision = {
  orientation: SPACE_ORIENTATION;
  visibleViewIds: string[];
  hiddenViewIds: string[];
} & (
  | {
      layout: SPACE_LAYOUT.flex;
      parentStyle: undefined;
      styleByViewId: undefined;
    }
  | {
      layout: SPACE_LAYOUT.grid;
      parentStyle: string;
      styleByViewId: Record<string, string>;
    }
);

export const divideAvailableSpace = ({
  bounds,
  thresholds,
  viewIdPriorityOrder,
}: {
  bounds: DOMRectReadOnly;
  thresholds: Record<Threshold, number>;
  // preferredViewOrientationById: Record<string, VIEW_ORIENTATION>;
  viewIdPriorityOrder: string[];
}): SpaceDivision => {
  if (viewIdPriorityOrder.length === 0) {
    return {
      layout: SPACE_LAYOUT.flex,
      orientation: SPACE_ORIENTATION.row,
      visibleViewIds: [],
      hiddenViewIds: [],
      parentStyle: undefined,
      styleByViewId: undefined,
    };
  }
  // The general rectangle packing problem is NP-hard:
  // https://en.wikipedia.org/wiki/Rectangle_packing#Packing_different_rectangles_in_a_given_rectangle

  // TODO: There might be a cooler way to do this via treemap-esque algorithms;
  // we currently ignore preferredViewOrientationById, and could afford to
  // wiggle a bit instead of enforcing rigid CSS Grid lines

  // For now, we're just doing something simpler, capping the total number
  // of views based on minViewSize
  const gridOrientation =
    bounds.width >= bounds.height
      ? SPACE_ORIENTATION.row
      : SPACE_ORIENTATION.column;
  // Determine minViewSize; if this is a big screen, min sub-view size should
  // be at least small. Otherwise, sub-views should be at least tiny.
  const overallUiSpace = categorizeViewDimension({
    size:
      gridOrientation === SPACE_ORIENTATION.row ? bounds.width : bounds.height,
    thresholds,
  });
  const minViewSize =
    overallUiSpace === UI_SIZE_TYPE.Large ||
    overallUiSpace === UI_SIZE_TYPE.Huge
      ? thresholds.SmallViewThreshold
      : thresholds.TinyViewThreshold;
  const countPotentialViews = (space: number) =>
    Math.max(1, Math.floor(space / minViewSize));
  let nRows = countPotentialViews(bounds.height);
  let nCols = countPotentialViews(bounds.width);

  // grid uses 0-based indexing
  const grid = viewIdPriorityOrder.slice(0, nRows * nCols);
  const visibleViewIds = grid.concat();
  const hiddenViewIds = viewIdPriorityOrder.slice(nRows * nCols);
  // When gridOrientation is row:
  // row = Math.floor(index / nCols), col = index - row * nCols
  // When gridOrientation is column:
  // col = Math.floor(index / nRows), row = index - col * nRows

  if (viewIdPriorityOrder.length < nRows * nCols) {
    if (gridOrientation === SPACE_ORIENTATION.row) {
      // Rescale based on minimum row height
      nRows = countPotentialViews(bounds.height);
      nCols = Math.ceil(viewIdPriorityOrder.length / nRows);
      // Assign extra cells to the first high-priorty views,
      // stretching them vertically
      const extraCellCount = nRows * nCols - viewIdPriorityOrder.length;
      const extraCells = viewIdPriorityOrder.slice(0, extraCellCount);
      while (extraCells.length < extraCellCount) {
        // If we still haven't used up all the available space, give
        // what's left to the first view
        extraCells.unshift(viewIdPriorityOrder[0]);
      }
      grid.splice(nCols, 0, ...extraCells); // nCols is the first index of the second row
    } else if (gridOrientation === SPACE_ORIENTATION.column) {
      // Rescale based on minimum column width
      nCols = countPotentialViews(bounds.width);
      nRows = Math.ceil(viewIdPriorityOrder.length / nCols);
      // Assign extra cells to the first high-priorty views,
      // stretching them horizontally
      const extraCellCount = nRows * nCols - viewIdPriorityOrder.length;
      const extraCells = viewIdPriorityOrder.slice(0, extraCellCount);
      while (extraCells.length < extraCellCount) {
        // If we still haven't used up all the available space, give
        // what's left to the first view
        extraCells.unshift(viewIdPriorityOrder[0]);
      }
      grid.splice(nRows, 0, ...extraCells); // nRows is the first index of the second column
    }
  }

  if (
    (gridOrientation === SPACE_ORIENTATION.row && nRows === 1) ||
    (gridOrientation === SPACE_ORIENTATION.column && nCols === 1)
  ) {
    // With only one row / column, better to use flexbox
    return {
      layout: SPACE_LAYOUT.flex,
      orientation: gridOrientation,
      visibleViewIds,
      hiddenViewIds,
      parentStyle: undefined,
      styleByViewId: undefined,
    };
  }

  // compute CSS grid lines for each view
  const getCssGridLines = (viewId: string) =>
    grid
      .reduce((agg, id, index) => {
        if (id === viewId) {
          if (gridOrientation === SPACE_ORIENTATION.row) {
            const row = Math.floor(index / nCols);
            return [...agg, { x: index - row * nCols, y: row }];
          }
          const col = Math.floor(index / nRows);
          return [...agg, { x: col, y: index - col * nRows }];
        }
        return agg;
      }, [] as Point[])
      .reduce(
        (agg, { x, y }) => ({
          top: Math.min(y + 1, agg.top), // 1-based indexing
          right: Math.max(x + 2, agg.right), // 1-based indexing, spanning the cell
          bottom: Math.max(y + 2, agg.bottom), // 1-based indexing, spanning the cell
          left: Math.min(x + 1, agg.left), // 1-based indexing
        }),
        { top: Infinity, right: -Infinity, bottom: -Infinity, left: Infinity }
      );

  return {
    layout: SPACE_LAYOUT.grid,
    orientation: gridOrientation,
    visibleViewIds,
    hiddenViewIds,
    parentStyle: `\
grid-template-columns: repeat(${nCols}, 1fr);\
grid-template-rows: repeat(${nRows}, 1fr);`,
    styleByViewId: Object.fromEntries(
      viewIdPriorityOrder.map((viewId) => {
        const gridLines = getCssGridLines(viewId);
        return [
          viewId,
          `\
grid-column: ${gridLines.left} / ${gridLines.right};\
grid-row: ${gridLines.top} / ${gridLines.bottom}`,
        ];
      })
    ),
  };
};
