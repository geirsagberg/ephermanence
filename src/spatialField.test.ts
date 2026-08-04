import { describe, expect, it } from 'vitest';

import { createSpatialField, type Point } from './spatialField';
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
    spatialField.dispatch({
      type: 'pointer-move',
      point: { x: 5, y: 0 },
      zoom: 1,
    });
    const snapshot = spatialField.dispatch({ type: 'pointer-up' });

    expect(snapshot.state.thoughts).toEqual([
      thought('moving', 305),
      thought('old', 100),
      thought('new', 405),
    ]);
    expect(snapshot.state.attachments).toEqual([
      ['old', 'new'],
      ['moving', 'new'],
    ]);
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

    expect(snapshot.state).toEqual({
      thoughts: [
        { ...thought('editing', 100, 74), text: 'Short' },
        thought('nearby', 270, 80),
      ],
      attachments: [],
    });
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
    });
  });

  it('creates a thought using field-owned size and tone rules', () => {
    const spatialField = field([thought('existing', 100)]);

    const snapshot = spatialField.dispatch({
      type: 'create-thought',
      id: 'created',
      text: 'A new thought',
      position: { x: 420, y: 260 },
    });

    expect(snapshot.state.thoughts.at(-1)).toEqual({
      id: 'created',
      text: 'A new thought',
      x: 420,
      y: 260,
      radius: 74.55,
      tone: 1,
    });
  });
});
