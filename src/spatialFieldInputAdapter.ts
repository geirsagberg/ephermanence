import type {
  AmbientBubbleSettings,
  MountedSpatialFieldScene,
} from './spatialFieldScene';
import {
  defaultAmbientBubbleSettings,
  mountSpatialFieldScene,
} from './spatialFieldScene';
import type {
  SpatialInteraction,
  SpatialInteractionEffect,
  SpatialInteractionInput,
  SpatialInteractionSnapshot,
  SpatialInteractionTransition,
} from './spatialInteraction';
import type { Point } from './spatialField';
import type { ThoughtAuthoringCommand } from './thoughtAuthoring';

export type SpatialFieldPresentation = {
  ambientBubbleSettings: AmbientBubbleSettings;
  hiddenThoughtId?: string;
};

export type ThoughtControl = 'edit' | 'delete' | 'grab';

export type ThoughtControlEvent = {
  phase: 'pointer-down' | 'pointer-up' | 'pointer-cancel' | 'keyboard-activate';
  pointerId?: number;
  pointerKind?: string;
  clientPoint?: Point;
  timeStamp: number;
  clickDetail?: number;
  consume: () => void;
  capturePointer?: () => void;
};

export type SpatialFieldAdapterInput =
  | { type: 'present'; presentation: SpatialFieldPresentation }
  | { type: 'authoring-command'; command: ThoughtAuthoringCommand }
  | { type: 'launcher-open'; point: Point }
  | {
      type: 'thought-control';
      thoughtId: string;
      control: ThoughtControl;
      event: ThoughtControlEvent;
    };

export type SpatialFieldFrame = {
  snapshot: SpatialInteractionSnapshot;
  effects: SpatialInteractionEffect[];
  launchRequests: number;
};

type EventSource = Pick<
  Window,
  'addEventListener' | 'removeEventListener' | 'innerWidth' | 'innerHeight'
>;

export type SpatialFieldInputRuntime = {
  mountScene: typeof mountSpatialFieldScene;
  events: EventSource;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
  setDelay: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearDelay: (handle: ReturnType<typeof setTimeout>) => void;
};

export type SpatialFieldInputAdapter = {
  mount: (host: HTMLElement) => () => void;
  send: (input: SpatialFieldAdapterInput) => void;
};

type AdapterOptions = {
  interaction: SpatialInteraction;
  onFrame: (frame: SpatialFieldFrame) => void;
  onFailure: (error: unknown) => void;
  runtime?: SpatialFieldInputRuntime;
};

type Activation = { pointerId: number; start: Point };
type PointerGesture = { distance: number; lastPoint: Point };
type LongPress = {
  id: string;
  pointerId: number;
  distance: number;
  lastPoint: Point;
  timer: ReturnType<typeof setTimeout> | null;
};

const actionMovementThreshold = 7;
const gestureMovementThreshold = 4;
const longPressMovementThreshold = 4;
const longPressDelay = 450;
const controlClickWindow = 750;

