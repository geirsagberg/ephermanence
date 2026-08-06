import { Container, Graphics, Point, type FederatedPointerEvent } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';

import { defaultAmbientBubbleSettings, SpatialFieldScene } from './spatialFieldScene';
import type { SpatialInteractionSnapshot } from './spatialInteraction';
import { thoughtRadius } from './thoughtTextLayout';
import type { SpaceState } from './types';

const viewport = { left: -195, right: 195, top: -422, bottom: 422 };

function snapshot(
  state: SpaceState = { thoughts: [], attachments: [] },
  attachmentCandidateIds: string[] = [],
): SpatialInteractionSnapshot {
  return {
    state,
    selectedId: null,
    grabbedThoughtId: null,
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

function authoring(scene: SpatialFieldScene) {
  return scene.children[3] as Container;
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
    expect(outline.bounds.minX).toBeCloseTo(-thoughtRadius(first.text) - 8);
    expect(outline.bounds.maxX).toBeCloseTo(second.x + thoughtRadius(second.text) + 8);

    scene.render({ ...snapshot(state), selectedId: 'alone' }, viewport);
    scene.advanceAnimations(180);

    expect(clusterOutline(scene).context.instructions).toHaveLength(0);
  });

  it('fades the cluster outline in and out', () => {
    const scene = new SpatialFieldScene();
    const first = {
      id: 'first',
      text: 'First',
      x: 0,
      y: 0,
      tone: 0,
    };
    const second = { ...first, id: 'second', text: 'Second', x: 100 };
    const state = {
      thoughts: [first, second],
      attachments: [['first', 'second']] as [string, string][],
    };

    scene.render({ ...snapshot(state), selectedId: 'first' }, viewport);
    const outline = clusterOutline(scene);
    expect(outline.alpha).toBe(0);

    scene.advanceAnimations(90);
    expect(outline.alpha).toBeCloseTo(0.5);
    scene.advanceAnimations(90);
    expect(outline.alpha).toBe(1);

    scene.render(snapshot(state), viewport);
    expect(outline.context.instructions.length).toBeGreaterThan(0);
    scene.advanceAnimations(90);
    expect(outline.alpha).toBeCloseTo(0.5);
    scene.advanceAnimations(90);
    expect(outline.alpha).toBe(0);
    expect(outline.context.instructions).toHaveLength(0);
  });

  it('forwards the pointer identity needed to recognize a long press', () => {
    const onPointerDown = vi.fn();
    const scene = new SpatialFieldScene(onPointerDown);
    const held = {
      id: 'held',
      text: 'Held',
      x: 0,
      y: 0,
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

  it('quickly fades in a Thought that appears after the initial render', () => {
    const scene = new SpatialFieldScene();
    const appearing = {
      id: 'appearing',
      text: 'Appearing',
      x: 0,
      y: 0,
      tone: 0,
    };
    scene.render(snapshot(), viewport);

    scene.render(snapshot({ thoughts: [appearing], attachments: [] }), viewport);
    const bubble = thoughts(scene).children[0];

    expect(bubble.alpha).toBeCloseTo(0.7);
    expect(bubble.scale.x).toBe(1);
    scene.advanceAnimations(40);
    expect(bubble.alpha).toBeGreaterThan(0.7);
    expect(bubble.alpha).toBeLessThan(1);
    scene.advanceAnimations(40);
    expect(bubble.alpha).toBe(1);
  });

  it('animates authoring in screen space and closes to the persisted Thought scale', () => {
    const scene = new SpatialFieldScene();
    scene.presentAuthoring({
      id: 'draft',
      position: { x: 120, y: 240 },
      tone: 1,
      openScale: 0.5,
      phase: 'open',
      closeScale: 0.75,
      elevation: { source: 1, target: 1, zoom: 1.5 },
    });
    const bubble = authoring(scene).children[0];

    expect(bubble.position).toMatchObject({ x: 120, y: 237 });
    expect(bubble.scale.x).toBe(0.5);
    expect(bubble.alpha).toBeCloseTo(0.3);

    scene.advanceAnimations(240);
    expect(bubble.scale.x).toBe(1);
    expect(bubble.alpha).toBe(1);
    expect(bubble.y).toBe(240);

    scene.presentAuthoring({
      id: 'draft',
      position: { x: 120, y: 240 },
      tone: 1,
      openScale: 0.5,
      phase: 'keep',
      closeScale: 0.75,
      text: 'Crossfade',
      elevation: { source: 1, target: 1, zoom: 1.5 },
    });
    scene.advanceAnimations(100);

    const preview = authoring(scene).children[1];
    expect(bubble.scale.x).toBeGreaterThan(0.8);
    expect(bubble.scale.x).toBeLessThan(0.82);
    expect(bubble.alpha).toBeGreaterThan(0.76);
    expect(bubble.alpha).toBeLessThan(0.78);
    expect(preview.alpha).toBeGreaterThan(0.53);
    expect(preview.alpha).toBeLessThan(0.55);

    scene.advanceAnimations(100);

    expect(bubble.scale.x).toBe(0.75);
    expect(bubble.alpha).toBeCloseTo(0.7);
    expect(bubble.y).toBe(237);
    expect(preview.alpha).toBe(0.7);
    expect(preview.y).toBe(237);

    scene.presentAuthoring();
    expect(authoring(scene).children).toHaveLength(0);
  });

  it('hands a bonded authoring bubble back at resting elevation', () => {
    const filter = { padding: 46, offsetX: 0, offsetY: 0, alpha: 0, blur: 0 };
    const scene = new SpatialFieldScene(undefined, () => filter as never);
    const opening = {
      id: 'bonded-draft',
      position: { x: 80, y: 160 },
      tone: 0,
      openScale: 0.6,
      phase: 'open' as const,
      closeScale: 0.6,
      elevation: { source: 0, target: 0, zoom: 2 },
    };
    scene.presentAuthoring(opening);
    scene.advanceAnimations(240);
    expect(filter).toMatchObject({ offsetY: 10, alpha: 0.18, blur: 11 });

    scene.presentAuthoring({ ...opening, phase: 'cancel-close' });
    scene.advanceAnimations(200);

    expect(authoring(scene).children[0].y).toBe(160);
    expect(filter).toMatchObject({ offsetY: 5, alpha: 0.1, blur: 8 });
  });

  it('reuses a Thought display object while drawing its contact outline behind it', () => {
    const scene = new SpatialFieldScene();
    const thought = {
      id: 'candidate',
      text: 'Candidate',
      x: 0,
      y: 0,
      tone: 0,
    };
    scene.render(snapshot({ thoughts: [thought], attachments: [] }), viewport);
    const renderedThought = thoughts(scene).children[0];

    scene.render(
      snapshot({ thoughts: [thought], attachments: [] }, ['candidate']),
      viewport,
    );

    expect(thoughts(scene).children[0]).toBe(renderedThought);
    expect(clusterOutline(scene).bounds.minX).toBeCloseTo(
      -thoughtRadius(thought.text) - 8,
    );
    expect(clusterOutline(scene).bounds.maxX).toBeCloseTo(
      thoughtRadius(thought.text) + 8,
    );
  });

  it('reserves texture space for the full filtered Thought shadow', () => {
    const scene = new SpatialFieldScene(undefined, () => ({ padding: 34 }) as never);
    const thought = {
      id: 'shadowed',
      text: 'Shadowed',
      x: 0,
      y: 0,
      tone: 0,
    };
    scene.render(snapshot({ thoughts: [thought], attachments: [] }), viewport);

    const cachedVisual = thoughts(scene).children[0].children[0] as Container;
    const cachePadding = cachedVisual.children[0] as Graphics;
    const radius = thoughtRadius(thought.text);

    expect(cachedVisual.children).toHaveLength(3);
    expect(cachePadding.bounds.minX).toBeLessThanOrEqual(-radius - 34);
    expect(cachePadding.bounds.maxX).toBeGreaterThanOrEqual(radius + 34);
    expect(cachePadding.bounds.minY).toBeLessThanOrEqual(-radius - 34);
    expect(cachePadding.bounds.maxY).toBeGreaterThanOrEqual(radius + 34);
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
      tone: 0,
    };
    const second = { ...first, id: 'second', text: 'Second', x: 100 };
    scene.render(
      snapshot({ thoughts: [first, second], attachments: [['first', 'second']] }),
      viewport,
    );
    const cachedVisual = thoughts(scene).children[0].children[0] as Container;
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

  it('raises a bonded Thought while it is grabbed independently', () => {
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
      tone: 0,
    };
    const second = { ...first, id: 'second', text: 'Second', x: 100 };
    const state = {
      thoughts: [first, second],
      attachments: [['first', 'second']] as [string, string][],
    };
    scene.render(snapshot(state), viewport);
    const cachedVisual = thoughts(scene).children[0].children[0] as Container;

    scene.render({ ...snapshot(state), grabbedThoughtId: 'first' }, viewport);
    scene.advanceAnimations(220);

    expect(cachedVisual.y).toBe(-2);
    expect(filters[0]).toMatchObject({ offsetY: 10, alpha: 0.18, blur: 11 });

    scene.render(snapshot(state), viewport);
    scene.advanceAnimations(220);

    expect(cachedVisual.y).toBe(0);
    expect(filters[0]).toMatchObject({ offsetY: 5, alpha: 0.1, blur: 8 });
  });

  it('reuses a Bond display object while its endpoint moves', () => {
    const scene = new SpatialFieldScene();
    const first = {
      id: 'first',
      text: 'First',
      x: 0,
      y: 0,
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

  it('fades a deleted Thought away', () => {
    const scene = new SpatialFieldScene();
    const deleted = {
      id: 'deleted',
      text: 'Deleted',
      x: 0,
      y: 0,
      tone: 0,
    };
    scene.render(snapshot({ thoughts: [deleted], attachments: [] }), viewport);
    const deletedBubble = thoughts(scene).children[0];

    scene.render(snapshot(), viewport);

    expect(thoughts(scene).children).toEqual([deletedBubble]);
    expect(deletedBubble.eventMode).toBe('none');
    scene.advanceAnimations(90);
    expect(deletedBubble.alpha).toBeCloseTo(0.5);
    scene.advanceAnimations(90);
    expect(thoughts(scene).children).toHaveLength(0);
  });

  it('fades a removed Bond after release', () => {
    const scene = new SpatialFieldScene();
    const first = {
      id: 'first',
      text: 'First',
      x: 0,
      y: 0,
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
