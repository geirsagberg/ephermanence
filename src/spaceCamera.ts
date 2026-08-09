export type Point = { x: number; y: number }
export type Size = { width: number; height: number }

export type CameraState = {
  x: number
  y: number
  zoom: number
}

export type CameraInput =
  | { type: 'set-state'; state: CameraState }
  | { type: 'pan-start'; point: Point }
  | { type: 'pointer-move'; point: Point }
  | { type: 'pointer-up' }
  | { type: 'pinch-start'; points: [Point, Point] }
  | { type: 'pinch-move'; points: [Point, Point] }
  | { type: 'pinch-end' }
  | { type: 'wheel'; point: Point; deltaY: number; pinching: boolean }
  | { type: 'zoom-key'; key: '+' | '-' | '0'; center: Point }
  | {
      type: 'fit-bounds'
      bounds: { left: number; top: number; right: number; bottom: number }
      padding: number
    }
  | { type: 'viewport-resize'; size: Size }

export type CameraTransition = {
  state: CameraState
  handled: boolean
  navigated: boolean
}

type Pan = {
  distance: number
  lastPoint: Point
}

type Pinch = {
  distance: number
  midpoint: Point
}

export type SpaceCamera = {
  read: () => CameraState
  dispatch: (input: CameraInput) => CameraTransition
  screenToWorld: (point: Point) => Point
  worldToScreen: (point: Point) => Point
}

export function createSpaceCamera(initialState: CameraState = { x: 0, y: 0, zoom: 1 }): SpaceCamera {
  let state = initialState
  let pan: Pan | null = null
  let pinch: Pinch | null = null
  let viewport: Size | null = null

  const screenToWorld = (point: Point) => ({
    x: (point.x - state.x) / state.zoom,
    y: (point.y - state.y) / state.zoom,
  })

  const worldToScreen = (point: Point) => ({
    x: point.x * state.zoom + state.x,
    y: point.y * state.zoom + state.y,
  })

  const zoomAt = (point: Point, requestedZoom: number) => {
    const zoom = Math.max(0.3, Math.min(3, requestedZoom))
    const worldPoint = screenToWorld(point)
    state = {
      x: point.x - worldPoint.x * zoom,
      y: point.y - worldPoint.y * zoom,
      zoom,
    }
  }

  return {
    read: () => state,
    screenToWorld,
    worldToScreen,
    dispatch(input) {
      switch (input.type) {
        case 'set-state': {
          state = input.state
          return { state, handled: true, navigated: true }
        }
        case 'pan-start': {
          pan = { distance: 0, lastPoint: input.point }
          return { state, handled: true, navigated: false }
        }
        case 'pointer-move': {
          if (!pan) return { state, handled: false, navigated: false }
          const dx = input.point.x - pan.lastPoint.x
          const dy = input.point.y - pan.lastPoint.y
          pan.distance += Math.hypot(dx, dy)
          pan.lastPoint = input.point
          state = { ...state, x: state.x + dx, y: state.y + dy }
          return { state, handled: true, navigated: pan.distance >= 4 }
        }
        case 'pointer-up': {
          if (!pan) return { state, handled: false, navigated: false }
          pan = null
          return { state, handled: true, navigated: false }
        }
        case 'pinch-start': {
          pan = null
          pinch = pinchGeometry(input.points)
          return { state, handled: true, navigated: false }
        }
        case 'pinch-move': {
          if (!pinch) return { state, handled: false, navigated: false }
          const next = pinchGeometry(input.points)
          const worldAnchor = screenToWorld(pinch.midpoint)
          const zoom = Math.max(0.3, Math.min(3, state.zoom * (next.distance / pinch.distance)))
          state = {
            x: next.midpoint.x - worldAnchor.x * zoom,
            y: next.midpoint.y - worldAnchor.y * zoom,
            zoom,
          }
          pinch = next
          return { state, handled: true, navigated: true }
        }
        case 'pinch-end': {
          if (!pinch) return { state, handled: false, navigated: false }
          pinch = null
          return { state, handled: true, navigated: false }
        }
        case 'wheel': {
          const sensitivity = input.pinching ? 0.006 : 0.002
          zoomAt(input.point, state.zoom * Math.exp(-input.deltaY * sensitivity))
          return { state, handled: true, navigated: true }
        }
        case 'zoom-key': {
          const factor = input.key === '+' ? 1.2 : input.key === '-' ? 1 / 1.2 : 1
          zoomAt(input.center, input.key === '0' ? 1 : state.zoom * factor)
          return { state, handled: true, navigated: true }
        }
        case 'fit-bounds': {
          if (!viewport) return { state, handled: false, navigated: false }
          const width = Math.max(1, input.bounds.right - input.bounds.left)
          const height = Math.max(1, input.bounds.bottom - input.bounds.top)
          const availableWidth = Math.max(1, viewport.width - input.padding * 2)
          const availableHeight = Math.max(1, viewport.height - input.padding * 2)
          const zoom = Math.max(0.3, Math.min(3, availableWidth / width, availableHeight / height))
          const center = {
            x: (input.bounds.left + input.bounds.right) / 2,
            y: (input.bounds.top + input.bounds.bottom) / 2,
          }
          state = {
            x: viewport.width / 2 - center.x * zoom,
            y: viewport.height / 2 - center.y * zoom,
            zoom,
          }
          return { state, handled: true, navigated: true }
        }
        case 'viewport-resize': {
          const previousCenter = viewport ? { x: viewport.width / 2, y: viewport.height / 2 } : { x: 0, y: 0 }
          const nextCenter = {
            x: input.size.width / 2,
            y: input.size.height / 2,
          }
          state = {
            ...state,
            x: state.x + nextCenter.x - previousCenter.x,
            y: state.y + nextCenter.y - previousCenter.y,
          }
          viewport = input.size
          return { state, handled: true, navigated: false }
        }
      }
    },
  }
}

function pinchGeometry([a, b]: [Point, Point]): Pinch {
  return {
    distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
    midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  }
}
