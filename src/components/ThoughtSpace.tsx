import { Grip, Pencil, X } from 'lucide-react';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { css, cx } from '../../styled-system/css';

import {
  defaultAmbientBubbleSettings,
  mountSpatialFieldScene,
  type AmbientBubbleSettings,
  type MountedSpatialFieldScene,
} from '../spatialFieldScene';
import { createPointerActivationGuard } from '../pointerActivation';
import { createSingleThoughtLongPress } from '../singleThoughtLongPress';
import type {
  SpatialInteraction,
  SpatialInteractionInput,
  SpatialInteractionSnapshot,
  SpatialInteractionTransition,
} from '../spatialInteraction';
import type { ThoughtAuthoring } from '../thoughtAuthoring';
import { positionThoughtActions, THOUGHT_ACTION_SIZE } from '../thoughtActions';
import { getThoughtTone } from '../thoughtTone';
import { ThoughtLauncher } from './ThoughtLauncher';

type ThoughtSpaceProps = {
  interaction: SpatialInteraction;
  snapshot: SpatialInteractionSnapshot;
  onInput: (input: SpatialInteractionInput) => SpatialInteractionTransition;
  findFreePosition: ThoughtAuthoring['findFreePosition'];
  composerOpen?: boolean;
  editingThoughtId?: string;
  ambientBubbleSettings?: AmbientBubbleSettings;
  className?: string;
};

