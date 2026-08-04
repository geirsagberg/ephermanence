import { describe, expect, it } from 'vitest';

import { hintForSpace } from './spaceHint';
import type { SpaceState, Thought } from './types';

function thought(id: string): Thought {
  return { id, text: id, x: 0, y: 0, radius: 50, tone: 0 };
}

function space(thoughtIds: string[], attachments: SpaceState['attachments'] = []) {
  return { thoughts: thoughtIds.map(thought), attachments };
}

describe('space hint', () => {
  it('keeps the creation hint through the first bubble', () => {
    expect(hintForSpace(space([]))).toBe('Double click or press Enter');
    expect(hintForSpace(space(['one']))).toBe('Double click or press Enter');
  });

  it('prompts two disconnected bubbles to connect', () => {
    expect(hintForSpace(space(['one', 'two']))).toBe('Drag to connect');
    expect(hintForSpace(space(['one', 'two']), true)).toBe('Touch another thought');
  });

  it('hides once two bubbles are attached or a third exists', () => {
    expect(hintForSpace(space(['one', 'two'], [['one', 'two']]))).toBeNull();
    expect(hintForSpace(space(['one', 'two', 'three']))).toBeNull();
  });
});
