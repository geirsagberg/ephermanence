import { describe, expect, it } from 'vitest';

import { createPointerActivationGuard } from './pointerActivation';

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
});
