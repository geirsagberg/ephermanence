import { describe, expect, it } from 'vitest';

import { thoughtRadius } from './spatialField';
import { circleLineWidths, wrapTextInCircle } from './thoughtTextLayout';

const measureMonospace = (text: string) => text.length * 10;

describe('circular thought text layout', () => {
  it('offers more width to middle lines than edge lines', () => {
    const widths = circleLineWidths(100, 5, 20);

    expect(widths[0]).toBeCloseTo(widths[4]);
    expect(widths[1]).toBeCloseTo(widths[3]);
    expect(widths[2]).toBeGreaterThan(widths[1]);
    expect(widths[1]).toBeGreaterThan(widths[0]);
  });

  it('fits every line within its circular chord without losing words', () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve';
    const wrapped = wrapTextInCircle(text, 100, 20, measureMonospace);
    const lines = wrapped.split('\n');
    const widths = circleLineWidths(100, lines.length, 20);

    expect(lines.join(' ')).toBe(text);
    for (const [index, line] of lines.entries()) {
      expect(measureMonospace(line)).toBeLessThanOrEqual(widths[index]);
    }
    expect(lines[Math.floor(lines.length / 2)].length).toBeGreaterThan(lines[0].length);
  });

  it('keeps authored line breaks', () => {
    const wrapped = wrapTextInCircle(
      'first paragraph\nsecond paragraph',
      100,
      20,
      measureMonospace,
    );

    expect(wrapped).toContain('paragraph\nsecond');
  });

  it.each([
    'Another thought is well thinked by thog and few for ever but boetw long onomathopoeticon excellent',
    'A long thought is maybe not the best way to determine what you want',
  ])('never abandons wrapping for long text: %s', (text) => {
    const radius = thoughtRadius(text);
    const wrapped = wrapTextInCircle(text, radius, 23, measureMonospace);

    expect(wrapped).toContain('\n');
    expect(Math.max(...wrapped.split('\n').map(measureMonospace))).toBeLessThanOrEqual(
      radius * 1.42,
    );
  });

  it('keeps maximum-length text inside the circular line widths', () => {
    const text =
      'What happens next? What happens next? What happens next? lorem iopsum dolor amet sojok wfe afw ewaf awef awef awe What happens next? What happens next? What happens next? lorem iopsum dolor amet sojok wfe afw ewaf awef a';
    const radius = thoughtRadius(text);
    const measureText = (value: string) => value.length * 8;
    const lines = wrapTextInCircle(text, radius, 23, measureText).split('\n');
    const widths = circleLineWidths(radius, lines.length, 23);

    for (const [index, line] of lines.entries()) {
      expect(measureText(line)).toBeLessThanOrEqual(widths[index]);
    }
  });
});
