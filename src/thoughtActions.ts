import type { Point } from './spatialField';

export const THOUGHT_ACTION_SIZE = 40;

const THOUGHT_ACTION_GAP = 8;

export function positionThoughtActions(center: Point, screenRadius: number) {
  const halfSize = THOUGHT_ACTION_SIZE / 2;
  const diagonalOffset = halfSize + (screenRadius + THOUGHT_ACTION_GAP) / Math.SQRT2;
  const verticalOffset = screenRadius + THOUGHT_ACTION_GAP + halfSize;

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
      y: center.y + verticalOffset,
    },
  };
}
