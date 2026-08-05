import type { Point } from './spatialField';

export const SINGLE_THOUGHT_LONG_PRESS_MS = 450;
export const SINGLE_THOUGHT_LONG_PRESS_MOVE_THRESHOLD = 4;

export type SingleThoughtLongPressInput = {
  id: string;
  point: Point;
  pointerId: number;
};

export function createSingleThoughtLongPress(
  onLongPress: (input: SingleThoughtLongPressInput) => void,
) {
  let pending:
    | (SingleThoughtLongPressInput & {
        distance: number;
        lastPoint: Point;
        timer: ReturnType<typeof setTimeout> | null;
      })
    | null = null;

  const cancel = () => {
    if (pending?.timer) clearTimeout(pending.timer);
    pending = null;
  };

  return {
    begin(input: SingleThoughtLongPressInput) {
      if (pending) return;
      pending = {
        ...input,
        distance: 0,
        lastPoint: input.point,
        timer: setTimeout(() => {
          if (!pending) return;
          pending.timer = null;
          onLongPress({
            id: pending.id,
            point: pending.lastPoint,
            pointerId: pending.pointerId,
          });
        }, SINGLE_THOUGHT_LONG_PRESS_MS),
      };
    },
    move(pointerId: number, point: Point) {
      if (!pending || pending.pointerId !== pointerId) return;
      pending.distance += Math.hypot(
        point.x - pending.lastPoint.x,
        point.y - pending.lastPoint.y,
      );
      pending.lastPoint = point;
      if (pending.distance >= SINGLE_THOUGHT_LONG_PRESS_MOVE_THRESHOLD) cancel();
    },
    end(pointerId: number) {
      if (pending?.pointerId === pointerId) cancel();
    },
    cancelForOtherPointer(pointerId: number) {
      if (pending && pending.pointerId !== pointerId) cancel();
    },
    cancel,
  };
}
