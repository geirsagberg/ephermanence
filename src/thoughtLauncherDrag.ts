export type Position = { x: number; y: number };

type LauncherDrag = {
  launcherCenter: Position;
  pointer: Position;
  pointerStart: Position;
};

export function getLauncherDragCenter({
  launcherCenter,
  pointer,
  pointerStart,
}: LauncherDrag): Position {
  return {
    x: pointer.x + launcherCenter.x - pointerStart.x,
    y: pointer.y + launcherCenter.y - pointerStart.y,
  };
}

export function getLauncherDragUpdate(drag: LauncherDrag): {
  center: Position;
  isDrag: boolean;
} {
  return {
    center: getLauncherDragCenter(drag),
    isDrag:
      Math.hypot(
        drag.pointer.x - drag.pointerStart.x,
        drag.pointer.y - drag.pointerStart.y,
      ) > 7,
  };
}
