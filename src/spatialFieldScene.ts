import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
  type FederatedPointerEvent,
  type Ticker,
} from 'pixi.js';

import type {
  SpatialInteraction,
  SpatialInteractionSnapshot,
} from './spatialInteraction';
import type { Point } from './spatialField';
import { getThoughtTone } from './thoughtTone';

export type WorldBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type AmbientBubbleSettings = {
  size: number;
  presence: number;
  density: number;
};

export const defaultAmbientBubbleSettings: AmbientBubbleSettings = {
  size: 0.7,
  presence: 0.5,
  density: 3,
};

type ThoughtPointerDown = (
  id: string,
  point: Point,
  singular: boolean,
  pointerId: number,
) => void;
type BondGeometry = { from: Point; to: Point };

const bondFadeDuration = 240;

export class SpatialFieldScene extends Container {
  private readonly ambient = new AmbientBubbleField();
  private readonly bondFades = new Container();
  private readonly foreground = new Container();
  private readonly previousBonds = new Map<string, BondGeometry>();
  private readonly fadingBonds = new Map<
    string,
    { graphic: Graphics; elapsed: number }
  >();

  constructor(private readonly onThoughtPointerDown: ThoughtPointerDown = () => {}) {
    super();
    this.addChild(this.ambient, this.bondFades, this.foreground);
  }

  render(
    snapshot: SpatialInteractionSnapshot,
    bounds: WorldBounds,
    settings: AmbientBubbleSettings = defaultAmbientBubbleSettings,
    hiddenThoughtId?: string,
  ) {
    const { camera, state, attachmentCandidateIds } = snapshot;
    this.ambient.position.set(camera.x, camera.y);
    this.ambient.scale.set(camera.zoom);
    this.bondFades.position.set(camera.x, camera.y);
    this.bondFades.scale.set(camera.zoom);
    this.foreground.position.set(camera.x, camera.y);
    this.foreground.scale.set(camera.zoom);
    this.ambient.update(bounds, settings);
    this.foreground
      .removeChildren()
      .forEach((child) => child.destroy({ children: true }));

    const positions = new Map(state.thoughts.map((thought) => [thought.id, thought]));
    const nextBonds = new Map<string, BondGeometry>();
    for (const [a, b] of state.attachments) {
      const from = positions.get(a);
      const to = positions.get(b);
      if (!from || !to) continue;
      const key = bondKey(a, b);
      const fading = this.fadingBonds.get(key);
      if (fading) {
        fading.graphic.removeFromParent();
        fading.graphic.destroy();
        this.fadingBonds.delete(key);
      }
      nextBonds.set(key, {
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
      });
      this.foreground.addChild(
        createBond({ from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } }),
      );
    }

    for (const [key, geometry] of this.previousBonds) {
      if (nextBonds.has(key) || this.fadingBonds.has(key)) continue;
      const graphic = createBond(geometry);
      this.bondFades.addChild(graphic);
      this.fadingBonds.set(key, { graphic, elapsed: 0 });
    }
    this.previousBonds.clear();
    for (const [key, geometry] of nextBonds) {
      this.previousBonds.set(key, geometry);
    }

    for (const thought of state.thoughts) {
      if (thought.id === hiddenThoughtId) continue;
      this.foreground.addChild(
        createThoughtBubble(
          thought,
          attachmentCandidateIds.includes(thought.id),
          this.onThoughtPointerDown,
        ),
      );
    }
  }

  advanceBondFades(deltaMs: number) {
    for (const [key, fading] of this.fadingBonds) {
      fading.elapsed += deltaMs;
      const progress = Math.min(1, fading.elapsed / bondFadeDuration);
      fading.graphic.alpha = 1 - progress;
      if (progress < 1) continue;
      fading.graphic.removeFromParent();
      fading.graphic.destroy();
      this.fadingBonds.delete(key);
    }
  }
}

function bondKey(a: string, b: string) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function createBond({ from, to }: BondGeometry) {
  return new Graphics()
    .moveTo(from.x, from.y)
    .lineTo(to.x, to.y)
    .stroke({ color: 0xa6a99e, width: 10, alpha: 0.16 });
}

