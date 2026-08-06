import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSpatialFieldInputAdapter,
  type SpatialFieldInputRuntime,
  type ThoughtControlEvent,
} from './spatialFieldInputAdapter';
import type { MountedSpatialFieldScene } from './spatialFieldScene';
import { createSpatialInteraction } from './spatialInteraction';
import type { Thought } from './types';

class FakeEventSource {
  readonly listeners = new Map<string, Set<(event: never) => void>>();
  readonly style = { cursor: '' };
  readonly dataset: Record<string, string> = {};
  innerWidth = 1000;
  innerHeight = 800;

  addEventListener(type: string, listener: (event: never) => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: never) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: object) {
    for (const listener of this.listeners.get(type) ?? []) listener(event as never);
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1000, height: 800 } as DOMRect;
  }
}

function thought(id: string, x: number, y = 0): Thought {
  return { id, text: id, x, y, radius: 50, tone: 0 };
}

function createHarness(thoughts: Thought[] = [], attachments: [string, string][] = []) {
  const interaction = createSpatialInteraction({ thoughts, attachments });
  const events = new FakeEventSource();
  const canvas = new FakeEventSource();
  const render = vi.fn();
  const destroy = vi.fn();
  let onThoughtPointerDown:
    | ((
        id: string,
        point: { x: number; y: number },
        singular: boolean,
        pointerId: number,
      ) => void)
    | undefined;
  let resizeListener = () => {};
  const scene: MountedSpatialFieldScene = {
    canvas: canvas as never,
    screen: { width: 1000, height: 800 },
    render,
    onResize(listener) {
      resizeListener = listener;
      return () => {
        resizeListener = () => {};
      };
    },
    destroy,
  };
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const runtime: SpatialFieldInputRuntime = {
    mountScene: vi.fn(async (_host, _interaction, onPointerDown) => {
      onThoughtPointerDown = onPointerDown;
      return scene;
    }),
    events: events as never,
    requestFrame(callback) {
      const id = nextFrame;
      nextFrame += 1;
      frames.set(id, callback);
      return id;
    },
    cancelFrame: (id) => frames.delete(id),
    setDelay: (callback, delay) => setTimeout(callback, delay),
    clearDelay: (handle) => clearTimeout(handle),
  };
  const onFrame = vi.fn();
  const onFailure = vi.fn();
  const adapter = createSpatialFieldInputAdapter({
    interaction,
    onFrame,
    onFailure,
    runtime,
  });

  return {
    adapter,
    interaction,
    events,
    canvas,
    scene,
    render,
    destroy,
    onFrame,
    onFailure,
    thoughtPointerDown: (...args: Parameters<NonNullable<typeof onThoughtPointerDown>>) =>
      onThoughtPointerDown?.(...args),
    resize: () => resizeListener(),
    flushFrame() {
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(0);
    },
  };
}

async function mount(harness: ReturnType<typeof createHarness>) {
  const cleanup = harness.adapter.mount({} as HTMLElement);
  await Promise.resolve();
  return cleanup;
}

function pointerEvent(
  phase: ThoughtControlEvent['phase'],
  overrides: Partial<ThoughtControlEvent> = {},
) {
  const consume = vi.fn();
  const capturePointer = vi.fn();
  return {
    event: {
      phase,
      pointerId: 1,
      pointerKind: 'touch',
      clientPoint: { x: 500, y: 400 },
      timeStamp: 1000,
      consume,
      capturePointer,
      ...overrides,
    } satisfies ThoughtControlEvent,
    consume,
    capturePointer,
  };
}

