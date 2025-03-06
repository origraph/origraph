import { NODE_LINK_CONSTANTS, Point } from 'components/Neld/constants';

export const drawPointyArc = ({
  source,
  target,
  offset,
}: {
  source: Point;
  target: Point;
  offset: number;
}) => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const arcRadius =
    (NODE_LINK_CONSTANTS.PARALLEL_ARC_OFFSET *
      offset *
      (NODE_LINK_CONSTANTS.EDGE_WIDTH * dx)) /
    Math.abs(dx);
  let theta; // Perpendicular angle, w.r.t. the straight line between source and target
  let edgePoint; // Local vector, pointing perpendicularly from the center of the source circle to the edge of a circle of radius EDGE_WIDTH

  if (dx === 0) {
    theta = dy >= 0 ? Math.PI : -Math.PI;
    edgePoint = {
      x: 0,
      y: NODE_LINK_CONSTANTS.EDGE_WIDTH / 2,
    };
  } else {
    theta = Math.atan(dy / dx) + Math.PI / 2;
    edgePoint = {
      x: (NODE_LINK_CONSTANTS.EDGE_WIDTH / 2) * Math.cos(theta),
      y: (NODE_LINK_CONSTANTS.EDGE_WIDTH / 2) * Math.sin(theta),
    };
  }
  const front = {
    x: source.x + edgePoint.x,
    y: source.y + edgePoint.y,
  };
  const back = {
    x: source.x - edgePoint.x,
    y: source.y - edgePoint.y,
  };
  const arc = {
    x: (source.x + target.x) / 2 + arcRadius * Math.cos(theta),
    y: (source.y + target.y) / 2 + arcRadius * Math.sin(theta),
  };
  if (
    isNaN(front.x) ||
    isNaN(front.y) ||
    isNaN(back.x) ||
    isNaN(back.y) ||
    isNaN(arc.x) ||
    isNaN(arc.y) ||
    isNaN(target.x) ||
    isNaN(target.y)
  ) {
    console.warn(
      `NaN encountered in drawPointyArc: ${JSON.stringify(
        { front, back, arc, source, target, offset },
        null,
        2
      )}`
    );
    return '';
  }
  return `M${front.x},${front.y}Q${arc.x},${arc.y},${target.x},${target.y}Q${arc.x},${arc.y},${back.x},${back.y}Z`;
};
