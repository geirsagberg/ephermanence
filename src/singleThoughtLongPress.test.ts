import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSingleThoughtLongPress,
  SINGLE_THOUGHT_LONG_PRESS_MOVE_THRESHOLD,
  SINGLE_THOUGHT_LONG_PRESS_MS,
} from './singleThoughtLongPress';

describe('single Thought long press', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('requests a singular drag after a stationary hold', () => {
    const onLongPress = vi.fn();
    const longPress = createSingleThoughtLongPress(onLongPress);

    longPress.begin({ id: 'held', point: { x: 10, y: 20 }, pointerId: 1 });
    vi.advanceTimersByTime(SINGLE_THOUGHT_LONG_PRESS_MS);

    expect(onLongPress).toHaveBeenCalledOnce();
    expect(onLongPress).toHaveBeenCalledWith({
      id: 'held',
      point: { x: 10, y: 20 },
      pointerId: 1,
    });
  });

  it('cancels when movement becomes a drag', () => {
    const onLongPress = vi.fn();
    const longPress = createSingleThoughtLongPress(onLongPress);

    longPress.begin({ id: 'moving', point: { x: 0, y: 0 }, pointerId: 1 });
    longPress.move(1, {
      x: SINGLE_THOUGHT_LONG_PRESS_MOVE_THRESHOLD,
      y: 0,
    });
    vi.advanceTimersByTime(SINGLE_THOUGHT_LONG_PRESS_MS);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels on release, pointer cancellation, or another pointer', () => {
    const onLongPress = vi.fn();
    const longPress = createSingleThoughtLongPress(onLongPress);

    longPress.begin({ id: 'released', point: { x: 0, y: 0 }, pointerId: 1 });
    longPress.end(1);
    vi.advanceTimersByTime(SINGLE_THOUGHT_LONG_PRESS_MS);

    longPress.begin({ id: 'cancelled', point: { x: 0, y: 0 }, pointerId: 2 });
    longPress.cancel();
    vi.advanceTimersByTime(SINGLE_THOUGHT_LONG_PRESS_MS);

    longPress.begin({ id: 'pinched', point: { x: 0, y: 0 }, pointerId: 3 });
    longPress.cancelForOtherPointer(4);
    vi.advanceTimersByTime(SINGLE_THOUGHT_LONG_PRESS_MS);

    expect(onLongPress).not.toHaveBeenCalled();
  });
});
