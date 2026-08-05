import { Grip, Pencil, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  defaultAmbientBubbleSettings,
  mountSpatialFieldScene,
  type AmbientBubbleSettings,
  type MountedSpatialFieldScene,
} from '../spatialFieldScene';
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

    void mountSpatialFieldScene(host, interaction, (id, point, singular) => {
      onInputRef.current({ type: 'thought-pointer-down', id, point, singular });
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

  return (
    <div ref={hostRef} className={`thought-space ${className}`}>
      {selectedThought && selectedPosition && actionPositions && (
        <>
          <button
            title="Edit thought"
            className="bubble-edit"
            style={{
              left: actionPositions.edit.x,
              top: actionPositions.edit.y,
              width: THOUGHT_ACTION_SIZE,
              height: THOUGHT_ACTION_SIZE,
            }}
            onClick={() => {
              onInputRef.current({
                type: 'canvas-double-click',
                point: selectedPosition,
              });
            }}
            aria-label={`Edit thought: ${selectedThought.text}`}
          >
            <Pencil size={20} strokeWidth={1} aria-hidden="true" />
          </button>
          <button
            title="Delete thought"
            className="bubble-delete"
            style={{
              left: actionPositions.delete.x,
              top: actionPositions.delete.y,
              width: THOUGHT_ACTION_SIZE,
              height: THOUGHT_ACTION_SIZE,
            }}
            onClick={() => {
              onInputRef.current({ type: 'delete-selection' });
            }}
            aria-label={`Delete thought: ${selectedThought.text}`}
          >
            <X size={20} strokeWidth={1} aria-hidden="true" />
          </button>
          <button
            title="Move thought independently"
            className="bubble-grab"
            style={{
              left: actionPositions.grab.x,
              top: actionPositions.grab.y,
              width: THOUGHT_ACTION_SIZE,
              height: THOUGHT_ACTION_SIZE,
            }}
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
        </>
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
