import { vi } from 'vitest'

const applicationState = vi.hoisted(() => ({
  latest: null as null | {
    render: ReturnType<typeof vi.fn>
    ticker: {
      started: boolean
      add: ReturnType<typeof vi.fn<(callback: (ticker: { deltaMS: number }) => void) => void>>
      remove: ReturnType<typeof vi.fn>
      start: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
      tick: (deltaMS: number) => void
    }
  },
}))

vi.mock('pixi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pixi.js')>()

  class Application {
    private tickerCallback?: (ticker: { deltaMS: number }) => void
    canvas = { setAttribute: vi.fn() }
    screen = { width: 390, height: 844 }
    stage = { addChild: vi.fn() }
    renderer = { on: vi.fn(), off: vi.fn() }
    render = vi.fn()
    ticker = {
      started: true,
      add: vi.fn((callback: (ticker: { deltaMS: number }) => void) => {
        this.tickerCallback = callback
      }),
      remove: vi.fn(),
      start: vi.fn(() => {
        this.ticker.started = true
      }),
      stop: vi.fn(() => {
        this.ticker.started = false
      }),
      tick: (deltaMS: number) => this.tickerCallback?.({ deltaMS }),
    }

    constructor() {
      applicationState.latest = this
    }

    init = vi.fn(async (options: { autoStart?: boolean }) => {
      this.ticker.started = options.autoStart !== false
    })
    destroy = vi.fn()
  }

  return { ...actual, Application }
})

vi.mock('pixi-filters/drop-shadow', () => ({
  DropShadowFilter: class {
    padding = 0
    offsetX = 0
    offsetY = 0
    alpha = 0
    blur = 0
    antialias = 'off'
  },
}))

import { describe, expect, it } from 'vitest'

import { mountSpatialFieldScene } from './spatialFieldScene'
import type { SpatialInteraction } from './spatialInteraction'

function idleInteraction() {
  return {
    read: () => ({
      state: { thoughts: [], attachments: [] },
      selectedId: null,
      independentlyMovingThoughtIds: [],
      attachmentCandidateIds: [],
      isDragging: false,
      camera: { x: 0, y: 0, zoom: 1 },
    }),
    screenToWorld: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  } as unknown as SpatialInteraction
}

describe('mounted spatial field scene', () => {
  it('stops rendering after an idle scene is drawn', async () => {
    vi.stubGlobal('window', { devicePixelRatio: 2 })
    const host = { appendChild: vi.fn() } as unknown as HTMLElement

    const mounted = await mountSpatialFieldScene(host, idleInteraction(), vi.fn())
    mounted.render()

    expect(applicationState.latest?.ticker.started).toBe(false)
    expect(applicationState.latest?.render).toHaveBeenCalledOnce()
  })

  it('renders authoring animation frames only until the motion completes', async () => {
    vi.stubGlobal('window', { devicePixelRatio: 2 })
    const host = { appendChild: vi.fn() } as unknown as HTMLElement
    const mounted = await mountSpatialFieldScene(host, idleInteraction(), vi.fn())

    mounted.presentAuthoring({
      id: 'new',
      position: { x: 100, y: 200 },
      tone: 0,
      openScale: 0.7,
      phase: 'open',
      closeScale: 1,
      elevation: { source: 0, target: 1, zoom: 1 },
    })

    expect(applicationState.latest?.ticker.started).toBe(true)

    applicationState.latest?.ticker.tick(1_000)

    expect(applicationState.latest?.ticker.started).toBe(false)
  })
})
