import { describe, expect, it } from 'vitest';

import { AmbientBubbleField } from './ambientBubbleField';

const viewport = { left: -195, right: 195, top: -422, bottom: 422 };

describe('ambient bubble field', () => {
  it('reuses cached chunks while the visible world is unchanged', () => {
    const field = new AmbientBubbleField();
    field.update(viewport);
    const chunks = [...field.children];

    field.update(viewport);

    expect(field.children).toEqual(chunks);
  });

  it('discards distant chunks when the camera moves to another region', () => {
    const field = new AmbientBubbleField();
    field.update(viewport);
    const previousChunks = new Set(field.children);

    field.update({ left: 5_000, right: 5_390, top: 5_000, bottom: 5_844 });

    expect(field.children.every((chunk) => !previousChunks.has(chunk))).toBe(true);
  });

  it('loads additional chunks for a zoomed-out world view', () => {
    const field = new AmbientBubbleField();
    field.update(viewport);
    const defaultCount = field.children.length;

    field.update({ left: -650, right: 650, top: -1_407, bottom: 1_407 });

    expect(field.children.length).toBeGreaterThan(defaultCount);
  });
});
