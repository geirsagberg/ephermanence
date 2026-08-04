import { describe, expect, it } from 'vitest';

import {
  bringThoughtToFront,
  deleteThought,
  editThought,
  getMovingThoughtIds,
  recalculateAttachments,
  translateThoughts,
} from './spaceInteractions';
import type { Attachment, Thought } from './types';

function thought(id: string, x: number, radius = 50): Thought {
  return { id, text: id, x, y: 100, radius, tone: 0 };
}

describe('space interactions', () => {
  it('brings a clicked thought to the front without moving it', () => {
    const thoughts = [
      thought('front', 100),
      thought('middle', 200),
      thought('back', 300),
    ];

    expect(bringThoughtToFront(thoughts, 'middle')).toEqual([
      thought('front', 100),
      thought('back', 300),
      thought('middle', 200),
    ]);
  });

  it('deletes a thought and all of its attachments', () => {
    const state = {
      thoughts: [thought('keep', 100), thought('delete', 200), thought('other', 300)],
      attachments: [
        ['keep', 'delete'],
        ['keep', 'other'],
      ] satisfies Attachment[],
    };

    expect(deleteThought(state, 'delete')).toEqual({
      thoughts: [thought('keep', 100), thought('other', 300)],
      attachments: [['keep', 'other']],
    });
  });

  it('resizes an edited thought and recalculates its attachments', () => {
    const state = {
      thoughts: [
        { ...thought('editing', 100, 96), text: 'A'.repeat(100) },
        thought('nearby', 270, 80),
      ],
      attachments: [['editing', 'nearby']] satisfies Attachment[],
    };

    expect(editThought(state, 'editing', 'Short', 1_000, 800)).toEqual({
      thoughts: [
        { ...thought('editing', 100, 74), text: 'Short' },
        thought('nearby', 270, 80),
      ],
      attachments: [],
    });
  });

  it('moves a dragged bubble by the pointer delta without automatic movement', () => {
    const thoughts = [thought('moving', 100), thought('target', 250)];

    const moved = translateThoughts(thoughts, new Set(['moving']), 40, 0, 1_000, 800);

    expect(moved).toEqual([thought('moving', 140), thought('target', 250)]);
  });

  it('moves an attached cluster together during a normal drag', () => {
    const attachments: Attachment[] = [['a', 'b']];

    expect(getMovingThoughtIds('a', attachments, false)).toEqual(new Set(['a', 'b']));
  });

  it('moves only the selected bubble during a Shift-drag', () => {
    const attachments: Attachment[] = [['a', 'b']];

    expect(getMovingThoughtIds('a', attachments, true)).toEqual(new Set(['a']));
  });

  it('joins touching bubbles only when attachments are recalculated on release', () => {
    const thoughts = [thought('moving', 100), thought('target', 200)];

    expect(recalculateAttachments(thoughts, [], new Set(['moving']), false)).toEqual([
      ['moving', 'target'],
    ]);
  });

  it('does not join bubbles that are not touching on release', () => {
    const thoughts = [thought('moving', 100), thought('target', 201)];

    expect(recalculateAttachments(thoughts, [], new Set(['moving']), false)).toEqual([]);
  });

  it('replaces the selected bubble attachments after a Shift-drag', () => {
    const thoughts = [thought('moving', 300), thought('old', 100), thought('new', 400)];
    const attachments: Attachment[] = [
      ['moving', 'old'],
      ['old', 'new'],
    ];

    expect(
      recalculateAttachments(thoughts, attachments, new Set(['moving']), true),
    ).toEqual([
      ['old', 'new'],
      ['moving', 'new'],
    ]);
  });
});
