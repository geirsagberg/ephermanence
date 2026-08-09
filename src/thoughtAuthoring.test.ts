import { describe, expect, it, vi } from 'vitest'

import { createThoughtAuthoring } from './thoughtAuthoring'

const viewport = { width: 390, height: 844 }

describe('Thought authoring', () => {
  it('keeps a new Thought at its world position', () => {
    vi.spyOn(Date, 'now').mockReturnValue(42)
    const authoring = createThoughtAuthoring()
    authoring.dispatch({
      type: 'open-create',
      screenPosition: { x: 195, y: 388 },
      worldPosition: { x: -20, y: 70 },
      tone: 3,
    })

    expect(authoring.dispatch({ type: 'keep', text: '  A thought  ' })).toEqual([
      {
        type: 'create-thought',
        id: 'thought-42',
        text: 'A thought',
        position: { x: -20, y: 70 },
        tone: 3,
      },
    ])
    expect(authoring.read()).toEqual({ mode: 'idle' })
    vi.restoreAllMocks()
  })

  it('keeps an edited Thought without changing its position', () => {
    const authoring = createThoughtAuthoring()
    authoring.dispatch({
      type: 'open-edit',
      thought: {
        id: 'edit',
        text: 'Before',
        x: 10,
        y: 20,
        tone: 0,
      },
      screenPosition: { x: 210, y: 320 },
    })

    expect(authoring.dispatch({ type: 'keep', text: 'After' })).toEqual([
      { type: 'edit-thought', id: 'edit', text: 'After' },
    ])
    expect(authoring.read()).toEqual({ mode: 'idle' })
  })

  it('cancels either authoring mode without a command', () => {
    const authoring = createThoughtAuthoring()
    authoring.dispatch({
      type: 'open-create',
      screenPosition: { x: 10, y: 20 },
      worldPosition: { x: 30, y: 40 },
      tone: 0,
    })

    expect(authoring.dispatch({ type: 'cancel' })).toEqual([])
    expect(authoring.read()).toEqual({ mode: 'idle' })
  })

  it('uses the preferred central position on an empty spatial field', () => {
    const authoring = createThoughtAuthoring()

    expect(authoring.findFreePosition({ thoughts: [], viewport, zoom: 1 })).toEqual({
      x: 195,
      y: 388.24,
    })
  })

  it('uses horizontal free space when one side is occupied', () => {
    const authoring = createThoughtAuthoring()

    const position = authoring.findFreePosition({
      thoughts: [{ x: 121, y: 388, radius: 100 }],
      viewport,
      zoom: 1,
    })

    expect(position.x).toBeGreaterThan(viewport.width / 2)
    expect(position.x).toBeLessThan(viewport.width - 105 - 16)
  })

  it('balances desktop placement between existing thoughts and screen edges', () => {
    const authoring = createThoughtAuthoring()
    const desktop = { width: 1_200, height: 1_200 }
    const existing = { x: 250, y: 552, radius: 80 }

    const position = authoring.findFreePosition({
      thoughts: [existing],
      viewport: desktop,
      zoom: 1,
    })

    const thoughtClearance = Math.hypot(position.x - existing.x, position.y - existing.y) - existing.radius - 72 - 8
    const rightEdgeClearance = desktop.width - 105 - 16 - position.x
    expect(position.x).toBeGreaterThan(desktop.width / 2)
    expect(rightEdgeClearance).toBeGreaterThan(0)
    expect(Math.abs(thoughtClearance - rightEdgeClearance)).toBeLessThan(110)
  })

  it('scales its collision footprint when zoomed out', () => {
    const authoring = createThoughtAuthoring()
    const thoughts = [{ x: 195, y: 388, radius: 180 }]

    expect(authoring.findFreePosition({ thoughts, viewport, zoom: 1 })).toEqual({
      x: 195,
      y: 422,
    })
    expect(authoring.findFreePosition({ thoughts, viewport, zoom: 0.5 })).not.toEqual({
      x: 195,
      y: 422,
    })
  })

  it('falls back to the exact screen center when no position fits', () => {
    const authoring = createThoughtAuthoring()

    expect(
      authoring.findFreePosition({
        thoughts: [{ x: 195, y: 422, radius: 1_000 }],
        viewport,
        zoom: 0.3,
      }),
    ).toEqual({ x: 195, y: 422 })
  })
})