export function ThoughtSpace({
  interaction,
  snapshot,
  onInput,
  findFreePosition,
  composerOpen = false,
  editingThoughtId,
  ambientBubbleSettings = defaultAmbientBubbleSettings,
  className = '',
}: ThoughtSpaceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [launchRequest, setLaunchRequest] = useState(0);
  const onInputRef = useRef(onInput);
  const ambientBubbleSettingsRef = useRef(ambientBubbleSettings);
  const editingThoughtIdRef = useRef(editingThoughtId);
  const actionActivationRef = useRef(createPointerActivationGuard());
  const singleThoughtLongPressRef = useRef(
    createSingleThoughtLongPress(({ id, point }) => {
      onInputRef.current({ type: 'thought-pointer-down', id, point, singular: true });
    }),
  );

  onInputRef.current = onInput;
  ambientBubbleSettingsRef.current = ambientBubbleSettings;
  editingThoughtIdRef.current = editingThoughtId;
  const getNewThoughtPosition = () => {
    const current = interaction.read();
    const currentZoom = current.camera.zoom;
    return findFreePosition({
      thoughts: current.state.thoughts.map((thought) => ({
        ...interaction.worldToScreen(thought),
        radius: thought.radius * currentZoom,
      })),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      zoom: currentZoom,
    });
  };
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let canvas: (HTMLCanvasElement & { cleanupSpace?: () => void }) | null = null;
    let scene: MountedSpatialFieldScene | null = null;
    let destroyed = false;
    let renderSpace = () => {};
    const destroyScene = () => {
      if (destroyed) return;
      destroyed = true;
      scene?.destroy();
    };

    void mountSpatialFieldScene(host, interaction, (id, point, singular, pointerId) => {
      onInputRef.current({ type: 'thought-pointer-down', id, point, singular });
      if (singular) {
        singleThoughtLongPressRef.current.cancel();
      } else {
        singleThoughtLongPressRef.current.begin({ id, point, pointerId });
      }
    }).then((mountedScene) => {
      scene = mountedScene;
      if (cancelled) {
        destroyScene();
        return;
      }
      canvas = mountedScene.canvas;
      renderSpace = () =>
        mountedScene.render(
          ambientBubbleSettingsRef.current,
          editingThoughtIdRef.current,
        );

      const onMove = (event: PointerEvent) => {
        const rect = mountedScene.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        singleThoughtLongPressRef.current.move(event.pointerId, { x, y });
        const transition = onInputRef.current({
          type: 'surface-pointer-move',
          point: { x, y },
          pointerId: event.pointerId,
          pointerKind: event.pointerType,
          inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height,
        });
        if (transition.cursor && canvas) canvas.style.cursor = transition.cursor;
        if (transition.render) renderSpace();
      };

      const onUp = (event: PointerEvent) => {
        singleThoughtLongPressRef.current.end(event.pointerId);
        const transition = onInputRef.current({
          type: 'surface-pointer-up',
          pointerId: event.pointerId,
          pointerKind: event.pointerType,
        });
        if (transition.cursor && canvas) canvas.style.cursor = transition.cursor;
        if (transition.render) renderSpace();
      };

      const onDoubleClick = (event: MouseEvent) => {
        const rect = mountedScene.canvas.getBoundingClientRect();
        onInputRef.current({
          type: 'canvas-double-click',
          point: {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
        });
        event.preventDefault();
      };

      const onCanvasClick = (event: MouseEvent) => {
        const rect = mountedScene.canvas.getBoundingClientRect();
        onInputRef.current({
          type: 'canvas-click',
          point: {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
        });
      };

      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        singleThoughtLongPressRef.current.cancelForOtherPointer(event.pointerId);
        const rect = mountedScene.canvas.getBoundingClientRect();
        const point = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };

        const transition = onInputRef.current({
          type: 'canvas-pointer-down',
          point,
          pointerId: event.pointerId,
          pointerKind: event.pointerType,
        });
        if (transition.cursor) canvas!.style.cursor = transition.cursor;
        if (event.pointerType === 'touch' && transition.render) {
          event.preventDefault();
        }
        if (transition.render) renderSpace();
      };

      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const rect = mountedScene.canvas.getBoundingClientRect();
        const transition = onInputRef.current({
          type: 'wheel',
          point: { x: event.clientX - rect.left, y: event.clientY - rect.top },
          deltaY: event.deltaY,
          pinching: event.ctrlKey,
        });
        if (transition.render) renderSpace();
      };

      const onKeyDown = (event: KeyboardEvent) => {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          target.matches('input, textarea, select, button, [contenteditable="true"]')
        ) {
          return;
        }

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
          setLaunchRequest((request) => request + 1);
          return;
        }
        const transition = onInputRef.current({ type: 'key-down', key: event.key });
        if (transition.render) renderSpace();
      };

      const syncViewport = () => {
        const transition = onInputRef.current({
          type: 'viewport-resize',
          size: {
            width: mountedScene.screen.width,
            height: mountedScene.screen.height,
          },
        });
        if (transition.render) renderSpace();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      window.addEventListener('keydown', onKeyDown);
      canvas.addEventListener('click', onCanvasClick);
      canvas.addEventListener('dblclick', onDoubleClick);
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      const stopResize = mountedScene.onResize(syncViewport);
      syncViewport();

      canvas.dataset.cleanup = 'ready';
      Object.assign(canvas, {
        cleanupSpace: () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
          window.removeEventListener('keydown', onKeyDown);
          canvas?.removeEventListener('click', onCanvasClick);
          canvas?.removeEventListener('dblclick', onDoubleClick);
          canvas?.removeEventListener('pointerdown', onPointerDown);
          canvas?.removeEventListener('wheel', onWheel);
          singleThoughtLongPressRef.current.cancel();
          stopResize();
        },
      });
    });

    return () => {
      cancelled = true;
      canvas?.cleanupSpace?.();
      if (scene) destroyScene();
    };
  }, [interaction]);

  useEffect(() => {
    const canvas = hostRef.current?.querySelector('canvas');
    if (canvas) window.dispatchEvent(new Event('resize'));
  }, [
    snapshot.state,
    snapshot.attachmentCandidateIds,
    ambientBubbleSettings,
    editingThoughtId,
  ]);

  const selectedThought = snapshot.state.thoughts.find(
    (thought) => thought.id === snapshot.selectedId,
  );
  const host = hostRef.current;
  const selectedPosition =
    selectedThought && host ? interaction.worldToScreen(selectedThought) : null;
  const zoom = snapshot.camera.zoom;
  const actionPositions =
    selectedThought && selectedPosition
      ? positionThoughtActions(selectedPosition, selectedThought.radius * zoom)
      : null;
  const armAction = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    actionActivationRef.current.begin(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  };
  const completeAction = (
    event: ReactPointerEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (
      actionActivationRef.current.complete(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })
    ) {
      action();
    }
  };
  const cancelAction = (event: ReactPointerEvent<HTMLButtonElement>) => {
    actionActivationRef.current.cancel(event.pointerId);
  };
  const activateFromKeyboard = (
    event: ReactMouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    if (event.detail !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  return (
    <div ref={hostRef} className={cx(thoughtSpaceClass, className)}>
      {selectedThought && selectedPosition && actionPositions && (
        <Fragment key={selectedThought.id}>
          <button
            title="Edit thought"
            className={cx(actionButtonClass, directActionButtonClass)}
            style={actionStyle(selectedPosition, actionPositions.edit)}
            onPointerDown={armAction}
            onPointerUp={(event) => {
              completeAction(event, () => {
                onInputRef.current({
                  type: 'canvas-double-click',
                  point: selectedPosition,
                });
              });
            }}
            onPointerCancel={cancelAction}
            onClick={(event) => {
              activateFromKeyboard(event, () => {
                onInputRef.current({
                  type: 'canvas-double-click',
                  point: selectedPosition,
                });
              });
            }}
            aria-label={`Edit thought: ${selectedThought.text}`}
          >
            <Pencil size={20} strokeWidth={1} aria-hidden="true" />
          </button>
          <button
            title="Delete thought"
            className={cx(actionButtonClass, directActionButtonClass)}
            style={actionStyle(selectedPosition, actionPositions.delete)}
            onPointerDown={armAction}
            onPointerUp={(event) => {
              completeAction(event, () => {
                onInputRef.current({ type: 'delete-selection' });
              });
            }}
            onPointerCancel={cancelAction}
            onClick={(event) => {
              activateFromKeyboard(event, () => {
                onInputRef.current({ type: 'delete-selection' });
              });
            }}
            aria-label={`Delete thought: ${selectedThought.text}`}
          >
            <X size={20} strokeWidth={1} aria-hidden="true" />
          </button>
          <button
            title="Move thought independently"
            className={cx(actionButtonClass, grabActionButtonClass)}
            style={actionStyle(selectedPosition, actionPositions.grab)}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const canvas = hostRef.current?.querySelector('canvas');
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              onInputRef.current({
                type: 'thought-pointer-down',
                id: selectedThought.id,
                point: {
                  x: event.clientX - rect.left,
                  y: event.clientY - rect.top,
                },
                singular: true,
              });
            }}
            aria-label={`Move thought independently: ${selectedThought.text}`}
          >
            <Grip size={20} strokeWidth={1} aria-hidden="true" />
          </button>
        </Fragment>
      )}
      <ThoughtLauncher
        composerOpen={composerOpen}
        getTapPosition={getNewThoughtPosition}
        launchRequest={launchRequest}
        toneColor={getThoughtTone(snapshot.state.thoughts.length).css}
        onOpen={(screenPosition) => {
          onInputRef.current({ type: 'launcher-open', point: screenPosition });
        }}
      />
    </div>
  );
}

