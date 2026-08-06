import { describe, expect, it } from 'vitest';

import {
  getThoughtTone,
  normalizeThoughtTone,
  THOUGHT_DARK_TONES,
  THOUGHT_TONES,
} from './thoughtTone';

describe('Thought tones', () => {
  it('keeps canvas and CSS colors paired', () => {
    const tone = getThoughtTone(0);

    expect(Number.parseInt(tone.css.slice(1), 16)).toBe(tone.canvas);
    expect(Number.parseInt(tone.darkCss.slice(1), 16)).toBe(tone.darkCanvas);
  });

  it('cycles tone indices through the shared palette', () => {
    expect(normalizeThoughtTone(THOUGHT_TONES.length)).toBe(0);
    expect(normalizeThoughtTone(-1)).toBe(THOUGHT_TONES.length - 1);
    expect(THOUGHT_DARK_TONES).toHaveLength(THOUGHT_TONES.length);
  });
});
