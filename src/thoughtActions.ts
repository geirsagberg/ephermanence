import type { Point } from './spatialField';

export const THOUGHT_ACTION_SIZE = 40;

export function positionThoughtActions(center: Point, screenRadius: number) {
  const diagonalOffset = screenRadius / Math.SQRT2;

  return {
    edit: {
      x: center.x - diagonalOffset,
      y: center.y - diagonalOffset,
    },
    delete: {
      x: center.x + diagonalOffset,
      y: center.y - diagonalOffset,
    },
    grab: {
      x: center.x,
      y: center.y + screenRadius,
    },
  };
}
