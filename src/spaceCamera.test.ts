import { describe, expect, it } from 'vitest';

import { screenToWorld, worldToScreen, zoomCameraAt } from './spaceCamera';

describe('space camera', () => {
  it('keeps the world point under the pointer fixed while zooming', () => {
    const camera = { x: -120, y: 80, zoom: 1.2 };
    const pointer = { x: 420, y: 260 };
    const worldPoint = screenToWorld(camera, pointer);

    const zoomed = zoomCameraAt(camera, pointer, -240);

    expect(worldToScreen(zoomed, worldPoint).x).toBeCloseTo(pointer.x);
    expect(worldToScreen(zoomed, worldPoint).y).toBeCloseTo(pointer.y);
  });

  it('limits zoom without limiting the world position', () => {
    expect(zoomCameraAt({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0 }, 100_000).zoom).toBe(0.3);
    expect(zoomCameraAt({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0 }, -100_000).zoom).toBe(3);
  });
});