const thoughtSpaceClass = css({
  position: 'absolute',
  inset: 0,
  touchAction: 'none',
  '& canvas': {
    display: 'block',
    width: '100%',
    height: '100%',
    cursor: 'grab',
    WebkitTapHighlightColor: 'transparent',
  },
});

const actionButtonClass = css({
  position: 'absolute',
  zIndex: 6,
  display: 'grid',
  placeItems: 'center',
  padding: 0,
  appearance: 'none',
  border: '1px solid rgb(39 48 44 / 18%)',
  borderRadius: '50%',
  background: '#fff',
  boxShadow: '0 5px 16px rgb(45 52 48 / 14%)',
  color: 'rgb(39 48 44 / 72%)',
  transform: 'translate(-50%, -50%)',
  animation: 'bubbleActionEnter 160ms cubic-bezier(0.2, 0.82, 0.2, 1) both',
  backdropFilter: 'blur(10px)',
  WebkitTapHighlightColor: 'transparent',
  _hover: {
    color: '#28312d',
  },
  _focus: {
    background: '#f1efe8',
  },
});

const directActionButtonClass = css({
  cursor: 'pointer',
});

const grabActionButtonClass = css({
  cursor: 'grab',
  _active: {
    cursor: 'grabbing',
  },
});

type ActionStyle = CSSProperties &
  Record<'--action-origin-x' | '--action-origin-y', string>;

function actionStyle(
  center: { x: number; y: number },
  position: { x: number; y: number },
): ActionStyle {
  return {
    left: position.x,
    top: position.y,
    width: THOUGHT_ACTION_SIZE,
    height: THOUGHT_ACTION_SIZE,
    '--action-origin-x': `${center.x - position.x}px`,
    '--action-origin-y': `${center.y - position.y}px`,
  };
}
