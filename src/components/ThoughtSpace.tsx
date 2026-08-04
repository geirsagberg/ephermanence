import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useEffect, useRef } from 'react';

import { createSpaceCamera } from '../spaceCamera';
import { hintForSpace } from '../spaceHint';
import type { SpatialFieldInput } from '../spatialField';
import type { SpaceState, Thought } from '../types';

const palette = [0xf5eadc, 0xe3ece7, 0xe8e2ef, 0xf0e8d7, 0xdfe8ee];

type ThoughtSpaceProps = {
  state: SpaceState;
  selectedId: string | null;
  attachmentCandidateIds: string[];
  isDragging: boolean;
  showHint: boolean;
  onInput: (input: SpatialFieldInput) => void;
  onCreateRequest?: (
    screenPosition: { x: number; y: number },
    worldPosition: { x: number; y: number },
  ) => void;
  onEditRequest?: (thought: Thought, position: { x: number; y: number }) => void;
  onEmptyClick?: () => void;
  className?: string;
};

export function ThoughtSpace({
  state,
  selectedId,
  attachmentCandidateIds,
  isDragging,
  showHint,
  onInput,
  onCreateRequest,
  onEditRequest,
  onEmptyClick,
  className = '',
}: ThoughtSpaceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const camera = useRef(createSpaceCamera()).current;
  const stateRef = useRef(state);
  const attachmentCandidateIdsRef = useRef(new Set(attachmentCandidateIds));
  const onInputRef = useRef(onInput);
  const onCreateRequestRef = useRef(onCreateRequest);
  const onEditRequestRef = useRef(onEditRequest);
  const onEmptyClickRef = useRef(onEmptyClick);

  stateRef.current = state;
  attachmentCandidateIdsRef.current = new Set(attachmentCandidateIds);
  onInputRef.current = onInput;
  onCreateRequestRef.current = onCreateRequest;
  onEditRequestRef.current = onEditRequest;
  onEmptyClickRef.current = onEmptyClick;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let cancelled = false;
    let canvas: (HTMLCanvasElement & { cleanupSpace?: () => void }) | null = null;
    let destroyed = false;
    let pointerPosition: { x: number; y: number } | null = null;
    let renderSpace = () => {};
    const destroyApp = () => {
      if (destroyed) return;
      destroyed = true;
      app.destroy(true, { children: true });
    };

    void app
      .init({
        antialias: true,
        backgroundAlpha: 0,
        resizeTo: host,
        resolution: 1,
        autoDensity: true,
      })
      .then(() => {
        if (cancelled) {
          destroyApp();
          return;
        }
        canvas = app.canvas;
        host.appendChild(canvas);
        canvas.setAttribute('aria-label', 'Interactive space of thought bubbles');

        const layer = new Container();
        app.stage.addChild(layer);

        renderSpace = () => {
          const current = stateRef.current;
          const cameraState = camera.read();
          layer.position.set(cameraState.x, cameraState.y);
          layer.scale.set(cameraState.zoom);
          layer.removeChildren().forEach((child) => child.destroy({ children: true }));

          const positions = new Map(
            current.thoughts.map((thought) => [thought.id, thought]),
          );

          for (const [a, b] of current.attachments) {
            const from = positions.get(a);
            const to = positions.get(b);
            if (!from || !to) continue;
            const bond = new Graphics()
              .moveTo(from.x, from.y)
              .lineTo(to.x, to.y)
              .stroke({ color: 0xa6a99e, width: 10, alpha: 0.16 });
            layer.addChild(bond);
          }

          for (const thought of current.thoughts) {
            const position = positions.get(thought.id)!;
            const isAttachmentCandidate = attachmentCandidateIdsRef.current.has(
              thought.id,
            );
            const bubble = new Container();
            bubble.x = position.x;
            bubble.y = position.y;
            bubble.eventMode = 'static';
            bubble.cursor = 'grab';
            bubble.hitArea = {
              contains: (x: number, y: number) =>
                x * x + y * y <= thought.radius * thought.radius,
            };

            const shadow = new Graphics()
              .circle(3, 7, thought.radius + 3)
              .fill({ color: 0x49504a, alpha: 0.07 });
            const attachmentHalo = isAttachmentCandidate
              ? new Graphics()
                  .circle(0, 0, thought.radius + 7)
                  .fill({ color: 0xf5fff9, alpha: 0.2 })
                  .stroke({ color: 0x718c7d, alpha: 0.68, width: 4 })
              : null;
            const body = new Graphics()
              .circle(0, 0, thought.radius)
              .fill({ color: palette[thought.tone % palette.length], alpha: 0.96 })
              .circle(
                -thought.radius * 0.22,
                -thought.radius * 0.24,
                thought.radius * 0.66,
              )
              .fill({ color: 0xffffff, alpha: 0.15 })
              .circle(0, 0, thought.radius - 1)
              .stroke({ color: 0xffffff, alpha: 0.55, width: 1 });

            const label = new Text({
              text: thought.text,
              style: new TextStyle({
                fontFamily: 'Iowan Old Style, Baskerville, Georgia, serif',
                fontSize: thought.text.length > 48 ? 16 : 17,
                fill: 0x26312d,
                align: 'center',
                lineHeight: 23,
                wordWrap: true,
                wordWrapWidth: thought.radius * 1.42,
              }),
            });
            label.anchor.set(0.5);
            label.resolution = 2;
            if (attachmentHalo) bubble.addChild(attachmentHalo);
            bubble.addChild(shadow, body, label);

            bubble.on('pointerdown', (event) => {
              const point = event.global;
              onInputRef.current({
                type: 'thought-pointer-down',
                id: thought.id,
                point: { x: point.x, y: point.y },
                singular: event.shiftKey,
              });
              bubble.cursor = 'grabbing';
            });
            layer.addChild(bubble);
          }
        };

        const onMove = (event: PointerEvent) => {
          const rect = app.canvas.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          pointerPosition =
            x >= 0 && y >= 0 && x <= rect.width && y <= rect.height ? { x, y } : null;

          const cameraMove = camera.dispatch({ type: 'pointer-move', point: { x, y } });
          if (cameraMove.handled) {
            if (cameraMove.navigated) {
              onInputRef.current({ type: 'clear-selection' });
            }
            renderSpace();
            return;
          }

          onInputRef.current({
            type: 'pointer-move',
            point: { x, y },
            zoom: camera.read().zoom,
          });
        };

        const onUp = () => {
          const cameraUp = camera.dispatch({ type: 'pointer-up' });
          if (cameraUp.handled) {
            if (canvas) canvas.style.cursor = 'pointer';
            return;
          }
          onInputRef.current({ type: 'pointer-up' });
        };

        const onDoubleClick = (event: MouseEvent) => {
          const rect = app.canvas.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const worldPoint = camera.screenToWorld({ x, y });
          const thought = [...stateRef.current.thoughts].reverse().find((candidate) => {
            return (
              Math.hypot(candidate.x - worldPoint.x, candidate.y - worldPoint.y) <=
              candidate.radius
            );
          });
          event.preventDefault();
          if (thought) {
            onInputRef.current({ type: 'clear-selection' });
            onEditRequestRef.current?.(thought, camera.worldToScreen(thought));
            return;
          }
          onCreateRequestRef.current?.({ x, y }, worldPoint);
        };

        const onCanvasClick = (event: MouseEvent) => {
          const rect = app.canvas.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const worldPoint = camera.screenToWorld({ x, y });
          const overThought = stateRef.current.thoughts.some((thought) => {
            return (
              Math.hypot(thought.x - worldPoint.x, thought.y - worldPoint.y) <=
              thought.radius
            );
          });
          if (overThought) return;
          onInputRef.current({ type: 'clear-selection' });
          onEmptyClickRef.current?.();
        };

        const onPointerDown = (event: PointerEvent) => {
          if (event.button !== 0) return;
          const rect = app.canvas.getBoundingClientRect();
          const point = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          };
          const worldPoint = camera.screenToWorld(point);
          const overThought = stateRef.current.thoughts.some((thought) => {
            return (
              Math.hypot(thought.x - worldPoint.x, thought.y - worldPoint.y) <=
              thought.radius
            );
          });
          if (overThought) return;
          camera.dispatch({ type: 'pan-start', point });
          canvas!.style.cursor = 'grabbing';
        };

        const onWheel = (event: WheelEvent) => {
          event.preventDefault();
          const rect = app.canvas.getBoundingClientRect();
          camera.dispatch({
            type: 'wheel',
            point: { x: event.clientX - rect.left, y: event.clientY - rect.top },
            deltaY: event.deltaY,
            pinching: event.ctrlKey,
          });
          onInputRef.current({ type: 'clear-selection' });
          onEmptyClickRef.current?.();
          renderSpace();
        };

        const onKeyDown = (event: KeyboardEvent) => {
          const target = event.target;
          if (
            target instanceof HTMLElement &&
            target.matches('input, textarea, select, button, [contenteditable="true"]')
          ) {
            return;
          }

          if (event.key === 'Enter') {
            if (event.repeat) return;
            event.preventDefault();
            const screenPosition = pointerPosition ?? {
              x: app.screen.width / 2,
              y: app.screen.height / 2,
            };
            onInputRef.current({ type: 'clear-selection' });
            onCreateRequestRef.current?.(
              screenPosition,
              camera.screenToWorld(screenPosition),
            );
            return;
          }

          if (event.key !== '+' && event.key !== '-' && event.key !== '0') return;

          event.preventDefault();
          const center = { x: app.screen.width / 2, y: app.screen.height / 2 };
          camera.dispatch({ type: 'zoom-key', key: event.key, center });
          onInputRef.current({ type: 'clear-selection' });
          onEmptyClickRef.current?.();
          renderSpace();
        };

        const syncViewport = () => {
          camera.dispatch({
            type: 'viewport-resize',
            size: { width: app.screen.width, height: app.screen.height },
          });
          renderSpace();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('keydown', onKeyDown);
        canvas.addEventListener('click', onCanvasClick);
        canvas.addEventListener('dblclick', onDoubleClick);
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        app.renderer.on('resize', syncViewport);
        syncViewport();

        canvas.dataset.cleanup = 'ready';
        Object.assign(canvas, {
          cleanupSpace: () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('keydown', onKeyDown);
            canvas?.removeEventListener('click', onCanvasClick);
            canvas?.removeEventListener('dblclick', onDoubleClick);
            canvas?.removeEventListener('pointerdown', onPointerDown);
            canvas?.removeEventListener('wheel', onWheel);
            app.renderer.off('resize', syncViewport);
          },
        });
      });

    return () => {
      cancelled = true;
      canvas?.cleanupSpace?.();
      if (canvas) destroyApp();
    };
  }, []);

  useEffect(() => {
    const canvas = hostRef.current?.querySelector('canvas');
    if (canvas) window.dispatchEvent(new Event('resize'));
  }, [state, attachmentCandidateIds]);

  const selectedThought = state.thoughts.find((thought) => thought.id === selectedId);
  const hint = showHint ? hintForSpace(state, isDragging) : null;
  const host = hostRef.current;
  const selectedPosition =
    selectedThought && host ? camera.worldToScreen(selectedThought) : null;

  return (
    <div ref={hostRef} className={`thought-space ${className}`}>
      {hint && <p className="empty-space-hint">{hint}</p>}
      {selectedThought && selectedPosition && (
        <>
          <button
            title="Edit thought"
            className="bubble-edit"
            style={{
              left:
                selectedPosition.x - selectedThought.radius * camera.read().zoom * 0.69,
              top:
                selectedPosition.y - selectedThought.radius * camera.read().zoom * 0.69,
            }}
            onClick={() => {
              onInputRef.current({ type: 'clear-selection' });
              onEditRequestRef.current?.(selectedThought, selectedPosition);
            }}
            aria-label={`Edit thought: ${selectedThought.text}`}
          >
            <span aria-hidden="true">✎</span>
          </button>
          <button
            title="Delete thought"
            className="bubble-delete"
            style={{
              left:
                selectedPosition.x + selectedThought.radius * camera.read().zoom * 0.69,
              top:
                selectedPosition.y - selectedThought.radius * camera.read().zoom * 0.69,
            }}
            onClick={() => {
              onInputRef.current({ type: 'delete-selection' });
            }}
            aria-label={`Delete thought: ${selectedThought.text}`}
          >
            ×
          </button>
          <button
            title="Move thought independently"
            className="bubble-grab"
            style={{
              left: selectedPosition.x,
              top:
                selectedPosition.y + selectedThought.radius * camera.read().zoom * 0.99,
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
            <span className="bubble-grab__dots" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