function nativePointer(overrides: object = {}) {
  return {
    clientX: 100,
    clientY: 100,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

describe('spatial field input adapter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders input immediately while coalescing React frames', async () => {
    const harness = createHarness();
    const cleanup = await mount(harness);
    harness.flushFrame();
    harness.onFrame.mockClear();
    harness.render.mockClear();

    harness.canvas.emit('pointerdown', nativePointer());
    for (let x = 110; x <= 150; x += 10) {
      harness.events.emit('pointermove', nativePointer({ clientX: x }));
    }

    expect(harness.render).toHaveBeenCalledTimes(5);
    expect(harness.onFrame).not.toHaveBeenCalled();

    harness.flushFrame();

    expect(harness.onFrame).toHaveBeenCalledOnce();
    cleanup();
  });

  it('rerenders without the selected cluster outline after tapping empty space', async () => {
    const first = thought('first', 0);
    const second = thought('second', 90);
    const harness = createHarness([first, second], [['first', 'second']]);
    const cleanup = await mount(harness);
    const screenPoint = harness.interaction.worldToScreen(first);
    harness.thoughtPointerDown(first.id, screenPoint, false, 1);
    harness.events.emit('pointerup', nativePointer());
    expect(harness.interaction.read().selectedId).toBe(first.id);
    harness.render.mockClear();

    harness.canvas.emit('click', { clientX: 900, clientY: 700, timeStamp: 1000 });

    expect(harness.interaction.read().selectedId).toBeNull();
    expect(harness.render).toHaveBeenCalledOnce();
    cleanup();
  });

  it('prevents a touch Thought control from falling through to canvas tap-away', async () => {
    const existing = thought('selected', 0);
    const harness = createHarness([existing]);
    const cleanup = await mount(harness);
    const screenPoint = harness.interaction.worldToScreen(existing);
    harness.thoughtPointerDown(existing.id, screenPoint, false, 1);
    harness.events.emit('pointerup', nativePointer({ pointerType: 'touch' }));
    harness.flushFrame();
    harness.onFrame.mockClear();

    const down = pointerEvent('pointer-down');
    const up = pointerEvent('pointer-up', { timeStamp: 1100 });
    harness.adapter.send({
      type: 'thought-control',
      thoughtId: existing.id,
      control: 'edit',
      event: down.event,
    });
    harness.adapter.send({
      type: 'thought-control',
      thoughtId: existing.id,
      control: 'edit',
      event: up.event,
    });
    harness.canvas.emit('click', {
      clientX: 900,
      clientY: 700,
      timeStamp: 1150,
    });
    harness.flushFrame();

    expect(down.consume).toHaveBeenCalledOnce();
    expect(down.capturePointer).toHaveBeenCalledOnce();
    expect(up.consume).toHaveBeenCalledOnce();
    expect(harness.onFrame.mock.calls[0][0].effects).toEqual([
      { type: 'request-edit', thought: existing, screenPosition: screenPoint },
    ]);
    cleanup();
  });

  it('detaches a bonded Thought when the grab control is tapped', async () => {
    const first = thought('first', 0);
    const second = thought('second', 90);
    const harness = createHarness([first, second], [['first', 'second']]);
    const cleanup = await mount(harness);
    const down = pointerEvent('pointer-down');
    const up = pointerEvent('pointer-up', { timeStamp: 1050 });

    harness.adapter.send({
      type: 'thought-control',
      thoughtId: first.id,
      control: 'grab',
      event: down.event,
    });
    harness.adapter.send({
      type: 'thought-control',
      thoughtId: first.id,
      control: 'grab',
      event: up.event,
    });

    expect(down.consume).toHaveBeenCalledOnce();
    expect(up.consume).toHaveBeenCalledOnce();
    expect(harness.interaction.read().state.attachments).toEqual([]);
    cleanup();
  });

  it('turns a stationary long press into a singular grab', async () => {
    const held = thought('held', 0);
    const harness = createHarness([held]);
    const cleanup = await mount(harness);

    harness.thoughtPointerDown('held', { x: 500, y: 400 }, false, 3);
    vi.advanceTimersByTime(450);

    expect(harness.interaction.read().grabbedThoughtId).toBe('held');
    cleanup();
  });

  it('rejects a dragged control activation through the adapter interface', async () => {
    const existing = thought('selected', 0);
    const harness = createHarness([existing]);
    const cleanup = await mount(harness);
    const down = pointerEvent('pointer-down', { pointerKind: 'mouse' });
    const up = pointerEvent('pointer-up', {
      pointerKind: 'mouse',
      clientPoint: { x: 520, y: 400 },
    });

    harness.adapter.send({
      type: 'thought-control',
      thoughtId: existing.id,
      control: 'edit',
      event: down.event,
    });
    harness.adapter.send({
      type: 'thought-control',
      thoughtId: existing.id,
      control: 'edit',
      event: up.event,
    });
    harness.flushFrame();

    expect(harness.onFrame.mock.calls.at(-1)?.[0].effects).toEqual([]);
    cleanup();
  });

  it('destroys a scene that resolves after cleanup', async () => {
    const harness = createHarness();
    let resolveScene: ((scene: MountedSpatialFieldScene) => void) | undefined;
    harness.adapter = createSpatialFieldInputAdapter({
      interaction: harness.interaction,
      onFrame: harness.onFrame,
      onFailure: harness.onFailure,
      runtime: {
        ...({} as SpatialFieldInputRuntime),
        mountScene: () =>
          new Promise((resolve) => {
            resolveScene = resolve;
          }),
        events: harness.events as never,
        requestFrame: () => 1,
        cancelFrame: vi.fn(),
        setDelay: (callback, delay) => setTimeout(callback, delay),
        clearDelay: (handle) => clearTimeout(handle),
      },
    });
    const cleanup = harness.adapter.mount({} as HTMLElement);

    cleanup();
    resolveScene?.(harness.scene);
    await Promise.resolve();

    expect(harness.destroy).toHaveBeenCalledOnce();
    expect(harness.onFrame).not.toHaveBeenCalled();
  });
});
