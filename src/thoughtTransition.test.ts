import { describe, expect, it } from 'vitest';

import { composerScaleForThought } from './thoughtTransition';

describe('Thought transitions', () => {
  it('matches the composer scale to the Thought screen radius', () => {
    expect(composerScaleForThought(84, 1.25)).toBe(1);
    expect(composerScaleForThought(70, 0.75)).toBe(0.5);
  });
});
