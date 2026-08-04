import { describe, expect, it } from 'vitest';

import { initialSpace } from './initialSpace';

describe('initial spatial field', () => {
  it('places thoughts around world origin', () => {
    const xPositions = initialSpace.thoughts.map(({ x }) => x);
    const yPositions = initialSpace.thoughts.map(({ y }) => y);

    expect(Math.min(...xPositions)).toBeLessThan(0);
    expect(Math.max(...xPositions)).toBeGreaterThan(0);
    expect(Math.min(...yPositions)).toBeLessThan(0);
    expect(Math.max(...yPositions)).toBeGreaterThan(0);
  });
});
