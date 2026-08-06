import { Plus } from 'lucide-react';
import { useAtomValue } from 'jotai';
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { css } from '../../styled-system/css';
import {
  composerOpenAtom,
  launcherRequestAtom,
  nextThoughtToneColorAtom,
} from '../appState';
import { getLauncherDragUpdate, type Position } from '../thoughtLauncherDrag';

type ThoughtLauncherProps = {
  getTapPosition: () => Position;
  onOpen: (position: Position) => void;
};

export function ThoughtLauncher({ getTapPosition, onOpen }: ThoughtLauncherProps) {
  const composerOpen = useAtomValue(composerOpenAtom);
  const launchRequest = useAtomValue(launcherRequestAtom);
  const toneColor = useAtomValue(nextThoughtToneColorAtom);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const handledLaunchRequest = useRef(launchRequest);
  const pointerStart = useRef<Position | null>(null);
  const launcherCenter = useRef<Position | null>(null);
  const dragStarted = useRef(false);
  const dragPositionRef = useRef<Position | null>(null);
  const [dragPosition, setDragPosition] = useState<Position | null>(null);
  const [launch, setLaunch] = useState<{
    start: Position;
    target: Position;
  } | null>(null);

  useEffect(() => {
    if (launchRequest === handledLaunchRequest.current) return;
    handledLaunchRequest.current = launchRequest;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect || launch) return;
    setLaunch({
      start: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      target: getTapPosition(),
    });
  }, [getTapPosition, launch, launchRequest]);

  if (composerOpen) return null;

  return (
    <div
      className={launcherClass}
      style={
        { '--thought-tone': toneColor } as CSSProperties &
          Record<'--thought-tone', string>
      }
    >
      {!launch && (
        <button
          ref={buttonRef}
          className={launcherBubbleClass}
          style={
            dragPosition
              ? {
                  left: dragPosition.x,
                  top: dragPosition.y,
                  right: 'auto',
                  bottom: 'auto',
                  transform: 'translate(-50%, -50%)',
                }
              : undefined
          }
          aria-label="Add a thought"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const pointer = { x: event.clientX, y: event.clientY };
            const rect = event.currentTarget.getBoundingClientRect();
            const center = {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            };
            pointerStart.current = pointer;
            launcherCenter.current = center;
            dragStarted.current = false;
            dragPositionRef.current = center;
            setDragPosition(center);
          }}
          onPointerMove={(event) => {
            if (!pointerStart.current || !launcherCenter.current) return;
            const update = getLauncherDragUpdate({
              launcherCenter: launcherCenter.current,
              pointer: { x: event.clientX, y: event.clientY },
              pointerStart: pointerStart.current,
            });
            dragStarted.current ||= update.isDrag;
            dragPositionRef.current = update.center;
            setDragPosition(update.center);
          }}
          onPointerUp={(event) => {
            const update =
              pointerStart.current && launcherCenter.current
                ? getLauncherDragUpdate({
                    launcherCenter: launcherCenter.current,
                    pointer: { x: event.clientX, y: event.clientY },
                    pointerStart: pointerStart.current,
                  })
                : null;
            const wasDrag = dragStarted.current || Boolean(update?.isDrag);
            const dragTarget = update?.center ?? dragPositionRef.current;
            pointerStart.current = null;
            launcherCenter.current = null;
            dragStarted.current = false;
            dragPositionRef.current = null;
            setDragPosition(null);
            if (wasDrag && dragTarget) {
              onOpen(dragTarget);
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
            launcherCenter.current = null;
            dragStarted.current = false;
            dragPositionRef.current = null;
            setDragPosition(null);
          }}
        >
          <Plus size={24} aria-hidden="true" />
        </button>
      )}
      {launch && (
        <span
          className={launcherSeedClass}
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

const launcherClass = css({
  position: 'fixed',
  zIndex: 8,
  inset: 0,
  pointerEvents: 'none',
});

const launcherBubbleClass = css({
  position: 'fixed',
  bottom: 'max(22px, env(safe-area-inset-bottom))',
  left: '50%',
  display: 'grid',
  width: '58px',
  height: '58px',
  placeItems: 'center',
  padding: '0 0 3px',
  border: '1px solid rgb(255 255 255 / 72%)',
  borderRadius: '50%',
  background:
    'radial-gradient(circle at 35% 28%, rgb(255 255 255 / 58%), transparent 34%), var(--thought-tone)',
  boxShadow: '0 12px 34px rgb(48 61 54 / 14%), inset 0 -4px 12px rgb(70 92 80 / 6%)',
  color: '#43544b',
  cursor: 'grab',
  touchAction: 'none',
  transform: 'translateX(-50%)',
  transition: 'width 180ms ease, height 180ms ease, box-shadow 180ms ease',
  pointerEvents: 'auto',
  WebkitTapHighlightColor: 'transparent',
  _active: {
    width: '66px',
    height: '66px',
    boxShadow: '0 16px 40px rgb(48 61 54 / 18%)',
    cursor: 'grabbing',
  },
});

const launcherSeedClass = css({
  position: 'fixed',
  width: '58px',
  height: '58px',
  border: '1px solid rgb(255 255 255 / 76%)',
  borderRadius: '50%',
  background:
    'radial-gradient(circle at 35% 28%, rgb(255 255 255 / 62%), transparent 34%), var(--thought-tone)',
  boxShadow: '0 12px 34px rgb(48 61 54 / 12%)',
  animation: 'launchSeed 200ms ease-out both',
});
