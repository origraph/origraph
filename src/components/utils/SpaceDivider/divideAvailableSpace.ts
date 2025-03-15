import { CSSProperties } from 'react';
import { Point, Rectangle } from '../../../constants/ui';
import {
  categorizeViewDimension,
  Threshold,
  UI_SIZE_TYPE,
} from '../../../utils/ui/useSizeThresholds';

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
  visibleViewIris: string[];
  hiddenViewIris: string[];
  parentStyle: CSSProperties;
} & (
  | {
      layout: SPACE_LAYOUT.flex;
      rectanglesByViewIri: undefined;
      stylesByViewIri: undefined;
    }
  | {
      layout: SPACE_LAYOUT.grid;
      rectanglesByViewIri: Record<string, Rectangle>;
      stylesByViewIri: Record<string, CSSProperties>;
    }
);

export const divideAvailableSpace = ({
  bounds,
  thresholds,
  viewIriPriorityOrder,
}: {
  bounds: DOMRectReadOnly;
  thresholds: Record<Threshold, number>;
  // preferredViewOrientationById: Record<string, VIEW_ORIENTATION>;
  viewIriPriorityOrder: string[];
}): SpaceDivision => {
  if (viewIriPriorityOrder.length === 0) {
    return {
      layout: SPACE_LAYOUT.flex,
      orientation: SPACE_ORIENTATION.row,
      visibleViewIris: [],
      hiddenViewIris: [],
      parentStyle: {
        display: 'flex',
      },
      rectanglesByViewIri: undefined,
      stylesByViewIri: undefined,
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
  const grid = viewIriPriorityOrder.slice(0, nRows * nCols);
  const visibleViewIris = grid.concat();
  const hiddenViewIris = viewIriPriorityOrder.slice(nRows * nCols);
  // When gridOrientation is row:
  // row = Math.floor(index / nCols), col = index - row * nCols
  // When gridOrientation is column:
  // col = Math.floor(index / nRows), row = index - col * nRows

  if (viewIriPriorityOrder.length < nRows * nCols) {
    if (gridOrientation === SPACE_ORIENTATION.row) {
      // Rescale based on minimum row height
      nRows = countPotentialViews(bounds.height);
      nCols = Math.ceil(viewIriPriorityOrder.length / nRows);
      // Assign extra cells to the first high-priorty views,
      // stretching them vertically
      const extraCellCount = nRows * nCols - viewIriPriorityOrder.length;
      const extraCells = viewIriPriorityOrder.slice(0, extraCellCount);
      while (extraCells.length < extraCellCount) {
        // If we still haven't used up all the available space, give
        // what's left to the first view
        extraCells.unshift(viewIriPriorityOrder[0]);
      }
      grid.splice(nCols, 0, ...extraCells); // nCols is the first index of the second row
    } else if (gridOrientation === SPACE_ORIENTATION.column) {
      // Rescale based on minimum column width
      nCols = countPotentialViews(bounds.width);
      nRows = Math.ceil(viewIriPriorityOrder.length / nCols);
      // Assign extra cells to the first high-priorty views,
      // stretching them horizontally
      const extraCellCount = nRows * nCols - viewIriPriorityOrder.length;
      const extraCells = viewIriPriorityOrder.slice(0, extraCellCount);
      while (extraCells.length < extraCellCount) {
        // If we still haven't used up all the available space, give
        // what's left to the first view
        extraCells.unshift(viewIriPriorityOrder[0]);
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
      visibleViewIris: visibleViewIris,
      hiddenViewIris: hiddenViewIris,
      parentStyle: {
        display: 'flex',
        flexDirection:
          gridOrientation === SPACE_ORIENTATION.column ? 'column' : 'row',
      },
      stylesByViewIri: undefined,
      rectanglesByViewIri: undefined,
    };
  }

  // compute outline for each view
  const getRectangleForView = (viewIri: string) =>
    grid
      .reduce((agg, id, index) => {
        if (id === viewIri) {
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
          top: Math.min(y, agg.top),
          right: Math.max(x + 1, agg.right), // spanning the cell
          bottom: Math.max(y + 1, agg.bottom), // spanning the cell
          left: Math.min(x, agg.left),
        }),
        { top: Infinity, right: -Infinity, bottom: -Infinity, left: Infinity }
      );

  const styleByViewIri: Record<string, CSSProperties> = {};
  const rectanglesByViewIri: Record<string, Rectangle> = {};

  viewIriPriorityOrder.forEach((viewIri) => {
    const rectangle = getRectangleForView(viewIri);
    rectanglesByViewIri[viewIri] = rectangle;
    // 1-based indexing for CSS grid
    styleByViewIri[viewIri] = {
      gridColumn: `${rectangle.left + 1} / ${rectangle.right + 1}`,
      gridRow: `${rectangle.top + 1} / ${rectangle.bottom + 1}`,
    };
  });

  return {
    layout: SPACE_LAYOUT.grid,
    orientation: gridOrientation,
    visibleViewIris: visibleViewIris,
    hiddenViewIris: hiddenViewIris,
    parentStyle: {
      display: 'grid',
      gridTemplateColumns: `repeat(${nCols}, 1fr)`,
      gridTemplateRows: `repeat(${nRows}, 1fr)`,
    },
    stylesByViewIri: styleByViewIri,
    rectanglesByViewIri: rectanglesByViewIri,
  };
};
