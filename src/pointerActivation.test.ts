import { describe, expect, it } from 'vitest';

import {
  createControlClickSuppressor,
  createPointerActivationGuard,
} from './pointerActivation';

describe('pointer activation guard', () => {
  it('rejects a pointer-up that did not begin on the action', () => {
    const guard = createPointerActivationGuard();

    expect(guard.complete(1, { x: 10, y: 20 })).toBe(false);
  });

  it('accepts a deliberate press and rejects a drag', () => {
    const guard = createPointerActivationGuard();
    guard.begin(1, { x: 10, y: 20 });
    expect(guard.complete(1, { x: 12, y: 22 })).toBe(true);

    guard.begin(2, { x: 10, y: 20 });
    expect(guard.complete(2, { x: 30, y: 20 })).toBe(false);
  });

  it('consumes only the immediate canvas click following a bubble control', () => {
    const suppressor = createControlClickSuppressor(500);
    suppressor.arm(1_000);

    expect(suppressor.consume(1_100)).toBe(true);
    expect(suppressor.consume(1_150)).toBe(false);

    suppressor.arm(2_000);
    suppressor.cancel();
    expect(suppressor.consume(2_100)).toBe(false);

    suppressor.arm(3_000);
    expect(suppressor.consume(3_501)).toBe(false);
  });
});
