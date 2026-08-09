import { createSpaceCamera, type CameraState, type Size } from './spaceCamera'
import { createSpatialField, type Point, type SpatialField, type SpatialFieldSnapshot } from './spatialField'
import { loadStoredSpace, saveStoredSpace, type SpaceStorage } from './spaceStorage'
import { thoughtRadius } from './thoughtTextLayout'
import { normalizeThoughtTone } from './thoughtTone'
import type { SpaceState, Thought } from './types'

export type PointerKind = string

export type SpatialInteractionInput =
  | { type: 'set-camera'; camera: CameraState }
  | {
      type: 'thought-pointer-down'
      id: string
      point: Point
      singular: boolean
      detachOnTap?: boolean
      pointerId: number
      pointerKind: PointerKind
    }
  | { type: 'clear-selection' }
  | { type: 'delete-selection' }
  | { type: 'edit-thought'; id: string; text: string }
  | { type: 'create-thought'; id: string; text: string; position: Point; tone: number }
  | {
      type: 'canvas-pointer-down'
      point: Point
      pointerId: number
      pointerKind: PointerKind
    }
  | {
      type: 'surface-pointer-move'
      point: Point
      pointerId: number
      pointerKind: PointerKind
    }
  | {
      type: 'surface-pointer-up'
      pointerId: number
      pointerKind: PointerKind
    }
  | { type: 'canvas-click'; point: Point }
  | { type: 'canvas-double-click'; point: Point }
  | { type: 'wheel'; point: Point; deltaY: number; pinching: boolean }
  | { type: 'key-down'; key: '+' | '-' | '0' }
  | { type: 'fit-all' }
  | { type: 'reset-zoom' }
  | { type: 'viewport-resize'; size: Size }
  | { type: 'launcher-open'; point: Point }
  | { type: 'replace-space'; state: SpaceState }

export type SpatialInteractionEffect =
  | {
      type: 'request-create'
      screenPosition: Point
      worldPosition: Point
      tone: number
    }
  | { type: 'request-edit'; thought: Thought; screenPosition: Point }
  | { type: 'empty-activated' }

export type SpatialInteractionSnapshot = SpatialFieldSnapshot & {
  camera: CameraState
}

export type SpatialInteractionTransition = {
  snapshot: SpatialInteractionSnapshot
  effects: SpatialInteractionEffect[]
  render: boolean
  cursor?: 'grabbing' | 'pointer'
}

export type SpatialInteraction = {
  read: () => SpatialInteractionSnapshot
  dispatch: (input: SpatialInteractionInput) => SpatialInteractionTransition
  screenToWorld: (point: Point) => Point
  worldToScreen: (point: Point) => Point
}

