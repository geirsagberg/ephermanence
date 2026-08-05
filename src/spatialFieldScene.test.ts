import { Container, Graphics, Point, type FederatedPointerEvent } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';

import { defaultAmbientBubbleSettings, SpatialFieldScene } from './spatialFieldScene';
import type { SpatialInteractionSnapshot } from './spatialInteraction';
import type { SpaceState } from './types';

const viewport = { left: -195, right: 195, top: -422, bottom: 422 };

function snapshot(
  state: SpaceState = { thoughts: [], attachments: [] },
  attachmentCandidateIds: string[] = [],
): SpatialInteractionSnapshot {
  return {
    state,
    selectedId: null,
    attachmentCandidateIds,
    isDragging: false,
    camera: { x: 0, y: 0, zoom: 1 },
  };
}

function ambient(scene: SpatialFieldScene) {
  return scene.children[0] as Container;
}

function foreground(scene: SpatialFieldScene) {
  return scene.children[2] as Container;
}

function bonds(scene: SpatialFieldScene) {
  return foreground(scene).children[1] as Container;
}

function thoughts(scene: SpatialFieldScene) {
  return foreground(scene).children[2] as Container;
}

function clusterOutline(scene: SpatialFieldScene) {
  return foreground(scene).children[0] as Graphics;
}

function fadingBonds(scene: SpatialFieldScene) {
  return scene.children[1] as Container;
}

