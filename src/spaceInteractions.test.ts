import { describe, expect, it } from 'vitest';

import {
  getMovingThoughtIds,
  recalculateAttachments,
  translateThoughts,
} from './spaceInteractions';
import type { Attachment, Thought } from './types';

function thought(id: string, x: number, radius = 50): Thought {
  return { id, text: id, x, y: 100, radius, tone: 0 };
}

describe('space interactions', () => {
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
