import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useEffect, useRef } from 'react';

import type { Attachment, SpaceState, Thought } from '../types';

const palette = [0xf5eadc, 0xe3ece7, 0xe8e2ef, 0xf0e8d7, 0xdfe8ee];
const ATTACH_HOLD_MS = 680;
const EXTRACT_HOLD_MS = 620;

type ThoughtSpaceProps = {
  state: SpaceState;
  onChange: (state: SpaceState) => void;
  className?: string;
  mode?: 'open' | 'landing' | 'focus';
};

type DragState = {
  id: string;
  lastX: number;
  lastY: number;
  startedAt: number;
  extracting: boolean;
  group: Set<string>;
  touchTarget: string | null;
  touchStartedAt: number;
};

function connectedIds(id: string, attachments: Attachment[]) {
  const result = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, b] of attachments) {
      if (result.has(a) && !result.has(b)) {
        result.add(b);
        changed = true;
      }
      if (result.has(b) && !result.has(a)) {
        result.add(a);
        changed = true;
      }
    }
  }
  return result;
}

function bubblePosition(thought: Thought, width: number, height: number) {
  return {
    x: thought.x <= 1 ? thought.x * width : thought.x,
    y: thought.y <= 1 ? thought.y * height : thought.y,
  };
}

export function ThoughtSpace({
  state,
  onChange,
  className = '',
  mode = 'open',
}: ThoughtSpaceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const onChangeRef = useRef(onChange);

  stateRef.current = state;
  onChangeRef.current = onChange;

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
              .fill({ color: 0x49504a, alpha: mode === 'focus' ? 0.09 : 0.07 });
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
              const group = connectedIds(thought.id, current.attachments);
              drag = {
                id: thought.id,
                lastX: point.x,
                lastY: point.y,
                startedAt: performance.now(),
                extracting: false,
                group,
                touchTarget: null,
                touchStartedAt: 0,
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
          drag.lastX = x;
          drag.lastY = y;

          const current = stateRef.current;
          const elapsed = performance.now() - drag.startedAt;
          if (drag.group.size > 1 && elapsed >= EXTRACT_HOLD_MS) drag.extracting = true;
          const movingIds = drag.extracting ? new Set([drag.id]) : drag.group;
          const width = app.screen.width;
          const height = app.screen.height;
          let thoughts = current.thoughts.map((thought) => {
            if (!movingIds.has(thought.id)) return thought;
            const position = bubblePosition(thought, width, height);
            return {
              ...thought,
              x: Math.max(
                thought.radius,
                Math.min(width - thought.radius, position.x + dx),
              ),
              y: Math.max(
                thought.radius,
                Math.min(height - thought.radius, position.y + dy),
              ),
            };
          });

          const moving = thoughts.find((thought) => thought.id === drag!.id)!;
          const movingPosition = bubblePosition(moving, width, height);
          let nearest: Thought | null = null;
          let nearestDistance = Number.POSITIVE_INFINITY;
          for (const candidate of thoughts) {
            if (candidate.id === moving.id || movingIds.has(candidate.id)) continue;
            const candidatePosition = bubblePosition(candidate, width, height);
            const distance = Math.hypot(
              candidatePosition.x - movingPosition.x,
              candidatePosition.y - movingPosition.y,
            );
            if (distance < nearestDistance) {
              nearest = candidate;
              nearestDistance = distance;
            }
          }

          if (nearest) {
            const contactDistance = moving.radius + nearest.radius - 8;
            if (nearestDistance < contactDistance + 26) {
              const targetPosition = bubblePosition(nearest, width, height);
              const pull = Math.min(0.12, (contactDistance + 26 - nearestDistance) / 180);
              thoughts = thoughts.map((thought) =>
                thought.id === moving.id
                  ? {
                      ...thought,
                      x: movingPosition.x + (targetPosition.x - movingPosition.x) * pull,
                      y: movingPosition.y + (targetPosition.y - movingPosition.y) * pull,
                    }
                  : thought,
              );
            }
            if (nearestDistance <= contactDistance + 5) {
              if (drag.touchTarget !== nearest.id) {
                drag.touchTarget = nearest.id;
                drag.touchStartedAt = performance.now();
              } else if (performance.now() - drag.touchStartedAt >= ATTACH_HOLD_MS) {
                const exists = current.attachments.some(
                  ([a, b]) =>
                    (a === moving.id && b === nearest!.id) ||
                    (a === nearest!.id && b === moving.id),
                );
                if (!exists)
                  current.attachments = [...current.attachments, [moving.id, nearest.id]];
              }
            } else {
              drag.touchTarget = null;
            }
          }

          let attachments = current.attachments;
          if (drag.extracting) {
            attachments = attachments.filter(
              ([a, b]) => a !== drag!.id && b !== drag!.id,
            );
          }
          const next = { thoughts, attachments };
          stateRef.current = next;
          onChangeRef.current(next);
          renderSpace();
        };

        const onUp = () => {
          drag = null;
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        app.renderer.on('resize', renderSpace);
        renderSpace();

        canvas.dataset.cleanup = 'ready';
        Object.assign(canvas, {
          cleanupSpace: () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
          },
        });
      });

    return () => {
      cancelled = true;
      canvas?.cleanupSpace?.();
      if (canvas) destroyApp();
    };
  }, [mode]);

  useEffect(() => {
    const canvas = hostRef.current?.querySelector('canvas');
    if (canvas) window.dispatchEvent(new Event('resize'));
  }, [state]);

  return <div ref={hostRef} className={`thought-space ${className}`} />;
}
