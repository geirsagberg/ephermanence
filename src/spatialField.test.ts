import { describe, expect, it } from 'vitest';

import { createSpatialField, thoughtRadius, type Point } from './spatialField';
import type { Attachment, SpaceState, Thought } from './types';

function thought(id: string, x: number, radius = 50): Thought {
  return { id, text: id, x, y: 100, radius, tone: 0 };
}

function field(thoughts: Thought[], attachments: Attachment[] = []) {
  return createSpatialField({ thoughts, attachments });
}

function startDrag(
  spatialField: ReturnType<typeof createSpatialField>,
  id: string,
  point: Point = { x: 0, y: 0 },
  singular = false,
) {
  spatialField.dispatch({ type: 'thought-pointer-down', id, point, singular });
}

describe('spatial field transitions', () => {
  it('selects a clicked thought and brings it to the front', () => {
    const spatialField = field([
      thought('front', 100),
      thought('selected', 200),
      thought('back', 300),
    ]);

    startDrag(spatialField, 'selected');
    const snapshot = spatialField.dispatch({ type: 'pointer-up' });

    expect(snapshot.selectedId).toBe('selected');
    expect(snapshot.state.thoughts.map(({ id }) => id)).toEqual([
      'front',
      'back',
      'selected',
    ]);
  });

  it('preserves depth on an ordinary pointer down', () => {
    const spatialField = field([
      thought('pressed', 100),
      thought('middle', 200),
      thought('front', 300),
    ]);

    startDrag(spatialField, 'pressed');

    expect(spatialField.read().state.thoughts.map(({ id }) => id)).toEqual([
      'pressed',
      'middle',
      'front',
    ]);
    expect(spatialField.read().selectedId).toBeNull();
  });

  it('brings a thought to the front when solo dragging begins', () => {
    const spatialField = field(
      [thought('solo', 100), thought('joined', 200), thought('front', 300)],
      [['solo', 'joined']],
    );

    startDrag(spatialField, 'solo', { x: 0, y: 0 }, true);

    expect(spatialField.read().state.thoughts.map(({ id }) => id)).toEqual([
      'joined',
      'front',
      'solo',
    ]);
  });

  it('moves an attached group through a complete drag at the current zoom', () => {
    const spatialField = field(
      [thought('moving', 100), thought('joined', 200), thought('fixed', 400)],
      [['moving', 'joined']],
    );

    startDrag(spatialField, 'moving', { x: 10, y: 20 });
    spatialField.dispatch({
      type: 'pointer-move',
      point: { x: 30, y: 20 },
      zoom: 2,
    });
    const snapshot = spatialField.dispatch({ type: 'pointer-up' });

    expect(snapshot.state.thoughts).toEqual([
      thought('moving', 110),
      thought('joined', 210),
      thought('fixed', 400),
    ]);
    expect(snapshot.state.attachments).toEqual([['moving', 'joined']]);
  });

  it('brings an unbonded thought to the front when dragging begins', () => {
    const spatialField = field([thought('moving', 100), thought('front', 300)]);

    startDrag(spatialField, 'moving');
    spatialField.dispatch({
      type: 'pointer-move',
      point: { x: 4, y: 0 },
      zoom: 1,
    });
    const snapshot = spatialField.dispatch({ type: 'pointer-up' });

    expect(snapshot.state.thoughts.map(({ id }) => id)).toEqual(['front', 'moving']);
  });

  it('moves one thought and replaces only its bonds after a singular drag', () => {
    const spatialField = field(
      [thought('moving', 300), thought('old', 100), thought('new', 405)],
      [
        ['moving', 'old'],
        ['old', 'new'],
      ],
    );

    startDrag(spatialField, 'moving', { x: 0, y: 0 }, true);
    const moving = spatialField.dispatch({
      type: 'pointer-move',
      point: { x: 5, y: 0 },
      zoom: 1,
    });
    expect(moving.attachmentCandidateIds).toEqual(['new']);
    const snapshot = spatialField.dispatch({ type: 'pointer-up' });

    expect(snapshot.state.thoughts).toEqual([
      thought('old', 100),
      thought('new', 405),
      thought('moving', 305),
    ]);
    expect(snapshot.state.attachments).toEqual([
      ['old', 'new'],
      ['moving', 'new'],
    ]);
    expect(snapshot.attachmentCandidateIds).toEqual([]);
  });

  it('exposes a singular grab before movement and clears it on release', () => {
    const spatialField = field(
      [thought('grabbed', 100), thought('joined', 200)],
      [['grabbed', 'joined']],
    );

    startDrag(spatialField, 'grabbed', { x: 0, y: 0 }, true);

    expect(spatialField.read().grabbedThoughtId).toBe('grabbed');
    expect(spatialField.read().isDragging).toBe(false);

    spatialField.dispatch({ type: 'pointer-up' });

    expect(spatialField.read().grabbedThoughtId).toBeNull();
  });

  it('immediately detaches a selected thought when its grab control is tapped', () => {
    const spatialField = field(
      [thought('selected', 100), thought('joined', 200), thought('other', 300)],
      [
        ['selected', 'joined'],
        ['joined', 'other'],
      ],
    );
    startDrag(spatialField, 'selected');
    spatialField.dispatch({ type: 'pointer-up' });

    spatialField.dispatch({
      type: 'thought-pointer-down',
      id: 'selected',
      point: { x: 0, y: 0 },
      singular: true,
      detachOnTap: true,
    });
    const snapshot = spatialField.dispatch({ type: 'pointer-up' });

    expect(snapshot.selectedId).toBe('selected');
    expect(snapshot.state.attachments).toEqual([['joined', 'other']]);
  });

  it('exposes only potential new attachment targets while dragging', () => {
    const spatialField = field([thought('moving', 100), thought('target', 250)]);

    startDrag(spatialField, 'moving');
    const moving = spatialField.dispatch({
      type: 'pointer-move',
      point: { x: 50, y: 0 },
      zoom: 1,
    });

    expect(moving.attachmentCandidateIds).toEqual(['target']);
    expect(moving.isDragging).toBe(true);
    expect(moving.state.attachments).toEqual([]);

    const released = spatialField.dispatch({ type: 'pointer-up' });
    expect(released.attachmentCandidateIds).toEqual([]);
    expect(released.isDragging).toBe(false);
    expect(released.state.attachments).toEqual([['moving', 'target']]);
  });

  it('resizes an edited thought and recalculates its bonds', () => {
    const spatialField = createSpatialField({
      thoughts: [
        { ...thought('editing', 100, 96), text: 'A'.repeat(100) },
        thought('nearby', 270, 80),
      ],
      attachments: [['editing', 'nearby']],
    } satisfies SpaceState);

    const snapshot = spatialField.dispatch({
      type: 'edit-thought',
      id: 'editing',
      text: 'Short',
    });

    expect(snapshot.state.thoughts[0]).toMatchObject({
      id: 'editing',
      text: 'Short',
      x: 100,
      y: 100,
      tone: 0,
    });
    expect(snapshot.state.thoughts[0].radius).toBeLessThan(96);
    expect(snapshot.state.thoughts[1]).toEqual(thought('nearby', 270, 80));
    expect(snapshot.state.attachments).toEqual([]);
  });

  it('deletes the selected thought and all of its bonds', () => {
    const spatialField = field(
      [thought('keep', 100), thought('delete', 200), thought('other', 300)],
      [
        ['keep', 'delete'],
        ['keep', 'other'],
      ],
    );
    startDrag(spatialField, 'delete');
    spatialField.dispatch({ type: 'pointer-up' });

    const snapshot = spatialField.dispatch({ type: 'delete-selection' });

    expect(snapshot).toEqual({
      state: {
        thoughts: [thought('keep', 100), thought('other', 300)],
        attachments: [['keep', 'other']],
      },
      selectedId: null,
      grabbedThoughtId: null,
      attachmentCandidateIds: [],
      isDragging: false,
    });
  });

  it('creates a thought using field-owned size and its lifecycle tone', () => {
    const spatialField = field([thought('existing', 100)]);

    const snapshot = spatialField.dispatch({
      type: 'create-thought',
      id: 'created',
      text: 'A new thought',
      position: { x: 420, y: 260 },
      tone: 3,
    });

    const created = snapshot.state.thoughts.at(-1)!;
    expect(created).toMatchObject({
      id: 'created',
      text: 'A new thought',
      x: 420,
      y: 260,
      tone: 3,
    });
    expect(created.radius).toBeGreaterThan(0);
  });

  it('scales thought area with text length without overgrowing the longest thoughts', () => {
    expect(thoughtRadius('x'.repeat(98))).toBeCloseTo(102.3);
    expect(thoughtRadius('x'.repeat(220))).toBeCloseTo(135.63);
  });
});
