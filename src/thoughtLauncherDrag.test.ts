import { describe, expect, it } from 'vitest';

import { getLauncherDragCenter, getLauncherDragUpdate } from './thoughtLauncherDrag';

describe('thought launcher drag', () => {
  it('keeps the original grab point under the pointer', () => {
    const pointerStart = { x: 420, y: 690 };
    const launcherCenter = { x: 400, y: 700 };

    const center = getLauncherDragCenter({
      launcherCenter,
      pointer: { x: 220, y: 290 },
      pointerStart,
    });

    expect(center).toEqual({ x: 200, y: 300 });
    expect({
      x: 220 - center.x,
      y: 290 - center.y,
    }).toEqual({
      x: pointerStart.x - launcherCenter.x,
      y: pointerStart.y - launcherCenter.y,
    });
  });

  it('moves with the pointer before crossing the drag threshold', () => {
    const update = getLauncherDragUpdate({
      launcherCenter: { x: 400, y: 700 },
      pointer: { x: 421, y: 690 },
      pointerStart: { x: 420, y: 690 },
    });

    expect(update).toEqual({
      center: { x: 401, y: 700 },
      isDrag: false,
    });
  });
});