export function createSpatialInteraction(
  fallbackState: SpaceState,
  storage: SpaceStorage | null = null,
): SpatialInteraction {
  const camera = createSpaceCamera()
  const initialState = loadStoredSpace(storage) ?? fallbackState
  const field = createSpatialField(initialState)
  const touchPoints = new Map<number, Point>()
  const touchedThoughts = new Map<number, string>()
  let pinchGesture = false
  let pinchActive = false
  let pinchPointerIds: [number, number] | null = null
  let viewport: Size = { width: 0, height: 0 }
  let viewportInitialized = false
  let durableState = initialState
  let snapshot = combineSnapshot(field, camera.read())

  const finish = (
    effects: SpatialInteractionEffect[] = [],
    render = false,
    cursor?: SpatialInteractionTransition['cursor'],
    commit = false,
  ): SpatialInteractionTransition => {
    snapshot = combineSnapshot(field, camera.read(), snapshot)
    if (commit && snapshot.state !== durableState && saveStoredSpace(storage, snapshot.state)) {
      durableState = snapshot.state
    }
    return { snapshot, effects, render, cursor }
  }

  const clearSelection = () => field.dispatch({ type: 'clear-selection' })

  return {
    read: () => snapshot,
    screenToWorld: camera.screenToWorld,
    worldToScreen: camera.worldToScreen,
    dispatch(input) {
      switch (input.type) {
        case 'set-camera': {
          camera.dispatch({ type: 'set-state', state: input.camera })
          return finish([], true)
        }
        case 'thought-pointer-down': {
          if (input.pointerKind === 'touch' && pinchGesture) return finish()
          if (input.pointerKind === 'touch') {
            touchedThoughts.set(input.pointerId, input.id)
          }
          const before = field.read()
          field.dispatch(input)
          return finish([], field.read() !== before)
        }
        case 'canvas-pointer-down': {
          if (input.pointerKind === 'touch') {
            touchPoints.set(input.pointerId, input.point)
            if (touchPoints.size === 2) {
              const touchedIds = new Set(
                [...touchPoints.keys()]
                  .map((pointerId) => touchedThoughts.get(pointerId))
                  .filter((id): id is string => Boolean(id)),
              )
              if (touchedIds.size === 2) return finish([], true, 'grabbing')
              const points = [...touchPoints.values()] as [Point, Point]
              pinchPointerIds = [...touchPoints.keys()] as [number, number]
              pinchGesture = true
              pinchActive = true
              camera.dispatch({ type: 'pointer-up' })
              for (const pointerId of touchPoints.keys()) {
                field.dispatch({ type: 'pointer-cancel', pointerId })
              }
              clearSelection()
              camera.dispatch({ type: 'pinch-start', points })
              return finish([{ type: 'empty-activated' }], true, 'grabbing')
            }
            if (touchPoints.size > 1) return finish([], true, 'grabbing')
          }

          if (thoughtAt(input.point, field.read().state.thoughts, camera)) {
            return finish()
          }
          camera.dispatch({ type: 'pan-start', point: input.point })
          return finish([], false, 'grabbing')
        }
        case 'surface-pointer-move': {
          if (input.pointerKind === 'touch' && touchPoints.has(input.pointerId)) {
            touchPoints.set(input.pointerId, input.point)
            if (pinchActive && pinchPointerIds?.includes(input.pointerId)) {
              const points = pinchPointerIds.map((pointerId) => touchPoints.get(pointerId))
              if (points[0] && points[1]) {
                camera.dispatch({
                  type: 'pinch-move',
                  points: [points[0], points[1]],
                })
                return finish([], true)
              }
            }
            if (pinchGesture) return finish()
          }

          const cameraMove = camera.dispatch({
            type: 'pointer-move',
            point: input.point,
          })
          if (cameraMove.handled) {
            if (cameraMove.navigated) clearSelection()
            return finish([], true)
          }

          const before = field.read()
          field.dispatch({
            type: 'pointer-move',
            pointerId: input.pointerId,
            point: input.point,
            zoom: camera.read().zoom,
          })
          return finish([], field.read() !== before)
        }
        case 'surface-pointer-up': {
          if (input.pointerKind === 'touch' && touchPoints.has(input.pointerId)) {
            touchPoints.delete(input.pointerId)
            touchedThoughts.delete(input.pointerId)
            if (pinchGesture) {
              if (pinchActive && pinchPointerIds?.includes(input.pointerId)) {
                camera.dispatch({ type: 'pinch-end' })
                pinchActive = false
                pinchPointerIds = null
              }
              if (touchPoints.size === 0) {
                pinchGesture = false
              }
              return finish([], false, 'pointer')
            }
          }

          const cameraUp = camera.dispatch({ type: 'pointer-up' })
          if (cameraUp.handled) return finish([], false, 'pointer')
          const before = field.read()
          field.dispatch({ type: 'pointer-up', pointerId: input.pointerId })
          return finish([], field.read() !== before, 'pointer', true)
        }
        case 'canvas-click': {
          if (thoughtAt(input.point, field.read().state.thoughts, camera)) {
            return finish()
          }
          const before = field.read()
          clearSelection()
          return finish([{ type: 'empty-activated' }], field.read() !== before)
        }
        case 'canvas-double-click': {
          const thought = thoughtAt(input.point, field.read().state.thoughts, camera)
          if (thought) {
            clearSelection()
            return finish([
              {
                type: 'request-edit',
                thought,
                screenPosition: camera.worldToScreen(thought),
              },
            ])
          }
          return finish([
            {
              type: 'request-create',
              screenPosition: input.point,
              worldPosition: camera.screenToWorld(input.point),
              tone: normalizeThoughtTone(field.read().state.thoughts.length),
            },
          ])
        }
        case 'wheel': {
          camera.dispatch(input)
          clearSelection()
          return finish([{ type: 'empty-activated' }], true)
        }
        case 'key-down': {
          const center = { x: viewport.width / 2, y: viewport.height / 2 }
          camera.dispatch({ type: 'zoom-key', key: input.key, center })
          clearSelection()
          return finish([{ type: 'empty-activated' }], true)
        }
        case 'reset-zoom': {
          const center = { x: viewport.width / 2, y: viewport.height / 2 }
          camera.dispatch({ type: 'zoom-key', key: '0', center })
          clearSelection()
          return finish([{ type: 'empty-activated' }], true)
        }
        case 'fit-all': {
          const thoughts = field.read().state.thoughts
          if (thoughts.length === 0) return finish()
          const bounds = thoughtBounds(thoughts)
          camera.dispatch({ type: 'fit-bounds', bounds, padding: 72 })
          clearSelection()
          return finish([{ type: 'empty-activated' }], true)
        }
        case 'viewport-resize': {
          const firstViewport = !viewportInitialized
          viewportInitialized = true
          viewport = input.size
          camera.dispatch(input)
          const thoughts = field.read().state.thoughts
          if (firstViewport && thoughts.length > 0) {
            centerThoughtsAtDefault(camera, thoughts, viewport)
          }
          return finish([], true)
        }
        case 'launcher-open': {
          clearSelection()
          return finish([
            {
              type: 'request-create',
              screenPosition: input.point,
              worldPosition: camera.screenToWorld(input.point),
              tone: normalizeThoughtTone(field.read().state.thoughts.length),
            },
          ])
        }
        case 'replace-space': {
          const before = field.read()
          field.dispatch(input)
          if (viewportInitialized && input.state.thoughts.length > 0) {
            centerThoughtsAtDefault(camera, input.state.thoughts, viewport)
          }
          return finish([], field.read() !== before, undefined, true)
        }
        default: {
          const before = field.read()
          field.dispatch(input)
          return finish([], field.read() !== before, undefined, isDurableFieldInput(input))
        }
      }
    },
  }
}

