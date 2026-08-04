import { describe, expect, it } from 'vitest';

import { createSpaceCamera } from './spaceCamera';

describe('space camera navigation', () => {
  it('centers world origin in the initial viewport', () => {
    const camera = createSpaceCamera();

    camera.dispatch({
      type: 'viewport-resize',
      size: { width: 1280, height: 720 },
    });

    expect(camera.worldToScreen({ x: 0, y: 0 })).toEqual({ x: 640, y: 360 });
    expect(camera.screenToWorld({ x: 640, y: 360 })).toEqual({ x: 0, y: 0 });
  });

  it('preserves the pan offset when the viewport is resized', () => {
    const camera = createSpaceCamera();
    camera.dispatch({
      type: 'viewport-resize',
      size: { width: 1000, height: 800 },
    });
    camera.dispatch({ type: 'pan-start', point: { x: 0, y: 0 } });
    camera.dispatch({ type: 'pointer-move', point: { x: 20, y: -10 } });
    camera.dispatch({ type: 'pointer-up' });

    camera.dispatch({
      type: 'viewport-resize',
      size: { width: 1200, height: 900 },
    });

    expect(camera.worldToScreen({ x: 0, y: 0 })).toEqual({ x: 620, y: 440 });
  });

  it('owns a complete pan session and reports when navigation begins', () => {
    const camera = createSpaceCamera();

    camera.dispatch({ type: 'pan-start', point: { x: 10, y: 20 } });
    const moved = camera.dispatch({
      type: 'pointer-move',
      point: { x: 13, y: 22 },
    });
    const movedPastThreshold = camera.dispatch({
      type: 'pointer-move',
      point: { x: 20, y: 15 },
    });
    const ended = camera.dispatch({ type: 'pointer-up' });

    expect(moved).toMatchObject({ handled: true, navigated: false });
    expect(movedPastThreshold).toMatchObject({ handled: true, navigated: true });
    expect(ended).toMatchObject({ handled: true, navigated: false });
    expect(camera.read()).toEqual({ x: 10, y: -5, zoom: 1 });
    expect(
      camera.dispatch({ type: 'pointer-move', point: { x: 30, y: 30 } }).handled,
    ).toBe(false);
  });

  it('keeps the world point under the pointer fixed through wheel navigation', () => {
    const camera = createSpaceCamera({ x: -120, y: 80, zoom: 1.2 });
    const pointer = { x: 420, y: 260 };
    const worldPoint = camera.screenToWorld(pointer);

    camera.dispatch({ type: 'wheel', point: pointer, deltaY: -240, pinching: false });

    expect(camera.worldToScreen(worldPoint).x).toBeCloseTo(pointer.x);
    expect(camera.worldToScreen(worldPoint).y).toBeCloseTo(pointer.y);
  });

  it('owns zoom limits across a navigation sequence', () => {
    const camera = createSpaceCamera();
    const point = { x: 0, y: 0 };

    camera.dispatch({ type: 'wheel', point, deltaY: 100_000, pinching: false });
    expect(camera.read().zoom).toBe(0.3);

    camera.dispatch({ type: 'wheel', point, deltaY: -100_000, pinching: false });
    expect(camera.read().zoom).toBe(3);
  });

  it('uses stronger zoom sensitivity for synthesized pinch input', () => {
    const wheelCamera = createSpaceCamera();
    const pinchCamera = createSpaceCamera();
    const point = { x: 0, y: 0 };

    wheelCamera.dispatch({ type: 'wheel', point, deltaY: -100, pinching: false });
    pinchCamera.dispatch({ type: 'wheel', point, deltaY: -100, pinching: true });

    expect(wheelCamera.read().zoom).toBeCloseTo(Math.exp(0.2));
    expect(pinchCamera.read().zoom).toBeCloseTo(Math.exp(0.6));
  });

  it('zooms and pans around the moving midpoint of a touch pinch', () => {
    const camera = createSpaceCamera({ x: -120, y: 80, zoom: 1 });
    const startingMidpoint = { x: 200, y: 100 };
    const worldAnchor = camera.screenToWorld(startingMidpoint);

    camera.dispatch({
      type: 'pinch-start',
      points: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
      ],
    });
    const moved = camera.dispatch({
      type: 'pinch-move',
      points: [
        { x: 50, y: 120 },
        { x: 350, y: 120 },
      ],
    });

    expect(moved).toMatchObject({ handled: true, navigated: true });
    expect(camera.read().zoom).toBeCloseTo(1.5);
    expect(camera.worldToScreen(worldAnchor).x).toBeCloseTo(200);
    expect(camera.worldToScreen(worldAnchor).y).toBeCloseTo(120);
    expect(camera.dispatch({ type: 'pinch-end' }).handled).toBe(true);
  });

  it('owns keyboard zoom and reset around the viewport center', () => {
    const camera = createSpaceCamera({ x: -300, y: 140, zoom: 2 });
    const center = { x: 640, y: 360 };
    const worldCenter = camera.screenToWorld(center);

    camera.dispatch({ type: 'zoom-key', key: '-', center });
    expect(camera.read().zoom).toBeCloseTo(2 / 1.2);

    camera.dispatch({ type: 'zoom-key', key: '0', center });

    expect(camera.read().zoom).toBe(1);
    expect(camera.worldToScreen(worldCenter)).toEqual(center);
  });
});
