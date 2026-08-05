import { describe, expect, it } from 'vitest';

import { positionThoughtActions } from './thoughtActions';

describe('selected Thought actions', () => {
  it.each([96, 64, 19.2])('centers actions on a %dpx Thought border', (screenRadius) => {
    const center = { x: 400, y: 300 };
    const positions = positionThoughtActions(center, screenRadius);

    for (const position of Object.values(positions)) {
      expect(Math.hypot(position.x - center.x, position.y - center.y)).toBeCloseTo(
        screenRadius,
      );
    }
  });
});
