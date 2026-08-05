import type { Point } from './spatialField';

export function createPointerActivationGuard(maxMovement = 7) {
  let gesture: { pointerId: number; start: Point } | null = null;

  return {
    begin(pointerId: number, start: Point) {
      gesture = { pointerId, start };
    },
    complete(pointerId: number, end: Point) {
      const current = gesture;
      gesture = null;
      return (
        current !== null &&
        current.pointerId === pointerId &&
        Math.hypot(end.x - current.start.x, end.y - current.start.y) <= maxMovement
      );
    },
    cancel(pointerId: number) {
      if (gesture?.pointerId === pointerId) gesture = null;
    },
  };
}

export function createControlClickSuppressor(windowMs = 750) {
  let armedAt: number | null = null;

  return {
    arm(timeStamp: number) {
      armedAt = timeStamp;
    },
    cancel() {
      armedAt = null;
    },
    consume(timeStamp: number) {
      const start = armedAt;
      armedAt = null;
      return start !== null && timeStamp >= start && timeStamp - start <= windowMs;
    },
  };
}