export function createSpatialFieldInputAdapter({
  interaction,
  onFrame,
  onFailure,
  runtime = browserRuntime(),
}: AdapterOptions): SpatialFieldInputAdapter {
  let mountGeneration = 0;
  let mounted = false;
  let scene: MountedSpatialFieldScene | null = null;
  let stopResize = () => {};
  let presentation: SpatialFieldPresentation = {
    ambientBubbleSettings: defaultAmbientBubbleSettings,
  };
  let renderedPresentation: SpatialFieldPresentation | null = null;
  let renderedSnapshot: SpatialInteractionSnapshot | null = null;
  let activation: Activation | null = null;
  const pointerGestures = new Map<number, PointerGesture>();
  let suppressDoubleClick = false;
  let longPress: LongPress | null = null;
  let controlClickArmedAt: number | null = null;
  let frameHandle: number | null = null;
  let pendingEffects: SpatialInteractionEffect[] = [];
  let pendingLaunchRequests = 0;

  const cancelLongPress = () => {
    if (longPress?.timer !== null && longPress?.timer !== undefined) {
      runtime.clearDelay(longPress.timer);
    }
    longPress = null;
  };

  const scheduleFrame = () => {
    if (!mounted || frameHandle !== null) return;
    frameHandle = runtime.requestFrame(() => {
      frameHandle = null;
      if (!mounted) return;
      const effects = pendingEffects;
      const launchRequests = pendingLaunchRequests;
      pendingEffects = [];
      pendingLaunchRequests = 0;
      onFrame({ snapshot: interaction.read(), effects, launchRequests });
    });
  };

  const render = () => {
    if (!scene) return;
    scene.render(presentation.ambientBubbleSettings, presentation.hiddenThoughtId);
    renderedPresentation = presentation;
    renderedSnapshot = interaction.read();
  };

  const finishTransition = (transition: SpatialInteractionTransition) => {
    if (transition.cursor && scene) scene.canvas.style.cursor = transition.cursor;
    if (transition.render) render();
    if (transition.effects.length > 0) pendingEffects.push(...transition.effects);
    scheduleFrame();
    return transition;
  };

  const dispatch = (input: SpatialInteractionInput) =>
    finishTransition(interaction.dispatch(input));

  const pointInCanvas = (point: Point) => {
    if (!scene) return point;
    const rect = scene.canvas.getBoundingClientRect();
    return { x: point.x - rect.left, y: point.y - rect.top };
  };

  const activateControl = (control: ThoughtControl, thoughtId: string) => {
    if (control === 'delete') {
      dispatch({ type: 'delete-selection' });
      return;
    }
    if (control === 'edit') {
      const thought = interaction
        .read()
        .state.thoughts.find(({ id }) => id === thoughtId);
      if (!thought) return;
      dispatch({
        type: 'canvas-double-click',
        point: interaction.worldToScreen(thought),
      });
    }
  };

  const sendControl = (
    control: ThoughtControl,
    thoughtId: string,
    event: ThoughtControlEvent,
  ) => {
    event.consume();
    if (event.phase === 'pointer-down') {
      if (event.pointerId === undefined || !event.clientPoint) return;
      event.capturePointer?.();
      if (control === 'grab') {
        dispatch({
          type: 'thought-pointer-down',
          id: thoughtId,
          point: pointInCanvas(event.clientPoint),
          singular: true,
          detachOnTap: true,
        });
      } else {
        activation = { pointerId: event.pointerId, start: event.clientPoint };
      }
      return;
    }

    if (event.phase === 'pointer-cancel') {
      activation = null;
      controlClickArmedAt = null;
      if (control === 'grab' && event.pointerId !== undefined) {
        dispatch({
          type: 'surface-pointer-up',
          pointerId: event.pointerId,
          pointerKind: event.pointerKind ?? '',
        });
      }
      return;
    }

    if (event.phase === 'keyboard-activate') {
      if (event.clickDetail !== 0) {
        controlClickArmedAt = null;
        return;
      }
      activateControl(control, thoughtId);
      return;
    }

    if (event.pointerKind !== 'mouse') controlClickArmedAt = event.timeStamp;
    if (control === 'grab') {
      if (event.pointerId !== undefined) {
        dispatch({
          type: 'surface-pointer-up',
          pointerId: event.pointerId,
          pointerKind: event.pointerKind ?? '',
        });
      }
      return;
    }
    if (event.pointerId === undefined || !event.clientPoint) return;
    const current = activation;
    activation = null;
    if (
      current?.pointerId === event.pointerId &&
      Math.hypot(
        event.clientPoint.x - current.start.x,
        event.clientPoint.y - current.start.y,
      ) <= actionMovementThreshold
    ) {
      activateControl(control, thoughtId);
    }
  };

  const beginLongPress = (id: string, point: Point, pointerId: number) => {
    if (longPress) return;
    longPress = {
      id,
      pointerId,
      distance: 0,
      lastPoint: point,
      timer: runtime.setDelay(() => {
        if (!longPress) return;
        const pending = longPress;
        pending.timer = null;
        dispatch({
          type: 'thought-pointer-down',
          id: pending.id,
          point: pending.lastPoint,
          singular: true,
        });
      }, longPressDelay),
    };
  };

  const onThoughtPointerDown = (
    id: string,
    point: Point,
    singular: boolean,
    pointerId: number,
  ) => {
    if (!pointerGestures.has(pointerId)) {
      pointerGestures.set(pointerId, { distance: 0, lastPoint: point });
    }
    dispatch({ type: 'thought-pointer-down', id, point, singular });
    if (singular) cancelLongPress();
    else beginLongPress(id, point, pointerId);
  };

  const attachListeners = (mountedScene: MountedSpatialFieldScene) => {
    const { canvas } = mountedScene;
    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const gesture = pointerGestures.get(event.pointerId);
      if (gesture) {
        gesture.distance += Math.hypot(
          point.x - gesture.lastPoint.x,
          point.y - gesture.lastPoint.y,
        );
        gesture.lastPoint = point;
      }
      if (longPress?.pointerId === event.pointerId) {
        longPress.distance += Math.hypot(
          point.x - longPress.lastPoint.x,
          point.y - longPress.lastPoint.y,
        );
        longPress.lastPoint = point;
        if (longPress.distance >= longPressMovementThreshold) cancelLongPress();
      }
      dispatch({
        type: 'surface-pointer-move',
        point,
        pointerId: event.pointerId,
        pointerKind: event.pointerType,
      });
    };
    const onUp = (event: PointerEvent) => {
      if (longPress?.pointerId === event.pointerId) cancelLongPress();
      const gesture = pointerGestures.get(event.pointerId);
      if (gesture?.distance && gesture.distance >= gestureMovementThreshold) {
        suppressDoubleClick = true;
      }
      pointerGestures.delete(event.pointerId);
      dispatch({
        type: 'surface-pointer-up',
        pointerId: event.pointerId,
        pointerKind: event.pointerType,
      });
    };
    const onClick = (event: MouseEvent) => {
      const armedAt = controlClickArmedAt;
      controlClickArmedAt = null;
      if (
        armedAt !== null &&
        event.timeStamp >= armedAt &&
        event.timeStamp - armedAt <= controlClickWindow
      ) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      dispatch({
        type: 'canvas-click',
        point: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      });
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (suppressDoubleClick) {
        suppressDoubleClick = false;
        event.preventDefault();
        return;
      }
      const rect = canvas.getBoundingClientRect();
      dispatch({
        type: 'canvas-double-click',
        point: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      });
      event.preventDefault();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      suppressDoubleClick = false;
      if (longPress && longPress.pointerId !== event.pointerId) cancelLongPress();
      const rect = canvas.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      pointerGestures.set(event.pointerId, { distance: 0, lastPoint: point });
      const transition = dispatch({
        type: 'canvas-pointer-down',
        point,
        pointerId: event.pointerId,
        pointerKind: event.pointerType,
      });
      if (event.pointerType === 'touch' && transition.render) event.preventDefault();
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      dispatch({
        type: 'wheel',
        point: { x: event.clientX - rect.left, y: event.clientY - rect.top },
        deltaY: event.deltaY,
        pinching: event.ctrlKey,
      });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (
        event.key !== 'Enter' &&
        event.key !== '+' &&
        event.key !== '-' &&
        event.key !== '0'
      ) {
        return;
      }
      if (event.key === 'Enter' && event.repeat) return;
      event.preventDefault();
      if (event.key === 'Enter') {
        pendingLaunchRequests += 1;
        scheduleFrame();
      } else {
        dispatch({ type: 'key-down', key: event.key });
      }
    };
    const syncViewport = () => {
      dispatch({
        type: 'viewport-resize',
        size: { width: mountedScene.screen.width, height: mountedScene.screen.height },
      });
    };

    runtime.events.addEventListener('pointermove', onMove as EventListener);
    runtime.events.addEventListener('pointerup', onUp as EventListener);
    runtime.events.addEventListener('pointercancel', onUp as EventListener);
    runtime.events.addEventListener('keydown', onKeyDown as EventListener);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('dblclick', onDoubleClick);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    stopResize = mountedScene.onResize(syncViewport);
    syncViewport();

    return () => {
      runtime.events.removeEventListener('pointermove', onMove as EventListener);
      runtime.events.removeEventListener('pointerup', onUp as EventListener);
      runtime.events.removeEventListener('pointercancel', onUp as EventListener);
      runtime.events.removeEventListener('keydown', onKeyDown as EventListener);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('dblclick', onDoubleClick);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('wheel', onWheel);
      stopResize();
      stopResize = () => {};
    };
  };

  let detachListeners = () => {};
  const unmount = (generation: number) => {
    if (generation !== mountGeneration || !mounted) return;
    mounted = false;
    detachListeners();
    detachListeners = () => {};
    cancelLongPress();
    pointerGestures.clear();
    suppressDoubleClick = false;
    activation = null;
    controlClickArmedAt = null;
    if (frameHandle !== null) runtime.cancelFrame(frameHandle);
    frameHandle = null;
    pendingEffects = [];
    pendingLaunchRequests = 0;
    scene?.destroy();
    scene = null;
    renderedPresentation = null;
    renderedSnapshot = null;
  };

  return {
    mount(host) {
      if (mounted) {
        onFailure(new Error('Spatial field input adapter is already mounted'));
        return () => {};
      }
      mounted = true;
      mountGeneration += 1;
      const generation = mountGeneration;
      void runtime
        .mountScene(host, interaction, onThoughtPointerDown)
        .then((mountedScene) => {
          if (!mounted || generation !== mountGeneration) {
            mountedScene.destroy();
            return;
          }
          scene = mountedScene;
          detachListeners = attachListeners(mountedScene);
          if (
            renderedSnapshot !== interaction.read() ||
            !samePresentation(renderedPresentation, presentation)
          ) {
            render();
          }
          scheduleFrame();
        })
        .catch((error: unknown) => {
          if (!mounted || generation !== mountGeneration) return;
          unmount(generation);
          onFailure(error);
        });
      return () => unmount(generation);
    },
    send(input) {
      if (input.type === 'present') {
        if (samePresentation(presentation, input.presentation)) return;
        presentation = input.presentation;
        if (
          renderedSnapshot !== interaction.read() ||
          !samePresentation(renderedPresentation, presentation)
        ) {
          render();
        }
        return;
      }
      if (input.type === 'thought-control') {
        sendControl(input.control, input.thoughtId, input.event);
        return;
      }
      dispatch(
        input.type === 'launcher-open'
          ? { type: 'launcher-open', point: input.point }
          : input.command,
      );
    },
  };
}

function samePresentation(
  left: SpatialFieldPresentation | null,
  right: SpatialFieldPresentation,
) {
  return (
    left?.hiddenThoughtId === right.hiddenThoughtId &&
    left?.ambientBubbleSettings.size === right.ambientBubbleSettings.size &&
    left.ambientBubbleSettings.presence === right.ambientBubbleSettings.presence &&
    left.ambientBubbleSettings.density === right.ambientBubbleSettings.density
  );
}

function isEditableTarget(target: EventTarget | null) {
  return (
    typeof HTMLElement !== 'undefined' &&
    target instanceof HTMLElement &&
    target.matches('input, textarea, select, button, [contenteditable="true"]')
  );
}

function browserRuntime(): SpatialFieldInputRuntime {
  return {
    mountScene: mountSpatialFieldScene,
    events: window,
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
    setDelay: (callback, delay) => window.setTimeout(callback, delay),
    clearDelay: (handle) => window.clearTimeout(handle),
  };
}
