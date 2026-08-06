import { describe, expect, it } from 'vite-plus/test';

import {
  composerPositionForKeyboard,
  isIOSDevice,
  shouldOpenThoughtImmediately,
} from './touchThoughtAuthoring';

describe('touch thought authoring', () => {
  it('opens within the touch activation instead of waiting for animation', () => {
    expect(shouldOpenThoughtImmediately('touch', true)).toBe(true);
    expect(shouldOpenThoughtImmediately('pen', true)).toBe(true);
    expect(shouldOpenThoughtImmediately('mouse', true)).toBe(false);
    expect(shouldOpenThoughtImmediately('touch', false)).toBe(false);
  });

  it('detects iOS without treating Android as iOS', () => {
    expect(
      isIOSDevice({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
    expect(
      isIOSDevice({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
    expect(
      isIOSDevice({
        userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel Tablet)',
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      }),
    ).toBe(false);
  });

  it('keeps the composer above a keyboard-reduced visual viewport', () => {
    expect(
      composerPositionForKeyboard({
        position: { x: 512, y: 720 },
        layoutHeight: 1024,
        visualViewport: { offsetTop: 0, height: 620 },
      }),
    ).toEqual({ x: 512, y: 499 });
  });

  it('does not guess keyboard geometry when no resize is reported', () => {
    expect(
      composerPositionForKeyboard({
        position: { x: 512, y: 720 },
        layoutHeight: 1024,
        visualViewport: { offsetTop: 0, height: 1024 },
      }),
    ).toEqual({ x: 512, y: 720 });
  });
});
