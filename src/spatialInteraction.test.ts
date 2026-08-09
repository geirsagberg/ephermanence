import { describe, expect, it } from 'vitest';

import { createSpatialInteraction } from './spatialInteraction';
import { SPACE_STORAGE_KEY, type SpaceStorage } from './spaceStorage';
import type { Thought } from './types';

function thought(id: string, x: number, y = 100): Thought {
  return { id, text: id, x, y, tone: 0 };
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
  it('centers existing Thoughts at default zoom when the viewport opens', () => {
    const spatialInteraction = createSpatialInteraction({
      thoughts: [thought('left', -300, -100), thought('rite', 100, 300)],
      attachments: [],
    });

    spatialInteraction.dispatch({
      type: 'viewport-resize',
      size: { width: 1000, height: 800 },
    });

    const left = spatialInteraction.worldToScreen({ x: -300, y: -100 });
    const right = spatialInteraction.worldToScreen({ x: 100, y: 300 });
    expect(spatialInteraction.read().camera.zoom).toBe(1);
    expect((left.x + right.x) / 2).toBeCloseTo(500);
    expect((left.y + right.y) / 2).toBeCloseTo(400);
  });

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
    });

    expect(moved.snapshot.camera).toEqual({ x: 520, y: 290, zoom: 1 });
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
      pointerId: 1,
      pointerKind: 'mouse',
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
    });
    expect(spatialInteraction.read().selectedId).toBe(existing.id);

    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: 105, y: 100 },
      pointerId: 1,
      pointerKind: 'mouse',
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
      pointerId: 1,
      pointerKind: 'mouse',
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: screenPoint.x + 20, y: screenPoint.y },
      pointerId: 1,
      pointerKind: 'mouse',
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
      pointerId: 1,
      pointerKind: 'touch',
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

  it('uses the first touched Thought as the cluster and pulls the second alone', () => {
    const first = thought('first', -100, 0);
    const pulled = thought('pulled', 0, 0);
    const joined = thought('joined', 100, 0);
    const spatialInteraction = createSpatialInteraction({
      thoughts: [first, pulled, joined],
      attachments: [
        ['first', 'pulled'],
        ['pulled', 'joined'],
      ],
    });
    spatialInteraction.dispatch({
      type: 'viewport-resize',
      size: { width: 1000, height: 800 },
    });
    const firstPoint = spatialInteraction.worldToScreen(first);
    const pulledPoint = spatialInteraction.worldToScreen(pulled);

    spatialInteraction.dispatch({
      type: 'thought-pointer-down',
      id: first.id,
      point: firstPoint,
      singular: false,
      pointerId: 1,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'canvas-pointer-down',
      point: firstPoint,
      pointerId: 1,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'thought-pointer-down',
      id: pulled.id,
      point: pulledPoint,
      singular: false,
      pointerId: 2,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'canvas-pointer-down',
      point: pulledPoint,
      pointerId: 2,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: firstPoint.x + 20, y: firstPoint.y },
      pointerId: 1,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: pulledPoint.x, y: pulledPoint.y + 300 },
      pointerId: 2,
      pointerKind: 'touch',
    });

    const moved = spatialInteraction.read();
    expect(moved.state.thoughts).toEqual([
      { ...first, x: -80 },
      { ...pulled, y: 300 },
      { ...joined, x: 120 },
    ]);
    expect(moved.camera.zoom).toBe(1);

    const pulledReleased = spatialInteraction.dispatch({
      type: 'surface-pointer-up',
      pointerId: 2,
      pointerKind: 'touch',
    });
    expect(pulledReleased.snapshot.state.attachments).toEqual([]);

    const joinedPoint = spatialInteraction.worldToScreen({ ...joined, x: 120 });
    spatialInteraction.dispatch({
      type: 'thought-pointer-down',
      id: joined.id,
      point: joinedPoint,
      singular: false,
      pointerId: 3,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'canvas-pointer-down',
      point: joinedPoint,
      pointerId: 3,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: firstPoint.x + 40, y: firstPoint.y },
      pointerId: 1,
      pointerKind: 'touch',
    });
    expect(spatialInteraction.read().state.thoughts).toEqual([
      { ...first, x: -60 },
      { ...pulled, y: 300 },
      { ...joined, x: 120 },
    ]);

    spatialInteraction.dispatch({
      type: 'surface-pointer-up',
      pointerId: 3,
      pointerKind: 'touch',
    });

    const released = spatialInteraction.dispatch({
      type: 'surface-pointer-up',
      pointerId: 1,
      pointerKind: 'touch',
    });
    expect(released.snapshot.state.attachments).toEqual([]);
  });

  it('persists detachment when the pulled Thought finger lifts first', () => {
    const first = thought('first', -50, 0);
    const pulled = thought('pulled', 50, 0);
    const memory = memoryStorage();
    const spatialInteraction = createSpatialInteraction(
      {
        thoughts: [first, pulled],
        attachments: [['first', 'pulled']],
      },
      memory.storage,
    );
    spatialInteraction.dispatch({
      type: 'viewport-resize',
      size: { width: 1000, height: 800 },
    });
    const firstPoint = spatialInteraction.worldToScreen(first);
    const pulledPoint = spatialInteraction.worldToScreen(pulled);

    for (const [pointerId, existing, point] of [
      [1, first, firstPoint],
      [2, pulled, pulledPoint],
    ] as const) {
      spatialInteraction.dispatch({
        type: 'thought-pointer-down',
        id: existing.id,
        point,
        singular: false,
        pointerId,
        pointerKind: 'touch',
      });
      spatialInteraction.dispatch({
        type: 'canvas-pointer-down',
        point,
        pointerId,
        pointerKind: 'touch',
      });
    }
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: pulledPoint.x + 300, y: pulledPoint.y },
      pointerId: 2,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-up',
      pointerId: 2,
      pointerKind: 'touch',
    });

    expect(spatialInteraction.read().state.attachments).toEqual([]);
    expect(JSON.parse(memory.read()!).attachments).toEqual([]);
    expect(memory.writes()).toBe(1);
  });

  it('reconnects when the held cluster is released over the pulled Thought', () => {
    const held = thought('held', -50, 0);
    const pulled = thought('pulled', 50, 0);
    const spatialInteraction = createSpatialInteraction({
      thoughts: [held, pulled],
      attachments: [['held', 'pulled']],
    });
    spatialInteraction.dispatch({
      type: 'viewport-resize',
      size: { width: 1000, height: 800 },
    });
    const heldPoint = spatialInteraction.worldToScreen(held);
    const pulledPoint = spatialInteraction.worldToScreen(pulled);

    for (const [pointerId, existing, point] of [
      [1, held, heldPoint],
      [2, pulled, pulledPoint],
    ] as const) {
      spatialInteraction.dispatch({
        type: 'thought-pointer-down',
        id: existing.id,
        point,
        singular: false,
        pointerId,
        pointerKind: 'touch',
      });
      spatialInteraction.dispatch({
        type: 'canvas-pointer-down',
        point,
        pointerId,
        pointerKind: 'touch',
      });
    }
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: pulledPoint.x + 300, y: pulledPoint.y },
      pointerId: 2,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-up',
      pointerId: 2,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: heldPoint.x + 400, y: heldPoint.y },
      pointerId: 1,
      pointerKind: 'touch',
    });
    expect(spatialInteraction.read().state.thoughts[0].x).toBeCloseTo(350);
    expect(spatialInteraction.read().state.thoughts[1].x).toBeCloseTo(350);
    const released = spatialInteraction.dispatch({
      type: 'surface-pointer-up',
      pointerId: 1,
      pointerKind: 'touch',
    });

    expect(released.snapshot.state.attachments).toEqual([['held', 'pulled']]);
  });

  it('moves two unconnected touched Thoughts independently instead of pinching', () => {
    const first = thought('first', -150, 0);
    const second = thought('second', 150, 0);
    const spatialInteraction = interaction([first, second]);
    const firstPoint = spatialInteraction.worldToScreen(first);
    const secondPoint = spatialInteraction.worldToScreen(second);

    for (const [pointerId, existing, point] of [
      [1, first, firstPoint],
      [2, second, secondPoint],
    ] as const) {
      spatialInteraction.dispatch({
        type: 'thought-pointer-down',
        id: existing.id,
        point,
        singular: false,
        pointerId,
        pointerKind: 'touch',
      });
      spatialInteraction.dispatch({
        type: 'canvas-pointer-down',
        point,
        pointerId,
        pointerKind: 'touch',
      });
    }
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: firstPoint.x - 30, y: firstPoint.y },
      pointerId: 1,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: secondPoint.x + 40, y: secondPoint.y },
      pointerId: 2,
      pointerKind: 'touch',
    });

    expect(spatialInteraction.read().state.thoughts).toEqual([
      { ...first, x: -180 },
      { ...second, x: 190 },
    ]);
    expect(spatialInteraction.read().camera.zoom).toBe(1);
  });

  it('moves three unconnected touched Thoughts independently', () => {
    const first = thought('first', -200, 0);
    const second = thought('second', 0, 0);
    const third = thought('third', 200, 0);
    const spatialInteraction = interaction([first, second, third]);
    const touches = [first, second, third].map((existing, index) => ({
      pointerId: index + 1,
      existing,
      point: spatialInteraction.worldToScreen(existing),
    }));

    for (const { pointerId, existing, point } of touches) {
      spatialInteraction.dispatch({
        type: 'thought-pointer-down',
        id: existing.id,
        point,
        singular: false,
        pointerId,
        pointerKind: 'touch',
      });
      spatialInteraction.dispatch({
        type: 'canvas-pointer-down',
        point,
        pointerId,
        pointerKind: 'touch',
      });
    }
    for (const { pointerId, point } of touches) {
      spatialInteraction.dispatch({
        type: 'surface-pointer-move',
        point: { x: point.x + pointerId * 10, y: point.y },
        pointerId,
        pointerKind: 'touch',
      });
    }

    expect(spatialInteraction.read().state.thoughts).toEqual([
      { ...first, x: -190 },
      { ...second, x: 20 },
      { ...third, x: 230 },
    ]);
  });

  it('exposes every Thought split into an independent touch session', () => {
    const first = thought('first', -100, 0);
    const second = thought('second', 0, 0);
    const third = thought('third', 100, 0);
    const spatialInteraction = createSpatialInteraction({
      thoughts: [first, second, third],
      attachments: [
        ['first', 'second'],
        ['second', 'third'],
      ],
    });
    spatialInteraction.dispatch({
      type: 'viewport-resize',
      size: { width: 1000, height: 800 },
    });

    for (const [pointerId, existing] of [
      [1, first],
      [2, second],
      [3, third],
    ] as const) {
      const point = spatialInteraction.worldToScreen(existing);
      spatialInteraction.dispatch({
        type: 'thought-pointer-down',
        id: existing.id,
        point,
        singular: false,
        pointerId,
        pointerKind: 'touch',
      });
      spatialInteraction.dispatch({
        type: 'canvas-pointer-down',
        point,
        pointerId,
        pointerKind: 'touch',
      });
    }

    expect(spatialInteraction.read().independentlyMovingThoughtIds).toEqual([
      'second',
      'third',
    ]);
  });

  it('moves a released cluster with the active cluster it joins', () => {
    const releasedThought = thought('released', -200, 0);
    const heldThought = thought('held', 200, 0);
    const spatialInteraction = interaction([releasedThought, heldThought]);
    const releasedPoint = spatialInteraction.worldToScreen(releasedThought);
    const heldPoint = spatialInteraction.worldToScreen(heldThought);

    for (const [pointerId, existing, point] of [
      [1, releasedThought, releasedPoint],
      [2, heldThought, heldPoint],
    ] as const) {
      spatialInteraction.dispatch({
        type: 'thought-pointer-down',
        id: existing.id,
        point,
        singular: false,
        pointerId,
        pointerKind: 'touch',
      });
      spatialInteraction.dispatch({
        type: 'canvas-pointer-down',
        point,
        pointerId,
        pointerKind: 'touch',
      });
    }
    const touching = spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: releasedPoint.x + 400, y: releasedPoint.y },
      pointerId: 1,
      pointerKind: 'touch',
    });
    expect(touching.snapshot.attachmentCandidateIds).toEqual(['held']);
    expect(touching.snapshot.state.attachments).toEqual([]);

    const attached = spatialInteraction.dispatch({
      type: 'surface-pointer-up',
      pointerId: 1,
      pointerKind: 'touch',
    });
    expect(attached.snapshot.state.attachments).toEqual([['released', 'held']]);

    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: heldPoint.x + 50, y: heldPoint.y },
      pointerId: 2,
      pointerKind: 'touch',
    });
    expect(spatialInteraction.read().state.thoughts).toEqual([
      { ...releasedThought, x: 250 },
      { ...heldThought, x: 250 },
    ]);
  });

  it('gathers one cluster while an unrelated Thought remains held', () => {
    const held = thought('held', -400, 0);
    const gathering = thought('gathering', 0, 0);
    const target = thought('target', 300, 0);
    const spatialInteraction = interaction([held, gathering, target]);
    const heldPoint = spatialInteraction.worldToScreen(held);
    const gatheringPoint = spatialInteraction.worldToScreen(gathering);

    spatialInteraction.dispatch({
      type: 'thought-pointer-down',
      id: held.id,
      point: heldPoint,
      singular: false,
      pointerId: 1,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'canvas-pointer-down',
      point: heldPoint,
      pointerId: 1,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: heldPoint.x + 20, y: heldPoint.y },
      pointerId: 1,
      pointerKind: 'touch',
    });

    spatialInteraction.dispatch({
      type: 'thought-pointer-down',
      id: gathering.id,
      point: gatheringPoint,
      singular: false,
      pointerId: 2,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'canvas-pointer-down',
      point: gatheringPoint,
      pointerId: 2,
      pointerKind: 'touch',
    });
    const preview = spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: gatheringPoint.x + 300, y: gatheringPoint.y },
      pointerId: 2,
      pointerKind: 'touch',
    });
    expect(preview.snapshot.attachmentCandidateIds).toEqual(['target']);
    expect(preview.snapshot.state.attachments).toEqual([]);

    const gathered = spatialInteraction.dispatch({
      type: 'surface-pointer-up',
      pointerId: 2,
      pointerKind: 'touch',
    });
    expect(gathered.snapshot.state.attachments).toEqual([['gathering', 'target']]);
    expect(gathered.snapshot.isDragging).toBe(true);

    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: heldPoint.x + 40, y: heldPoint.y },
      pointerId: 1,
      pointerKind: 'touch',
    });
    expect(
      Object.fromEntries(
        spatialInteraction
          .read()
          .state.thoughts.map((existing) => [existing.id, existing.x]),
      ),
    ).toEqual({ held: -360, gathering: 300, target: 300 });
  });

  it('still pinches when only one of the two touches starts on a Thought', () => {
    const existing = thought('held', 0, 0);
    const spatialInteraction = interaction([existing]);
    const thoughtPoint = spatialInteraction.worldToScreen(existing);
    const emptyPoint = { x: thoughtPoint.x + 200, y: thoughtPoint.y };
    spatialInteraction.dispatch({
      type: 'thought-pointer-down',
      id: existing.id,
      point: thoughtPoint,
      singular: false,
      pointerId: 1,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'canvas-pointer-down',
      point: thoughtPoint,
      pointerId: 1,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'canvas-pointer-down',
      point: emptyPoint,
      pointerId: 2,
      pointerKind: 'touch',
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: emptyPoint.x + 100, y: emptyPoint.y },
      pointerId: 2,
      pointerKind: 'touch',
    });

    expect(spatialInteraction.read().camera.zoom).toBeCloseTo(1.5);
    expect(spatialInteraction.read().state.thoughts).toEqual([existing]);
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
        tone: 0,
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

  it('opens launcher creation at the supplied free position, not the pointer', () => {
    const spatialInteraction = interaction();
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: 700, y: 300 },
      pointerId: 1,
      pointerKind: 'mouse',
    });

    expect(
      spatialInteraction.dispatch({
        type: 'launcher-open',
        point: { x: 500, y: 368 },
      }).effects[0],
    ).toMatchObject({
      type: 'request-create',
      screenPosition: { x: 500, y: 368 },
      worldPosition: { x: 0, y: -32 },
      tone: 0,
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
      tone: 2,
    });

    expect(JSON.parse(memory.read()!)).toEqual(spatialInteraction.read().state);
    expect(memory.writes()).toBe(1);
  });

  it('replaces and persists the complete space during import', () => {
    const memory = memoryStorage();
    const spatialInteraction = createSpatialInteraction(
      { thoughts: [thought('old', 0)], attachments: [] },
      memory.storage,
    );
    const imported = {
      thoughts: [thought('first', 10), thought('second', 20)],
      attachments: [['first', 'second']] as [string, string][],
    };

    const transition = spatialInteraction.dispatch({
      type: 'replace-space',
      state: imported,
    });

    expect(transition.snapshot.state).toEqual(imported);
    expect(transition.render).toBe(true);
    expect(JSON.parse(memory.read()!)).toEqual(imported);
    expect(memory.writes()).toBe(1);
  });

  it('centers imported Thoughts at default zoom', () => {
    const spatialInteraction = interaction([thought('old', 0, 0)]);
    spatialInteraction.dispatch({
      type: 'wheel',
      point: { x: 500, y: 400 },
      deltaY: -300,
      pinching: false,
    });

    spatialInteraction.dispatch({
      type: 'replace-space',
      state: {
        thoughts: [thought('left', -400, -200), thought('rite', 200, 200)],
        attachments: [],
      },
    });

    const left = spatialInteraction.worldToScreen({ x: -400, y: -200 });
    const right = spatialInteraction.worldToScreen({ x: 200, y: 200 });
    expect(spatialInteraction.read().camera.zoom).toBe(1);
    expect((left.x + right.x) / 2).toBeCloseTo(500);
    expect((left.y + right.y) / 2).toBeCloseTo(400);
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
      pointerId: 1,
      pointerKind: 'mouse',
    });
    spatialInteraction.dispatch({
      type: 'surface-pointer-move',
      point: { x: point.x + 20, y: point.y },
      pointerId: 1,
      pointerKind: 'mouse',
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
