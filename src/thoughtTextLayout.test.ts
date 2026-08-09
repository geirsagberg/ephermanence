import { describe, expect, it } from 'vitest'

import { layoutThoughtText, thoughtRadius } from './thoughtTextLayout'

const measureMonospace = (text: string) => text.length * 10
const layout = (text: string, radius: number, measureText = measureMonospace) =>
  layoutThoughtText({
    text,
    radius,
    measureText: (value) => measureText(value),
  })

function availableLineWidths(radius: number, lineCount: number, lineHeight: number) {
  const innerRadius = radius - 18
  const center = (lineCount - 1) / 2
  return Array.from({ length: lineCount }, (_, index) => {
    const lineCenterY = (index - center) * lineHeight
    return 2 * Math.sqrt(Math.max(0, innerRadius ** 2 - lineCenterY ** 2))
  })
}

describe('circular thought text layout', () => {
  it('scales thought area with text length without overgrowing the longest thoughts', () => {
    expect(thoughtRadius('x'.repeat(98))).toBeCloseTo(102.3)
    expect(thoughtRadius('x'.repeat(220))).toBeCloseTo(135.63)
  })

  it('fits every line within its circular chord without losing words', () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve'
    const textLayout = layout(text, 100)
    const lines = textLayout.text.split('\n')
    const widths = availableLineWidths(100, lines.length, textLayout.style.lineHeight)

    expect(lines.join(' ')).toBe(text)
    for (const [index, line] of lines.entries()) {
      expect(measureMonospace(line)).toBeLessThanOrEqual(widths[index])
    }
    expect(lines[Math.floor(lines.length / 2)].length).toBeGreaterThan(lines[0].length)
  })

  it('keeps authored line breaks', () => {
    const textLayout = layout('first paragraph\nsecond paragraph', 100)

    expect(textLayout.text).toContain('paragraph\nsecond')
  })

  it.each([
    'Another thought is well thinked by thog and few for ever but boetw long onomathopoeticon excellent',
    'A long thought is maybe not the best way to determine what you want',
  ])('never abandons wrapping for long text: %s', (text) => {
    const radius = thoughtRadius(text)
    const textLayout = layout(text, radius)

    expect(textLayout.text).toContain('\n')
    expect(Math.max(...textLayout.text.split('\n').map(measureMonospace))).toBeLessThanOrEqual(radius * 1.42)
  })

  it('keeps maximum-length text inside the circular line widths', () => {
    const text =
      'What happens next? What happens next? What happens next? lorem iopsum dolor amet sojok wfe afw ewaf awef awef awe What happens next? What happens next? What happens next? lorem iopsum dolor amet sojok wfe afw ewaf awef a'
    const radius = thoughtRadius(text)
    const measureText = (value: string) => value.length * 8
    const textLayout = layout(text, radius, measureText)
    const lines = textLayout.text.split('\n')
    const widths = availableLineWidths(radius, lines.length, textLayout.style.lineHeight)

    for (const [index, line] of lines.entries()) {
      expect(measureText(line)).toBeLessThanOrEqual(widths[index])
    }
  })
})
