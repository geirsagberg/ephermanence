import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';

import {
  bringThoughtToFront,
  deleteThought,
  getMovingThoughtIds,
  recalculateAttachments,
  translateThoughts,
} from '../spaceInteractions';
import type { SpaceState, Thought } from '../types';

const palette = [0xf5eadc, 0xe3ece7, 0xe8e2ef, 0xf0e8d7, 0xdfe8ee];

type ThoughtSpaceProps = {
  state: SpaceState;
  onChange: (state: SpaceState) => void;
  onCreateRequest?: (position: { x: number; y: number }) => void;
  onEditRequest?: (thought: Thought, position: { x: number; y: number }) => void;
  onEmptyClick?: () => void;
  className?: string;
};

type DragState = {
  activeId: string;
  distance: number;
  lastX: number;
  lastY: number;
  movingIds: Set<string>;
  singular: boolean;
};

function bubblePosition(thought: Thought, width: number, height: number) {
  return {
    x: thought.x <= 1 ? thought.x * width : thought.x,
    y: thought.y <= 1 ? thought.y * height : thought.y,
  };
}

export function ThoughtSpace({
  state,
  onChange,
  onCreateRequest,
  onEditRequest,
  onEmptyClick,
  className = '',
}: ThoughtSpaceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stateRef = useRef(state);
  const onChangeRef = useRef(onChange);
  const onCreateRequestRef = useRef(onCreateRequest);
  const onEditRequestRef = useRef(onEditRequest);
  const onEmptyClickRef = useRef(onEmptyClick);

  stateRef.current = state;
  onChangeRef.current = onChange;
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
    let drag: DragState | null = null;
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
          const width = app.screen.width;
          const height = app.screen.height;
          layer.removeChildren().forEach((child) => child.destroy({ children: true }));

          const positions = new Map(
            current.thoughts.map((thought) => [
              thought.id,
              bubblePosition(thought, width, height),
            ]),
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
            bubble.addChild(shadow, body, label);

            bubble.on('pointerdown', (event) => {
              const point = event.global;
              const singular = event.shiftKey;
              drag = {
                activeId: thought.id,
                distance: 0,
                lastX: point.x,
                lastY: point.y,
                movingIds: getMovingThoughtIds(thought.id, current.attachments, singular),
                singular,
              };
              bubble.cursor = 'grabbing';
            });
            layer.addChild(bubble);
          }
        };

        const onMove = (event: PointerEvent) => {
          if (!drag) return;
          const rect = app.canvas.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const dx = x - drag.lastX;
          const dy = y - drag.lastY;
          drag.distance += Math.hypot(dx, dy);
          if (drag.distance >= 4) setSelectedId(null);
          drag.lastX = x;
          drag.lastY = y;

          const current = stateRef.current;
          const width = app.screen.width;
          const height = app.screen.height;
          const positionedThoughts = current.thoughts.map((thought) => {
            const position = bubblePosition(thought, width, height);
            return { ...thought, ...position };
          });
          const thoughts = translateThoughts(
            positionedThoughts,
            drag.movingIds,
            dx,
            dy,
            width,
            height,
          );
          const next = { thoughts, attachments: current.attachments };
          stateRef.current = next;
          onChangeRef.current(next);
          renderSpace();
        };

        const onUp = () => {
          if (!drag) return;
          const current = stateRef.current;
          if (drag.distance < 4) {
            const next = {
              ...current,
              thoughts: bringThoughtToFront(current.thoughts, drag.activeId),
            };
            stateRef.current = next;
            onChangeRef.current(next);
            setSelectedId(drag.activeId);
            renderSpace();
            drag = null;
            return;
          }
          const next = {
            ...current,
            attachments: recalculateAttachments(
              current.thoughts,
              current.attachments,
              drag.movingIds,
              drag.singular,
            ),
          };
          stateRef.current = next;
          onChangeRef.current(next);
          renderSpace();
          drag = null;
        };

        const onDoubleClick = (event: MouseEvent) => {
          const rect = app.canvas.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const thought = [...stateRef.current.thoughts].reverse().find((candidate) => {
            const position = bubblePosition(
              candidate,
              app.screen.width,
              app.screen.height,
            );
            return Math.hypot(position.x - x, position.y - y) <= candidate.radius;
          });
          event.preventDefault();
          if (thought) {
            setSelectedId(null);
            onEditRequestRef.current?.(
              thought,
              bubblePosition(thought, app.screen.width, app.screen.height),
            );
            return;
          }
          onCreateRequestRef.current?.({ x, y });
        };

        const onCanvasClick = (event: MouseEvent) => {
          const rect = app.canvas.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const overThought = stateRef.current.thoughts.some((thought) => {
            const position = bubblePosition(thought, app.screen.width, app.screen.height);
            return Math.hypot(position.x - x, position.y - y) <= thought.radius;
          });
          if (overThought) return;
          setSelectedId(null);
          onEmptyClickRef.current?.();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        canvas.addEventListener('click', onCanvasClick);
        canvas.addEventListener('dblclick', onDoubleClick);
        app.renderer.on('resize', renderSpace);
        renderSpace();

        canvas.dataset.cleanup = 'ready';
        Object.assign(canvas, {
          cleanupSpace: () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            canvas?.removeEventListener('click', onCanvasClick);
            canvas?.removeEventListener('dblclick', onDoubleClick);
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
  }, [state]);

  const selectedThought = state.thoughts.find((thought) => thought.id === selectedId);
  const host = hostRef.current;
  const selectedPosition =
    selectedThought && host
      ? bubblePosition(selectedThought, host.clientWidth, host.clientHeight)
      : null;

  return (
    <div ref={hostRef} className={`thought-space ${className}`}>
      {selectedThought && selectedPosition && (
        <button
          className="bubble-delete"
          style={{
            left: selectedPosition.x + selectedThought.radius * 0.68,
            top: selectedPosition.y - selectedThought.radius * 0.68,
          }}
          onClick={() => {
            const next = deleteThought(stateRef.current, selectedThought.id);
            stateRef.current = next;
            onChangeRef.current(next);
            setSelectedId(null);
          }}
          aria-label={`Delete thought: ${selectedThought.text}`}
        >
          ×
        </button>
      )}
    </div>
  );
}
