export type Point = { x: number; y: number };

export type CameraState = {
  x: number;
  y: number;
  zoom: number;
};

export type CameraInput =
  | { type: 'pan-start'; point: Point }
  | { type: 'pointer-move'; point: Point }
  | { type: 'pointer-up' }
  | { type: 'wheel'; point: Point; deltaY: number }
  | { type: 'zoom-key'; key: '+' | '-' | '0'; center: Point };

export type CameraTransition = {
  state: CameraState;
  handled: boolean;
  navigated: boolean;
};

type Pan = {
  distance: number;
  lastPoint: Point;
};

export type SpaceCamera = {
  read: () => CameraState;
  dispatch: (input: CameraInput) => CameraTransition;
  screenToWorld: (point: Point) => Point;
  worldToScreen: (point: Point) => Point;
};

export function createSpaceCamera(
  initialState: CameraState = { x: 0, y: 0, zoom: 1 },
): SpaceCamera {
  let state = initialState;
  let pan: Pan | null = null;

  const screenToWorld = (point: Point) => ({
    x: (point.x - state.x) / state.zoom,
    y: (point.y - state.y) / state.zoom,
  });

  const worldToScreen = (point: Point) => ({
    x: point.x * state.zoom + state.x,
    y: point.y * state.zoom + state.y,
  });

  const zoomAt = (point: Point, requestedZoom: number) => {
    const zoom = Math.max(0.3, Math.min(3, requestedZoom));
    const worldPoint = screenToWorld(point);
    state = {
      x: point.x - worldPoint.x * zoom,
      y: point.y - worldPoint.y * zoom,
      zoom,
    };
  };

  return {
    read: () => state,
    screenToWorld,
    worldToScreen,
    dispatch(input) {
      switch (input.type) {
        case 'pan-start': {
          pan = { distance: 0, lastPoint: input.point };
          return { state, handled: true, navigated: false };
        }
        case 'pointer-move': {
          if (!pan) return { state, handled: false, navigated: false };
          const dx = input.point.x - pan.lastPoint.x;
          const dy = input.point.y - pan.lastPoint.y;
          pan.distance += Math.hypot(dx, dy);
          pan.lastPoint = input.point;
          state = { ...state, x: state.x + dx, y: state.y + dy };
          return { state, handled: true, navigated: pan.distance >= 4 };
        }
        case 'pointer-up': {
          if (!pan) return { state, handled: false, navigated: false };
          pan = null;
          return { state, handled: true, navigated: false };
        }
        case 'wheel': {
          zoomAt(input.point, state.zoom * Math.exp(-input.deltaY * 0.0015));
          return { state, handled: true, navigated: true };
        }
        case 'zoom-key': {
          const factor = input.key === '+' ? 1.2 : input.key === '-' ? 1 / 1.2 : 1;
          zoomAt(input.center, input.key === '0' ? 1 : state.zoom * factor);
          return { state, handled: true, navigated: true };
        }
      }
    },
  };
}
