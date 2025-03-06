import { Point } from 'components/Neld/constants';

export const drawSqueezedLink = ({
  source,
  sourceRadius,
  target,
  targetRadius,
}: {
  source: Point;
  sourceRadius: number;
  target: Point;
  targetRadius: number;
}) => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  let theta; // Perpendicular angle, w.r.t. the straight line between source and target
  let sourceEdgePoint; // Local vector, pointing perpendicularly from the center of the source circle to its edge
  let targetEdgePoint; // Local vector, pointing perpendicularly from the center of the target circle to its edge

  if (dx === 0) {
    theta = dy >= 0 ? Math.PI : -Math.PI;
    sourceEdgePoint = {
      x: 0,
      y: sourceRadius,
    };
    targetEdgePoint = {
      x: 0,
      y: targetRadius,
    };
  } else {
    theta = Math.atan(dy / dx) + Math.PI / 2;
    sourceEdgePoint = {
      x: sourceRadius * Math.cos(theta),
      y: sourceRadius * Math.sin(theta),
    };
    targetEdgePoint = {
      x: targetRadius * Math.cos(theta),
      y: targetRadius * Math.sin(theta),
    };
  }
  const source1 = {
    x: source.x + sourceEdgePoint.x,
    y: source.y + sourceEdgePoint.y,
  };
  const source2 = {
    x: source.x - sourceEdgePoint.x,
    y: source.y - sourceEdgePoint.y,
  };
  const target1 = {
    x: target.x + targetEdgePoint.x,
    y: target.y + targetEdgePoint.y,
  };
  const target2 = {
    x: target.x - targetEdgePoint.x,
    y: target.y - targetEdgePoint.y,
  };
  const arcCenter = {
    x: (source.x + target.x) / 2,
    y: (source.y + target.y) / 2,
  };
  if (
    isNaN(source1.x) ||
    isNaN(source1.y) ||
    isNaN(source2.x) ||
    isNaN(source2.y) ||
    isNaN(target1.x) ||
    isNaN(target1.y) ||
    isNaN(target2.x) ||
    isNaN(target2.y) ||
    isNaN(arcCenter.x) ||
    isNaN(arcCenter.y)
  ) {
    console.warn(
      `NaN encountered in drawSqueezedLink: ${JSON.stringify(
        { source1, source2, target1, target2, arcCenter },
        null,
        2
      )}`
    );
    return '';
  }
  return `M${source1.x},${source1.y}Q${arcCenter.x},${arcCenter.y},${target1.x},${target1.y}L${target2.x},${target2.y}Q${arcCenter.x},${arcCenter.y},${source2.x},${source2.y}Z`;
};
