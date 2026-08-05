import { createSpaceCamera, type CameraState, type Size } from './spaceCamera';
import {
  createSpatialField,
  type Point,
  type SpatialField,
  type SpatialFieldSnapshot,
} from './spatialField';
import { loadStoredSpace, saveStoredSpace, type SpaceStorage } from './spaceStorage';
import type { SpaceState, Thought } from './types';

export type PointerKind = string;

export type SpatialInteractionInput =
  | { type: 'thought-pointer-down'; id: string; point: Point; singular: boolean }
  | { type: 'clear-selection' }
  | { type: 'delete-selection' }
  | { type: 'edit-thought'; id: string; text: string }
  | { type: 'create-thought'; id: string; text: string; position: Point }
  | {
      type: 'canvas-pointer-down';
      point: Point;
      pointerId: number;
      pointerKind: PointerKind;
    }
  | {
      type: 'surface-pointer-move';
      point: Point;
      pointerId: number;
      pointerKind: PointerKind;
      inside: boolean;
    }
  | {
      type: 'surface-pointer-up';
      pointerId: number;
      pointerKind: PointerKind;
    }
  | { type: 'canvas-click'; point: Point }
  | { type: 'canvas-double-click'; point: Point }
  | { type: 'wheel'; point: Point; deltaY: number; pinching: boolean }
  | { type: 'key-down'; key: 'Enter' | '+' | '-' | '0' }
  | { type: 'viewport-resize'; size: Size }
  | { type: 'launcher-open'; point: Point };

export type SpatialInteractionEffect =
  | { type: 'request-create'; screenPosition: Point; worldPosition: Point }
  | { type: 'request-edit'; thought: Thought; screenPosition: Point }
  | { type: 'empty-activated' };

export type SpatialInteractionSnapshot = SpatialFieldSnapshot & {
  camera: CameraState;
};

export type SpatialInteractionTransition = {
  snapshot: SpatialInteractionSnapshot;
  effects: SpatialInteractionEffect[];
  render: boolean;
  cursor?: 'grabbing' | 'pointer';
};

export type SpatialInteraction = {
  read: () => SpatialInteractionSnapshot;
  dispatch: (input: SpatialInteractionInput) => SpatialInteractionTransition;
  screenToWorld: (point: Point) => Point;
  worldToScreen: (point: Point) => Point;
};

