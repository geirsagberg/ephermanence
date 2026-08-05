import type { Point } from './spatialField';
import type { Attachment } from './types';

export const THOUGHT_ACTION_SIZE = 40;

export function hasThoughtAttachment(id: string, attachments: Attachment[]) {
  return attachments.some(([a, b]) => a === id || b === id);
}

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
