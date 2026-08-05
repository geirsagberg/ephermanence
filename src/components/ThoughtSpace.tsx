import { Grip, Pencil, X } from 'lucide-react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useEffect, useRef } from 'react';

import {
  AmbientBubbleField,
  defaultAmbientBubbleSettings,
  type AmbientBubbleSettings,
} from '../ambientBubbleField';
import { findFreeComposerPosition } from '../freeComposerPosition';
import type {
  SpatialInteraction,
  SpatialInteractionInput,
  SpatialInteractionSnapshot,
  SpatialInteractionTransition,
} from '../spatialInteraction';
import { ThoughtLauncher } from './ThoughtLauncher';

const palette = [0xf5eadc, 0xe3ece7, 0xe8e2ef, 0xf0e8d7, 0xdfe8ee];

type ThoughtSpaceProps = {
  interaction: SpatialInteraction;
  snapshot: SpatialInteractionSnapshot;
  onInput: (input: SpatialInteractionInput) => SpatialInteractionTransition;
  composerOpen?: boolean;
  ambientBubbleSettings?: AmbientBubbleSettings;
  className?: string;
};

export function ThoughtSpace({
  interaction,
  snapshot,
  onInput,
  composerOpen = false,
  ambientBubbleSettings = defaultAmbientBubbleSettings,
  className = '',
}: ThoughtSpaceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onInputRef = useRef(onInput);
  const ambientBubbleSettingsRef = useRef(ambientBubbleSettings);

  onInputRef.current = onInput;
  ambientBubbleSettingsRef.current = ambientBubbleSettings;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let cancelled = false;
    let canvas: (HTMLCanvasElement & { cleanupSpace?: () => void }) | null = null;
    let destroyed = false;
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
        resolution: window.devicePixelRatio,
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

        const ambientField = new AmbientBubbleField();
        const layer = new Container();
        app.stage.addChild(ambientField, layer);

        renderSpace = () => {
          const currentSnapshot = interaction.read();
          const current = currentSnapshot.state;
          const cameraState = currentSnapshot.camera;
          ambientField.position.set(cameraState.x, cameraState.y);
          ambientField.scale.set(cameraState.zoom);
          layer.position.set(cameraState.x, cameraState.y);
          layer.scale.set(cameraState.zoom);
          const topLeft = interaction.screenToWorld({ x: 0, y: 0 });
          const bottomRight = interaction.screenToWorld({
            x: app.screen.width,
            y: app.screen.height,
          });
          ambientField.update(
            {
              left: topLeft.x,
              right: bottomRight.x,
              top: topLeft.y,
              bottom: bottomRight.y,
            },
            ambientBubbleSettingsRef.current,
          );
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
            const isAttachmentCandidate = currentSnapshot.attachmentCandidateIds.includes(
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
              autoGenerateMipmaps: true,
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
          const rect = app.canvas.getBoundingClientRect();
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
          const rect = app.canvas.getBoundingClientRect();
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
          const rect = app.canvas.getBoundingClientRect();
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
          const rect = app.canvas.getBoundingClientRect();
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
          const transition = onInputRef.current({
            type: 'key-down',
            key: event.key,
          });
          if (transition.render) renderSpace();
        };

        const syncViewport = () => {
          const transition = onInputRef.current({
            type: 'viewport-resize',
            size: { width: app.screen.width, height: app.screen.height },
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
        app.renderer.on('resize', syncViewport);
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
            app.renderer.off('resize', syncViewport);
          },
        });
      });

    return () => {
      cancelled = true;
      canvas?.cleanupSpace?.();
      if (canvas) destroyApp();
    };
  }, [interaction]);

  useEffect(() => {
    const canvas = hostRef.current?.querySelector('canvas');
    if (canvas) window.dispatchEvent(new Event('resize'));
  }, [snapshot.state, snapshot.attachmentCandidateIds, ambientBubbleSettings]);

  const selectedThought = snapshot.state.thoughts.find(
    (thought) => thought.id === snapshot.selectedId,
  );
  const host = hostRef.current;
  const selectedPosition =
    selectedThought && host ? interaction.worldToScreen(selectedThought) : null;
  const zoom = snapshot.camera.zoom;

  return (
    <div ref={hostRef} className={`thought-space ${className}`}>
      {selectedThought && selectedPosition && (
        <>
          <button
            title="Edit thought"
            className="bubble-edit"
            style={{
              left: selectedPosition.x - selectedThought.radius * zoom * 0.69,
              top: selectedPosition.y - selectedThought.radius * zoom * 0.69,
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
              left: selectedPosition.x + selectedThought.radius * zoom * 0.69,
              top: selectedPosition.y - selectedThought.radius * zoom * 0.69,
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
              left: selectedPosition.x,
              top: selectedPosition.y + selectedThought.radius * zoom * 0.99,
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
        getTapPosition={() => {
          const current = interaction.read();
          const currentZoom = current.camera.zoom;
          return findFreeComposerPosition({
            thoughts: current.state.thoughts.map((thought) => ({
              ...interaction.worldToScreen(thought),
              radius: thought.radius * currentZoom,
            })),
            viewport: { width: window.innerWidth, height: window.innerHeight },
            zoom: currentZoom,
          });
        }}
        onOpen={(screenPosition) => {
          onInputRef.current({ type: 'launcher-open', point: screenPosition });
        }}
      />
    </div>
  );
}
