import { Container } from 'pixi.js';
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

    expect(foreground(scene).children).toHaveLength(3);
    expect(foreground(scene).children[1].eventMode).toBe('static');
    expect(foreground(scene).children[2].eventMode).toBe('static');
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

    expect(foreground(scene).children).toHaveLength(2);
    expect(foreground(scene).children[1].x).toBe(100);
    expect(foreground(scene).children[1].eventMode).toBe('static');
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
