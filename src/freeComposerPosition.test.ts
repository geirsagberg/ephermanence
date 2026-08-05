import { describe, expect, it } from 'vitest';

import { findFreeComposerPosition } from './freeComposerPosition';

const viewport = { width: 390, height: 844 };

describe('free composer placement', () => {
  it('uses the preferred central position on an empty canvas', () => {
    expect(findFreeComposerPosition({ thoughts: [], viewport, zoom: 1 })).toEqual({
      x: 195,
      y: 388.24,
    });
  });

  it('uses horizontal free space when one side is occupied', () => {
    const position = findFreeComposerPosition({
      thoughts: [{ x: 121, y: 388, radius: 100 }],
      viewport,
      zoom: 1,
    });

    expect(position.x).toBeGreaterThan(viewport.width / 2);
  });

  it('scales its collision footprint when zoomed out', () => {
    const thoughts = [{ x: 195, y: 388, radius: 180 }];

    expect(findFreeComposerPosition({ thoughts, viewport, zoom: 1 })).toEqual({
      x: 195,
      y: 422,
    });
    expect(findFreeComposerPosition({ thoughts, viewport, zoom: 0.5 })).not.toEqual({
      x: 195,
      y: 422,
    });
  });

  it('falls back to the exact screen center when no candidate fits', () => {
    expect(
      findFreeComposerPosition({
        thoughts: [{ x: 195, y: 422, radius: 1_000 }],
        viewport,
        zoom: 0.3,
      }),
    ).toEqual({ x: 195, y: 422 });
  });
});