function isDurableFieldInput(input: SpatialInteractionInput) {
  return (
    input.type === 'create-thought' ||
    input.type === 'edit-thought' ||
    input.type === 'delete-selection' ||
    input.type === 'replace-space'
  )
}

function combineSnapshot(
  field: SpatialField,
  camera: CameraState,
  previous?: SpatialInteractionSnapshot,
): SpatialInteractionSnapshot {
  const fieldSnapshot = field.read()
  if (
    previous &&
    previous.state === fieldSnapshot.state &&
    previous.selectedId === fieldSnapshot.selectedId &&
    previous.independentlyMovingThoughtIds === fieldSnapshot.independentlyMovingThoughtIds &&
    previous.attachmentCandidateIds === fieldSnapshot.attachmentCandidateIds &&
    previous.isDragging === fieldSnapshot.isDragging &&
    previous.camera === camera
  ) {
    return previous
  }
  return { ...fieldSnapshot, camera }
}

function thoughtAt(screenPoint: Point, thoughts: Thought[], camera: Pick<SpatialInteraction, 'screenToWorld'>) {
  const worldPoint = camera.screenToWorld(screenPoint)
  return [...thoughts]
    .reverse()
    .find((thought) => Math.hypot(thought.x - worldPoint.x, thought.y - worldPoint.y) <= thoughtRadius(thought.text))
}

function thoughtBounds(thoughts: Thought[]) {
  return thoughts.reduce(
    (result, thought) => {
      const radius = thoughtRadius(thought.text)
      return {
        left: Math.min(result.left, thought.x - radius),
        top: Math.min(result.top, thought.y - radius),
        right: Math.max(result.right, thought.x + radius),
        bottom: Math.max(result.bottom, thought.y + radius),
      }
    },
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  )
}

function centerThoughtsAtDefault(camera: ReturnType<typeof createSpaceCamera>, thoughts: Thought[], viewport: Size) {
  const bounds = thoughtBounds(thoughts)
  const center = {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  }
  camera.dispatch({
    type: 'set-state',
    state: {
      x: viewport.width / 2 - center.x,
      y: viewport.height / 2 - center.y,
      zoom: 1,
    },
  })
}