describe('spatial field scene', () => {
  it('defaults to the accepted subtle ambient field', () => {
    expect(defaultAmbientBubbleSettings).toEqual({
      size: 0.7,
      presence: 0.5,
      density: 3,
    });
  });

  it('renders Bonds before interactive Thoughts', () => {
    const onPointerDown = vi.fn();
    const scene = new SpatialFieldScene(onPointerDown);
    const first = {
      id: 'first',
      text: 'First',
      x: 0,
      y: 0,
      radius: 74,
      tone: 0,
    };
    const second = { ...first, id: 'second', text: 'Second', x: 100 };

    scene.render(
      snapshot({ thoughts: [first, second], attachments: [['first', 'second']] }),
      viewport,
    );

    expect(bonds(scene).children).toHaveLength(1);
    expect(thoughts(scene).children).toHaveLength(2);
    expect(thoughts(scene).children[0].eventMode).toBe('static');
    expect(thoughts(scene).children[1].eventMode).toBe('static');
  });

  it('outlines only the selected Thought cluster behind its bubbles', () => {
    const scene = new SpatialFieldScene();
    const first = {
      id: 'first',
      text: 'First',
      x: 0,
      y: 0,
      radius: 74,
      tone: 0,
    };
    const second = { ...first, id: 'second', text: 'Second', x: 100 };
    const alone = { ...first, id: 'alone', text: 'Alone', x: 500 };
    const state = {
      thoughts: [first, second, alone],
      attachments: [['first', 'second']] as [string, string][],
    };

    scene.render({ ...snapshot(state), selectedId: 'first' }, viewport);

    const outline = clusterOutline(scene);
    expect(foreground(scene).children).toEqual([outline, bonds(scene), thoughts(scene)]);
    expect(outline.bounds.minX).toBe(-82);
    expect(outline.bounds.maxX).toBe(182);

    scene.render({ ...snapshot(state), selectedId: 'alone' }, viewport);

    expect(clusterOutline(scene).context.instructions).toHaveLength(0);
  });

  it('forwards the pointer identity needed to recognize a long press', () => {
    const onPointerDown = vi.fn();
    const scene = new SpatialFieldScene(onPointerDown);
    const held = {
      id: 'held',
      text: 'Held',
      x: 0,
      y: 0,
      radius: 74,
      tone: 0,
    };
    scene.render(snapshot({ thoughts: [held], attachments: [] }), viewport);

    thoughts(scene).children[0].emit('pointerdown', {
      global: new Point(12, 34),
      pointerId: 7,
      shiftKey: false,
    } as FederatedPointerEvent);

    expect(onPointerDown).toHaveBeenCalledWith('held', { x: 12, y: 34 }, false, 7);
  });

  it('reuses an unchanged Thought display object across drag frames', () => {
    const scene = new SpatialFieldScene();
    const thought = {
      id: 'moving',
      text: 'Moving',
      x: 0,
      y: 0,
      radius: 74,
      tone: 0,
    };
    scene.render(snapshot({ thoughts: [thought], attachments: [] }), viewport);
    const renderedThought = thoughts(scene).children[0];

    scene.render(
      snapshot({ thoughts: [{ ...thought, x: 40 }], attachments: [] }),
      viewport,
    );

    expect(thoughts(scene).children[0]).toBe(renderedThought);
    expect(renderedThought.x).toBe(40);
  });

  it('reuses a Thought display object when its attachment halo changes', () => {
    const scene = new SpatialFieldScene();
    const thought = {
      id: 'candidate',
      text: 'Candidate',
      x: 0,
      y: 0,
      radius: 74,
      tone: 0,
    };
    scene.render(snapshot({ thoughts: [thought], attachments: [] }), viewport);
    const renderedThought = thoughts(scene).children[0];

    scene.render(
      snapshot({ thoughts: [thought], attachments: [] }, ['candidate']),
      viewport,
    );

    expect(thoughts(scene).children[0]).toBe(renderedThought);
    expect(renderedThought.children[0].visible).toBe(true);
  });

  it('reserves texture space for the full filtered Thought shadow', () => {
    const scene = new SpatialFieldScene(undefined, () => ({ padding: 34 }) as never);
    const thought = {
      id: 'shadowed',
      text: 'Shadowed',
      x: 0,
      y: 0,
      radius: 74,
      tone: 0,
    };
    scene.render(snapshot({ thoughts: [thought], attachments: [] }), viewport);

    const cachedVisual = thoughts(scene).children[0].children[1] as Container;
    const cachePadding = cachedVisual.children[0] as Graphics;

    expect(cachedVisual.children).toHaveLength(3);
    expect(cachePadding.bounds.minX).toBeLessThanOrEqual(-thought.radius - 34);
    expect(cachePadding.bounds.maxX).toBeGreaterThanOrEqual(thought.radius + 34);
    expect(cachePadding.bounds.minY).toBeLessThanOrEqual(-thought.radius - 34);
    expect(cachePadding.bounds.maxY).toBeGreaterThanOrEqual(thought.radius + 34);
  });

  it('raises a Thought as its final Bond is removed', () => {
    const filters: Array<{
      padding: number;
      offsetX: number;
      offsetY: number;
      alpha: number;
      blur: number;
    }> = [];
    const scene = new SpatialFieldScene(undefined, () => {
      const filter = { padding: 46, offsetX: 0, offsetY: 0, alpha: 0, blur: 0 };
      filters.push(filter);
      return filter as never;
    });
    const first = {
      id: 'first',
      text: 'First',
      x: 0,
      y: 0,
      radius: 74,
      tone: 0,
    };
    const second = { ...first, id: 'second', text: 'Second', x: 100 };
    scene.render(
      snapshot({ thoughts: [first, second], attachments: [['first', 'second']] }),
      viewport,
    );
    const cachedVisual = thoughts(scene).children[0].children[1] as Container;
    expect(cachedVisual.y).toBe(0);
    expect(filters[0]).toMatchObject({ offsetY: 5, alpha: 0.1, blur: 8 });

    scene.render(snapshot({ thoughts: [first, second], attachments: [] }), viewport);
    scene.advanceAnimations(110);

    expect(cachedVisual.y).toBeCloseTo(-1);
    expect(filters[0]).toMatchObject({ offsetY: 7.5, alpha: 0.14, blur: 9.5 });

    scene.advanceAnimations(110);

    expect(cachedVisual.y).toBe(-2);
    expect(filters[0]).toMatchObject({ offsetY: 10, alpha: 0.18, blur: 11 });
  });

  it('reuses a Bond display object while its endpoint moves', () => {
    const scene = new SpatialFieldScene();
    const first = {
      id: 'first',
      text: 'First',
      x: 0,
      y: 0,
      radius: 74,
      tone: 0,
    };
    const second = { ...first, id: 'second', text: 'Second', x: 100 };
    const attachments: [string, string][] = [['first', 'second']];
    scene.render(snapshot({ thoughts: [first, second], attachments }), viewport);
    const renderedBond = bonds(scene).children[0];

    scene.render(
      snapshot({ thoughts: [first, { ...second, x: 140 }], attachments }),
      viewport,
    );

    expect(bonds(scene).children[0]).toBe(renderedBond);
  });

  it('hides the edited Thought while preserving its Bonds', () => {
    const scene = new SpatialFieldScene();
    const first = {
      id: 'editing',
      text: 'Editing',
      x: 0,
      y: 0,
      radius: 74,
      tone: 0,
    };
    const second = { ...first, id: 'visible', text: 'Visible', x: 100 };

    scene.render(
      snapshot({ thoughts: [first, second], attachments: [['editing', 'visible']] }),
      viewport,
      defaultAmbientBubbleSettings,
      'editing',
    );

    expect(bonds(scene).children).toHaveLength(1);
    expect(thoughts(scene).children).toHaveLength(1);
    expect(thoughts(scene).children[0].x).toBe(100);
    expect(thoughts(scene).children[0].eventMode).toBe('static');
  });

  it('fades a removed Bond after release', () => {
    const scene = new SpatialFieldScene();
    const first = {
      id: 'first',
      text: 'First',
      x: 0,
      y: 0,
      radius: 74,
      tone: 0,
    };
    const second = { ...first, id: 'second', x: 200 };

    scene.render(
      snapshot({ thoughts: [first, second], attachments: [['first', 'second']] }),
      viewport,
    );
    expect(fadingBonds(scene).children).toHaveLength(0);

    scene.render(snapshot({ thoughts: [first, second], attachments: [] }), viewport);

    expect(fadingBonds(scene).children).toHaveLength(1);
    scene.advanceAnimations(120);
    expect(fadingBonds(scene).children[0].alpha).toBeCloseTo(0.5);
    scene.advanceAnimations(120);
    expect(fadingBonds(scene).children).toHaveLength(0);
  });

  it('reuses cached ambient chunks while the visible world is unchanged', () => {
    const scene = new SpatialFieldScene();
    scene.render(snapshot(), viewport);
    const chunks = [...ambient(scene).children];

    scene.render(snapshot(), viewport);

    expect(ambient(scene).children).toEqual(chunks);
  });

  it('discards distant chunks when the camera moves to another region', () => {
    const scene = new SpatialFieldScene();
    scene.render(snapshot(), viewport);
    const previousChunks = new Set(ambient(scene).children);

    scene.render(snapshot(), {
      left: 5_000,
      right: 5_390,
      top: 5_000,
      bottom: 5_844,
    });

    expect(ambient(scene).children.every((chunk) => !previousChunks.has(chunk))).toBe(
      true,
    );
  });

  it('loads additional chunks for a zoomed-out world view', () => {
    const scene = new SpatialFieldScene();
    scene.render(snapshot(), viewport);
    const defaultCount = ambient(scene).children.length;

    scene.render(snapshot(), {
      left: -650,
      right: 650,
      top: -1_407,
      bottom: 1_407,
    });

    expect(ambient(scene).children.length).toBeGreaterThan(defaultCount);
  });

  it('rebuilds cached chunks when the appearance changes', () => {
    const scene = new SpatialFieldScene();
    scene.render(snapshot(), viewport);
    const previousChunks = new Set(ambient(scene).children);

    scene.render(snapshot(), viewport, {
      size: 0.7,
      presence: 0.45,
      density: 2,
    });

    expect(ambient(scene).children.every((chunk) => !previousChunks.has(chunk))).toBe(
      true,
    );
    expect(ambient(scene).children.every((chunk) => chunk.children.length === 2)).toBe(
      true,
    );
  });
});
