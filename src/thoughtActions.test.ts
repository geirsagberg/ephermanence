import { describe, expect, it } from 'vitest'

import { hasThoughtAttachment, positionThoughtActions } from './thoughtActions'

describe('selected Thought actions', () => {
  it('only offers independent movement for a Thought with a Bond', () => {
    const attachments: [string, string][] = [['first', 'second']]

    expect(hasThoughtAttachment('first', attachments)).toBe(true)
    expect(hasThoughtAttachment('alone', attachments)).toBe(false)
  })

  it.each([96, 64, 19.2])('centers actions on a %dpx Thought border', (screenRadius) => {
    const center = { x: 400, y: 300 }
    const positions = positionThoughtActions(center, screenRadius)

    for (const position of Object.values(positions)) {
      expect(Math.hypot(position.x - center.x, position.y - center.y)).toBeCloseTo(screenRadius)
    }
  })
})
