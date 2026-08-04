import { describe, expect, it } from 'vitest';

import { initialSpace, spaceForQuery } from './initialSpace';

describe('initial spatial field', () => {
  it('places thoughts around world origin', () => {
    const xPositions = initialSpace.thoughts.map(({ x }) => x);
    const yPositions = initialSpace.thoughts.map(({ y }) => y);

    expect(Math.min(...xPositions)).toBeLessThan(0);
    expect(Math.max(...xPositions)).toBeGreaterThan(0);
    expect(Math.min(...yPositions)).toBeLessThan(0);
    expect(Math.max(...yPositions)).toBeGreaterThan(0);
  });

  it('starts blank without the debug query parameter', () => {
    expect(spaceForQuery('')).toEqual({ thoughts: [], attachments: [] });
    expect(spaceForQuery('?mode=debug')).toEqual({ thoughts: [], attachments: [] });
  });

  it('loads the sample field when debug is present', () => {
    expect(spaceForQuery('?debug')).toBe(initialSpace);
  });
});