export type MountedSpatialFieldScene = {
  canvas: HTMLCanvasElement;
  screen: { width: number; height: number };
  render: (settings?: AmbientBubbleSettings, hiddenThoughtId?: string) => void;
  onResize: (listener: () => void) => () => void;
  destroy: () => void;
};

export async function mountSpatialFieldScene(
  host: HTMLElement,
  interaction: SpatialInteraction,
  onThoughtPointerDown: ThoughtPointerDown,
): Promise<MountedSpatialFieldScene> {
  const app = new Application();
  await app.init({
    antialias: true,
    backgroundAlpha: 0,
    resizeTo: host,
    resolution: window.devicePixelRatio,
    autoDensity: true,
  });
  const scene = new SpatialFieldScene(onThoughtPointerDown);
  const advanceBondFades = (ticker: Ticker) => {
    scene.advanceBondFades(ticker.deltaMS);
  };
  app.ticker.add(advanceBondFades);
  app.stage.addChild(scene);
  host.appendChild(app.canvas);
  app.canvas.setAttribute('aria-label', 'Interactive space of thought bubbles');

  return {
    canvas: app.canvas,
    get screen() {
      return app.screen;
    },
    render(settings = defaultAmbientBubbleSettings, hiddenThoughtId) {
      const topLeft = interaction.screenToWorld({ x: 0, y: 0 });
      const bottomRight = interaction.screenToWorld({
        x: app.screen.width,
        y: app.screen.height,
      });
      scene.render(
        interaction.read(),
        {
          left: topLeft.x,
          right: bottomRight.x,
          top: topLeft.y,
          bottom: bottomRight.y,
        },
        settings,
        hiddenThoughtId,
      );
    },
    onResize(listener) {
      app.renderer.on('resize', listener);
      return () => app.renderer.off('resize', listener);
    },
    destroy() {
      app.ticker.remove(advanceBondFades);
      app.destroy(true, { children: true });
    },
  };
}

function createThoughtBubble(
  thought: SpatialInteractionSnapshot['state']['thoughts'][number],
  attachmentCandidate: boolean,
  onPointerDown: ThoughtPointerDown,
) {
  const bubble = new Container();
  bubble.x = thought.x;
  bubble.y = thought.y;
  bubble.eventMode = 'static';
  bubble.cursor = 'grab';
  bubble.hitArea = {
    contains: (x: number, y: number) => x * x + y * y <= thought.radius * thought.radius,
  };

  const shadow = new Graphics()
    .circle(3, 7, thought.radius + 3)
    .fill({ color: 0x49504a, alpha: 0.07 });
  const attachmentHalo = attachmentCandidate
    ? new Graphics()
        .circle(0, 0, thought.radius + 7)
        .fill({ color: 0xf5fff9, alpha: 0.2 })
        .stroke({ color: 0x718c7d, alpha: 0.68, width: 4 })
    : null;
  const body = new Graphics()
    .circle(0, 0, thought.radius)
    .fill({ color: getThoughtTone(thought.tone).canvas, alpha: 0.96 })
    .circle(-thought.radius * 0.22, -thought.radius * 0.24, thought.radius * 0.66)
    .fill({ color: 0xffffff, alpha: 0.15 })
    .circle(0, 0, thought.radius - 1)
    .stroke({ color: 0xffffff, alpha: 0.55, width: 1 });

  const label = new Text({
    text: thought.text,
    autoGenerateMipmaps: true,
    style: new TextStyle({
      fontFamily: 'Iowan Old Style, Baskerville, Georgia, serif',
      fontSize: thought.text.length > 48 ? 16 : 17,
      fill: 0x26312d,
      align: 'center',
      lineHeight: 23,
      wordWrap: true,
      wordWrapWidth: thought.radius * 1.42,
    }),
  });
  label.anchor.set(0.5);
  if (attachmentHalo) bubble.addChild(attachmentHalo);
  bubble.addChild(shadow, body, label);
  bubble.on('pointerdown', (event: FederatedPointerEvent) => {
    onPointerDown(
      thought.id,
      { x: event.global.x, y: event.global.y },
      event.shiftKey,
      event.pointerId,
    );
    bubble.cursor = 'grabbing';
  });
  return bubble;
}

