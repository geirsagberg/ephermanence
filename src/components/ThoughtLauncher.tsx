import { Plus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useRef, useState } from 'react';

type Position = { x: number; y: number };

type ThoughtLauncherProps = {
  composerOpen: boolean;
  getTapPosition: () => Position;
  onOpen: (position: Position) => void;
};

export function ThoughtLauncher({
  composerOpen,
  getTapPosition,
  onOpen,
}: ThoughtLauncherProps) {
  const pointerStart = useRef<Position | null>(null);
  const dragPositionRef = useRef<Position | null>(null);
  const [dragPosition, setDragPosition] = useState<Position | null>(null);
  const [launch, setLaunch] = useState<{
    start: Position;
    target: Position;
  } | null>(null);

  if (composerOpen) return null;

  return (
    <div className="thought-launcher">
      <button
        className="thought-launcher__bubble"
        style={
          dragPosition
            ? { left: dragPosition.x, top: dragPosition.y, right: 'auto', bottom: 'auto' }
            : undefined
        }
        aria-label="Add a thought"
        disabled={launch !== null}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pointerStart.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          if (!pointerStart.current) return;
          const distance = Math.hypot(
            event.clientX - pointerStart.current.x,
            event.clientY - pointerStart.current.y,
          );
          if (distance <= 7) return;
          const position = { x: event.clientX, y: event.clientY };
          dragPositionRef.current = position;
          setDragPosition(position);
        }}
        onPointerUp={(event) => {
          const dragTarget = dragPositionRef.current;
          pointerStart.current = null;
          dragPositionRef.current = null;
          setDragPosition(null);
          if (dragTarget) {
            onOpen({ x: event.clientX, y: event.clientY });
            return;
          }

          const rect = event.currentTarget.getBoundingClientRect();
          setLaunch({
            start: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
            target: getTapPosition(),
          });
        }}
        onPointerCancel={() => {
          pointerStart.current = null;
          dragPositionRef.current = null;
          setDragPosition(null);
        }}
      >
        <Plus size={24} aria-hidden="true" />
      </button>
      {launch && (
        <span
          className="thought-launcher__seed"
          style={
            {
              left: launch.start.x,
              top: launch.start.y,
              '--launch-x': `${launch.target.x - launch.start.x}px`,
              '--launch-y': `${launch.target.y - launch.start.y}px`,
            } as CSSProperties & Record<'--launch-x' | '--launch-y', string>
          }
          onAnimationEnd={() => {
            const target = launch.target;
            setLaunch(null);
            onOpen(target);
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
