import { describe, expect, it } from 'vitest';

import { positionThoughtActions, THOUGHT_ACTION_SIZE } from './thoughtActions';

describe('selected Thought actions', () => {
  it.each([96, 64, 19.2])(
    'keeps action hit areas outside a %dpx screen radius',
    (screenRadius) => {
      const center = { x: 400, y: 300 };
      const positions = positionThoughtActions(center, screenRadius);
      const halfSize = THOUGHT_ACTION_SIZE / 2;

      for (const position of Object.values(positions)) {
        const nearestX = Math.max(Math.abs(position.x - center.x) - halfSize, 0);
        const nearestY = Math.max(Math.abs(position.y - center.y) - halfSize, 0);
        expect(Math.hypot(nearestX, nearestY)).toBeGreaterThan(screenRadius);
      }
    },
  );
});