const chunkSize = 560;
const ambientTones = [0x8fa398, 0xa59ab3, 0xb6a580, 0x8fa5b0];

class AmbientBubbleField extends Container {
  private readonly chunks = new Map<string, Container>();
  private settingsKey = '';

  constructor() {
    super();
    this.eventMode = 'none';
  }

  update(
    bounds: WorldBounds,
    settings: AmbientBubbleSettings = defaultAmbientBubbleSettings,
  ) {
    const normalized = normalizeSettings(settings);
    const nextSettingsKey = `${normalized.size}:${normalized.presence}:${normalized.density}`;
    if (nextSettingsKey !== this.settingsKey) {
      this.settingsKey = nextSettingsKey;
      this.clearChunks();
    }

    const spill = 220 * normalized.size;
    const left = Math.floor((bounds.left - spill) / chunkSize);
    const right = Math.floor((bounds.right + spill) / chunkSize);
    const top = Math.floor((bounds.top - spill) / chunkSize);
    const bottom = Math.floor((bounds.bottom + spill) / chunkSize);
    const visible = new Set<string>();

    for (let chunkX = left; chunkX <= right; chunkX += 1) {
      for (let chunkY = top; chunkY <= bottom; chunkY += 1) {
        const key = `${chunkX}:${chunkY}`;
        visible.add(key);
        if (this.chunks.has(key)) continue;
        const chunk = createAmbientChunk(chunkX, chunkY, normalized);
        this.chunks.set(key, chunk);
        this.addChild(chunk);
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (visible.has(key)) continue;
      this.chunks.delete(key);
      this.removeChild(chunk);
      chunk.destroy({ children: true });
    }
  }

  private clearChunks() {
    for (const chunk of this.chunks.values()) {
      this.removeChild(chunk);
      chunk.destroy({ children: true });
    }
    this.chunks.clear();
  }
}

function createAmbientChunk(
  chunkX: number,
  chunkY: number,
  settings: AmbientBubbleSettings,
) {
  const chunk = new Container();
  chunk.position.set(chunkX * chunkSize, chunkY * chunkSize);

  for (let index = 0; index < settings.density; index += 1) {
    const salt = index * 7;
    const x = random(chunkX, chunkY, salt + 1) * chunkSize;
    const y = random(chunkX, chunkY, salt + 2) * chunkSize;
    const radius = (58 + random(chunkX, chunkY, salt + 3) * 122) * settings.size;
    const tone =
      ambientTones[Math.floor(random(chunkX, chunkY, salt + 4) * ambientTones.length)];
    const strength = 0.75 + random(chunkX, chunkY, salt + 5) * 0.5;

    const bubble = new Graphics()
      .circle(x + 3, y + 7, radius + 7)
      .fill({ color: 0x4b554f, alpha: 0.018 * strength * settings.presence })
      .circle(x, y, radius)
      .fill({ color: tone, alpha: 0.07 * strength * settings.presence })
      .circle(x - radius * 0.2, y - radius * 0.22, radius * 0.62)
      .fill({ color: 0xffffff, alpha: 0.06 * strength * settings.presence })
      .circle(x, y, radius - 1)
      .stroke({
        color: 0xffffff,
        width: 1.2,
        alpha: 0.14 * strength * settings.presence,
      });
    chunk.addChild(bubble);
  }
  return chunk;
}

function normalizeSettings(settings: AmbientBubbleSettings): AmbientBubbleSettings {
  return {
    size: clamp(settings.size, 0.4, 1.5),
    presence: clamp(settings.presence, 0.1, 1.25),
    density: Math.round(clamp(settings.density, 1, 5)),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function random(x: number, y: number, salt: number) {
  let value =
    Math.imul(x, 374_761_393) + Math.imul(y, 668_265_263) + Math.imul(salt, 69_069);
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296;
}