export function createSpatialInteraction(
  fallbackState: SpaceState,
  storage: SpaceStorage | null = null,
): SpatialInteraction {
  const camera = createSpaceCamera();
  const initialState = loadStoredSpace(storage) ?? fallbackState;
  const field = createSpatialField(initialState);
  const touchPoints = new Map<number, Point>();
  let pinchGesture = false;
  let pinchActive = false;
  let pointerPosition: Point | null = null;
  let viewport: Size = { width: 0, height: 0 };
  let durableState = initialState;
  let snapshot = combineSnapshot(field, camera.read());

  const finish = (
    effects: SpatialInteractionEffect[] = [],
    render = false,
    cursor?: SpatialInteractionTransition['cursor'],
    commit = false,
  ): SpatialInteractionTransition => {
    snapshot = combineSnapshot(field, camera.read(), snapshot);
    if (
      commit &&
      snapshot.state !== durableState &&
      saveStoredSpace(storage, snapshot.state)
    ) {
      durableState = snapshot.state;
    }
    return { snapshot, effects, render, cursor };
  };

  const clearSelection = () => field.dispatch({ type: 'clear-selection' });

  return {
    read: () => snapshot,
    screenToWorld: camera.screenToWorld,
    worldToScreen: camera.worldToScreen,
    dispatch(input) {
      switch (input.type) {
        case 'canvas-pointer-down': {
          if (input.pointerKind === 'touch') {
            if (touchPoints.size >= 2) return finish();
            touchPoints.set(input.pointerId, input.point);
            if (touchPoints.size === 2) {
              const points = [...touchPoints.values()] as [Point, Point];
              pinchGesture = true;
              pinchActive = true;
              camera.dispatch({ type: 'pointer-up' });
              field.dispatch({ type: 'pointer-up' });
              clearSelection();
              camera.dispatch({ type: 'pinch-start', points });
              return finish([{ type: 'empty-activated' }], true, 'grabbing');
            }
          }

          if (thoughtAt(input.point, field.read().state.thoughts, camera)) {
            return finish();
          }
          camera.dispatch({ type: 'pan-start', point: input.point });
          return finish([], false, 'grabbing');
        }
        case 'surface-pointer-move': {
          pointerPosition = input.inside ? input.point : null;
          if (input.pointerKind === 'touch' && touchPoints.has(input.pointerId)) {
            touchPoints.set(input.pointerId, input.point);
            if (pinchActive) {
              const points = [...touchPoints.values()];
              if (points.length === 2) {
                camera.dispatch({
                  type: 'pinch-move',
                  points: [points[0], points[1]],
                });
                return finish([], true);
              }
            }
            if (pinchGesture) return finish();
          }

          const cameraMove = camera.dispatch({
            type: 'pointer-move',
            point: input.point,
          });
          if (cameraMove.handled) {
            if (cameraMove.navigated) clearSelection();
            return finish([], true);
          }

          const before = field.read();
          field.dispatch({
            type: 'pointer-move',
            point: input.point,
            zoom: camera.read().zoom,
          });
          return finish([], field.read() !== before);
        }
        case 'surface-pointer-up': {
          if (input.pointerKind === 'touch' && touchPoints.has(input.pointerId)) {
            touchPoints.delete(input.pointerId);
            if (pinchGesture) {
              if (pinchActive && touchPoints.size < 2) {
                camera.dispatch({ type: 'pinch-end' });
                pinchActive = false;
              }
              if (touchPoints.size === 0) pinchGesture = false;
              return finish([], false, 'pointer');
            }
          }

          const cameraUp = camera.dispatch({ type: 'pointer-up' });
          if (cameraUp.handled) return finish([], false, 'pointer');
          const before = field.read();
          field.dispatch({ type: 'pointer-up' });
          return finish([], field.read() !== before, 'pointer', true);
        }
        case 'canvas-click': {
          if (thoughtAt(input.point, field.read().state.thoughts, camera)) {
            return finish();
          }
          clearSelection();
          return finish([{ type: 'empty-activated' }]);
        }
        case 'canvas-double-click': {
          const thought = thoughtAt(input.point, field.read().state.thoughts, camera);
          if (thought) {
            clearSelection();
            return finish([
              {
                type: 'request-edit',
                thought,
                screenPosition: camera.worldToScreen(thought),
              },
            ]);
          }
          return finish([
            {
              type: 'request-create',
              screenPosition: input.point,
              worldPosition: camera.screenToWorld(input.point),
            },
          ]);
        }
        case 'wheel': {
          camera.dispatch(input);
          clearSelection();
          return finish([{ type: 'empty-activated' }], true);
        }
        case 'key-down': {
          if (input.key === 'Enter') {
            const screenPosition = pointerPosition ?? {
              x: viewport.width / 2,
              y: viewport.height / 2,
            };
            clearSelection();
            return finish([
              {
                type: 'request-create',
                screenPosition,
                worldPosition: camera.screenToWorld(screenPosition),
              },
            ]);
          }
          const center = { x: viewport.width / 2, y: viewport.height / 2 };
          camera.dispatch({ type: 'zoom-key', key: input.key, center });
          clearSelection();
          return finish([{ type: 'empty-activated' }], true);
        }
        case 'viewport-resize': {
          viewport = input.size;
          camera.dispatch(input);
          return finish([], true);
        }
        case 'launcher-open': {
          clearSelection();
          return finish([
            {
              type: 'request-create',
              screenPosition: input.point,
              worldPosition: camera.screenToWorld(input.point),
            },
          ]);
        }
        default: {
          const before = field.read();
          field.dispatch(input);
          return finish(
            [],
            field.read() !== before,
            undefined,
            isDurableFieldInput(input),
          );
        }
      }
    },
  };
}

function isDurableFieldInput(input: SpatialInteractionInput) {
  return (
    input.type === 'create-thought' ||
    input.type === 'edit-thought' ||
    input.type === 'delete-selection'
  );
}

function combineSnapshot(
  field: SpatialField,
  camera: CameraState,
  previous?: SpatialInteractionSnapshot,
): SpatialInteractionSnapshot {
  const fieldSnapshot = field.read();
  if (
    previous &&
    previous.state === fieldSnapshot.state &&
    previous.selectedId === fieldSnapshot.selectedId &&
    previous.attachmentCandidateIds === fieldSnapshot.attachmentCandidateIds &&
    previous.isDragging === fieldSnapshot.isDragging &&
    previous.camera === camera
  ) {
    return previous;
  }
  return { ...fieldSnapshot, camera };
}

function thoughtAt(
  screenPoint: Point,
  thoughts: Thought[],
  camera: Pick<SpatialInteraction, 'screenToWorld'>,
) {
  const worldPoint = camera.screenToWorld(screenPoint);
  return [...thoughts]
    .reverse()
    .find(
      (thought) =>
        Math.hypot(thought.x - worldPoint.x, thought.y - worldPoint.y) <= thought.radius,
    );
}
