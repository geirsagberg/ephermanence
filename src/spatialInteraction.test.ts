import { describe, expect, it } from 'vitest';

import { createSpatialInteraction } from './spatialInteraction';
import { SPACE_STORAGE_KEY, type SpaceStorage } from './spaceStorage';
import type { Thought } from './types';

function thought(id: string, x: number, y = 100): Thought {
  return { id, text: id, x, y, radius: 50, tone: 0 };
}

function interaction(thoughts: Thought[] = []) {
  const spatialInteraction = createSpatialInteraction({ thoughts, attachments: [] });
  spatialInteraction.dispatch({
    type: 'viewport-resize',
    size: { width: 1000, height: 800 },
  });
  return spatialInteraction;
}

function memoryStorage(initialValue?: string) {
  const values = new Map<string, string>();
  if (initialValue !== undefined) values.set(SPACE_STORAGE_KEY, initialValue);
  let writes = 0;
  const storage: SpaceStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes += 1;
      values.set(key, value);
    },
  };
  return {
    storage,
    read: () => values.get(SPACE_STORAGE_KEY),
    writes: () => writes,
  };
}

describe('spatial field interaction', () => {
  it('arbitrates empty-space dragging to the camera', () => {
    const spatialInteraction = interaction([thought('fixed', 0)]);

    spatialInteraction.dispatch({
      type: 'canvas-pointer-down',
      point: { x: 100, y: 100 },
      pointerId: 1,
      pointerKind: 'mouse',
    });
    const moved = spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: 120, y: 90 },
      pointerId: 1,
      pointerKind: 'mouse',
      inside: true,
    });

    expect(moved.snapshot.camera).toEqual({ x: 520, y: 390, zoom: 1 });
    expect(moved.snapshot.state.thoughts).toEqual([thought('fixed', 0)]);
  });

  it('clears selection only after camera navigation passes the drag threshold', () => {
    const existing = thought('selected', 0, 0);
    const spatialInteraction = interaction([existing]);
    const thoughtPoint = spatialInteraction.worldToScreen(existing);
    spatialInteraction.dispatch({
      type: 'thought-pointer-down',
      id: existing.id,
      point: thoughtPoint,
      singular: false,
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-up',
      pointerId: 1,
      pointerKind: 'mouse',
    });
    expect(spatialInteraction.read().selectedId).toBe(existing.id);

    spatialInteraction.dispatch({
      type: 'canvas-pointer-down',
      point: { x: 100, y: 100 },
      pointerId: 1,
      pointerKind: 'mouse',
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: 103, y: 100 },
      pointerId: 1,
      pointerKind: 'mouse',
      inside: true,
    });
    expect(spatialInteraction.read().selectedId).toBe(existing.id);

    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: 105, y: 100 },
      pointerId: 1,
      pointerKind: 'mouse',
      inside: true,
    });

    expect(spatialInteraction.read().selectedId).toBeNull();
  });

  it('arbitrates a Thought drag to the spatial field at the current zoom', () => {
    const spatialInteraction = interaction([thought('moving', 0, 0)]);
    spatialInteraction.dispatch({
      type: 'wheel',
      point: { x: 500, y: 400 },
      deltaY: -Math.log(2) / 0.002,
      pinching: false,
    });
    const screenPoint = spatialInteraction.worldToScreen({ x: 0, y: 0 });

    spatialInteraction.dispatch({
      type: 'thought-pointer-down',
      id: 'moving',
      point: screenPoint,
      singular: false,
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: screenPoint.x + 20, y: screenPoint.y },
      pointerId: 1,
      pointerKind: 'mouse',
      inside: true,
    });
    const released = spatialInteraction.dispatch({
      type: 'surface-pointer-up',
      pointerId: 1,
      pointerKind: 'mouse',
    });

    expect(released.snapshot.state.thoughts[0].x).toBeCloseTo(10);
    expect(released.snapshot.camera.zoom).toBeCloseTo(2);
  });

  it('cancels a Thought drag when a second touch begins a pinch', () => {
    const spatialInteraction = interaction([thought('moving', 0, 0)]);
    const point = spatialInteraction.worldToScreen({ x: 0, y: 0 });
    spatialInteraction.dispatch({
      type: 'thought-pointer-down',
      id: 'moving',
      point,
      singular: false,
    });
    spatialInteraction.dispatch({
      type: 'canvas-pointer-down',
      point,
      pointerId: 1,
      pointerKind: 'touch',
    });

    const pinching = spatialInteraction.dispatch({
      type: 'canvas-pointer-down',
      point: { x: point.x + 100, y: point.y },
      pointerId: 2,
      pointerKind: 'touch',
    });

    expect(pinching.snapshot.isDragging).toBe(false);
    expect(pinching.snapshot.selectedId).toBeNull();
    expect(pinching.effects).toEqual([{ type: 'empty-activated' }]);
  });

  it('requests in-place creation on empty double-click', () => {
    const spatialInteraction = interaction();

    const transition = spatialInteraction.dispatch({
      type: 'canvas-double-click',
      point: { x: 650, y: 450 },
    });

    expect(transition.effects).toEqual([
      {
        type: 'request-create',
        screenPosition: { x: 650, y: 450 },
        worldPosition: { x: 150, y: 50 },
      },
    ]);
  });

  it('requests editing when double-clicking a Thought', () => {
    const existing = thought('edit', 40, -20);
    const spatialInteraction = interaction([existing]);
    const screenPosition = spatialInteraction.worldToScreen(existing);

    const transition = spatialInteraction.dispatch({
      type: 'canvas-double-click',
      point: screenPosition,
    });

    expect(transition.effects).toEqual([
      { type: 'request-edit', thought: existing, screenPosition },
    ]);
  });

  it('opens creation at the pointer, then falls back to viewport center', () => {
    const spatialInteraction = interaction();
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: 700, y: 300 },
      pointerId: 1,
      pointerKind: 'mouse',
      inside: true,
    });

    expect(
      spatialInteraction.dispatch({ type: 'key-down', key: 'Enter' }).effects[0],
    ).toMatchObject({
      type: 'request-create',
      screenPosition: { x: 700, y: 300 },
    });

    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: 1200, y: 300 },
      pointerId: 1,
      pointerKind: 'mouse',
      inside: false,
    });

    expect(
      spatialInteraction.dispatch({ type: 'key-down', key: 'Enter' }).effects[0],
    ).toMatchObject({
      type: 'request-create',
      screenPosition: { x: 500, y: 400 },
    });
  });

  it('loads the durable spatial field before using the fallback', () => {
    const storedThought = thought('stored', 40);
    const memory = memoryStorage(
      JSON.stringify({ thoughts: [storedThought], attachments: [] }),
    );

    const spatialInteraction = createSpatialInteraction(
      { thoughts: [thought('fallback', 10)], attachments: [] },
      memory.storage,
    );

    expect(spatialInteraction.read().state.thoughts).toEqual([storedThought]);
  });

  it('commits durable field commands without caller-owned policy', () => {
    const memory = memoryStorage();
    const spatialInteraction = createSpatialInteraction(
      { thoughts: [], attachments: [] },
      memory.storage,
    );

    spatialInteraction.dispatch({
      type: 'create-thought',
      id: 'created',
      text: 'Durable',
      position: { x: 10, y: 20 },
    });

    expect(JSON.parse(memory.read()!)).toEqual(spatialInteraction.read().state);
    expect(memory.writes()).toBe(1);
  });

  it('waits until pointer-up to commit a dragged Thought', () => {
    const existing = thought('moving', 0, 0);
    const memory = memoryStorage();
    const spatialInteraction = createSpatialInteraction(
      { thoughts: [existing], attachments: [] },
      memory.storage,
    );
    spatialInteraction.dispatch({
      type: 'viewport-resize',
      size: { width: 1000, height: 800 },
    });
    const point = spatialInteraction.worldToScreen(existing);
    spatialInteraction.dispatch({
      type: 'thought-pointer-down',
      id: existing.id,
      point,
      singular: false,
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: point.x + 20, y: point.y },
      pointerId: 1,
      pointerKind: 'mouse',
      inside: true,
    });

    expect(memory.writes()).toBe(0);

    spatialInteraction.dispatch({
      type: 'surface-pointer-up',
      pointerId: 1,
      pointerKind: 'mouse',
    });

    expect(memory.writes()).toBe(1);
    expect(JSON.parse(memory.read()!).thoughts[0].x).toBe(20);
  });
});
