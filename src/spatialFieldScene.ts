import { DropShadowFilter } from 'pixi-filters/drop-shadow';
import {
  Application,
  CanvasTextMetrics,
  Container,
  Graphics,
  Text,
  TextStyle,
  type FederatedPointerEvent,
  type Ticker,
} from 'pixi.js';

import { connectedThoughtIds, type Point } from './spatialField';
import type {
  SpatialInteraction,
  SpatialInteractionSnapshot,
} from './spatialInteraction';
import { getThoughtTone } from './thoughtTone';
import { layoutThoughtText } from './thoughtTextLayout';

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
type ThoughtShadowFilterFactory = (elevation: number) => DropShadowFilter;
type ActiveBond = { graphic: Graphics; geometry: BondGeometry };
type ThoughtBubbleRecord = {
  bubble: Container;
  cachedVisual: Container;
  shadowFilter?: DropShadowFilter;
  appearance: number;
  elevation: number;
  targetElevation: number;
  text: string;
  radius: number;
  tone: number;
};

const bondFadeDuration = 240;
const clusterOutlineFadeDuration = 180;
const thoughtFadeDuration = 180;
const thoughtAppearanceDuration = 80;
const thoughtAppearanceStartAlpha = 0.7;
const thoughtElevationDuration = 220;
const thoughtRise = 2;
const maxThoughtShadowPadding = 46;

export class SpatialFieldScene extends Container {
  private readonly ambient = new AmbientBubbleField();
  private readonly bondFades = new Container();
  private readonly foreground = new Container();
  private readonly clusterOutline = new Graphics();
  private clusterOutlineTargetAlpha = 0;
  private readonly bonds = new Container();
  private readonly thoughts = new Container();
  private readonly activeBonds = new Map<string, ActiveBond>();
  private readonly thoughtBubbles = new Map<string, ThoughtBubbleRecord>();
  private readonly fadingThoughts = new Map<
    string,
    { bubble: Container; elapsed: number }
  >();
  private readonly fadingBonds = new Map<
    string,
    { graphic: Graphics; elapsed: number }
  >();
  private hasRendered = false;
  constructor(
    private readonly onThoughtPointerDown: ThoughtPointerDown = () => {},
    private readonly createThoughtShadowFilter?: ThoughtShadowFilterFactory,
  ) {
    super();
    this.clusterOutline.alpha = 0;
    this.foreground.addChild(this.clusterOutline, this.bonds, this.thoughts);
    this.addChild(this.ambient, this.bondFades, this.foreground);
  }

  render(
    snapshot: SpatialInteractionSnapshot,
    bounds: WorldBounds,
    settings: AmbientBubbleSettings = defaultAmbientBubbleSettings,
    hiddenThoughtId?: string,
  ) {
    const { camera, state, selectedId, grabbedThoughtId, attachmentCandidateIds } =
      snapshot;
    this.ambient.position.set(camera.x, camera.y);
    this.ambient.scale.set(camera.zoom);
    this.bondFades.position.set(camera.x, camera.y);
    this.bondFades.scale.set(camera.zoom);
    this.foreground.position.set(camera.x, camera.y);
    this.foreground.scale.set(camera.zoom);
    this.ambient.update(bounds, settings);
    this.drawInteractionOutline(state, selectedId, attachmentCandidateIds);
    this.bonds.removeChildren();
    this.thoughts.removeChildren();

    const positions = new Map(state.thoughts.map((thought) => [thought.id, thought]));
    const bondedThoughtIds = new Set(state.attachments.flat());
    const nextBondKeys = new Set<string>();
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
      const geometry = {
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
      };
      nextBondKeys.add(key);
      let active = this.activeBonds.get(key);
      if (!active) {
        active = { graphic: createBond(geometry), geometry };
        this.activeBonds.set(key, active);
      } else if (!sameBondGeometry(active.geometry, geometry)) {
        drawBond(active.graphic, geometry);
        active.geometry = geometry;
      }
      this.bonds.addChild(active.graphic);
    }

    for (const [key, active] of this.activeBonds) {
      if (nextBondKeys.has(key)) continue;
      this.bondFades.addChild(active.graphic);
      this.fadingBonds.set(key, { graphic: active.graphic, elapsed: 0 });
      this.activeBonds.delete(key);
    }

    const nextThoughtIds = new Set<string>();
    for (const thought of state.thoughts) {
      if (thought.id === hiddenThoughtId) continue;
      nextThoughtIds.add(thought.id);
      const targetElevation =
        !bondedThoughtIds.has(thought.id) || grabbedThoughtId === thought.id ? 1 : 0;
      let record = this.thoughtBubbles.get(thought.id);
      if (!record || !sameThoughtVisual(record, thought)) {
        record?.bubble.destroy({ children: true });
        const created = createThoughtBubble(
          thought,
          this.onThoughtPointerDown,
          this.createThoughtShadowFilter,
          targetElevation,
        );
        record = {
          ...created,
          appearance: this.hasRendered ? 0 : 1,
          elevation: targetElevation,
          targetElevation,
          text: thought.text,
          radius: thought.radius,
          tone: thought.tone,
        };
        applyThoughtAppearance(record.bubble, record.appearance);
        this.thoughtBubbles.set(thought.id, record);
      }
      record.targetElevation = targetElevation;
      record.bubble.position.set(thought.x, thought.y);
      record.bubble.cursor = 'grab';
      this.thoughts.addChild(record.bubble);
    }

    for (const [id, record] of this.thoughtBubbles) {
      if (nextThoughtIds.has(id)) continue;
      if (id === hiddenThoughtId) {
        record.bubble.destroy({ children: true });
      } else {
        record.bubble.eventMode = 'none';
        record.bubble.cursor = 'default';
        this.fadingThoughts.set(id, { bubble: record.bubble, elapsed: 0 });
      }
      this.thoughtBubbles.delete(id);
    }
    for (const fading of this.fadingThoughts.values()) {
      this.thoughts.addChild(fading.bubble);
    }
    this.hasRendered = true;
  }

  advanceAnimations(deltaMs: number) {
    if (this.clusterOutline.alpha !== this.clusterOutlineTargetAlpha) {
      const direction = Math.sign(
        this.clusterOutlineTargetAlpha - this.clusterOutline.alpha,
      );
      this.clusterOutline.alpha = Math.max(
        0,
        Math.min(
          1,
          this.clusterOutline.alpha +
            direction *
              Math.min(
                deltaMs / clusterOutlineFadeDuration,
                Math.abs(this.clusterOutlineTargetAlpha - this.clusterOutline.alpha),
              ),
        ),
      );
      if (this.clusterOutline.alpha === 0) this.clusterOutline.clear();
    }

    for (const [key, fading] of this.fadingBonds) {
      fading.elapsed += deltaMs;
      const progress = Math.min(1, fading.elapsed / bondFadeDuration);
      fading.graphic.alpha = 1 - progress;
      if (progress < 1) continue;
      fading.graphic.removeFromParent();
      fading.graphic.destroy();
      this.fadingBonds.delete(key);
    }

    for (const [id, fading] of this.fadingThoughts) {
      fading.elapsed += deltaMs;
      const progress = Math.min(1, fading.elapsed / thoughtFadeDuration);
      fading.bubble.alpha = 1 - progress;
      if (progress < 1) continue;
      fading.bubble.removeFromParent();
      fading.bubble.destroy({ children: true });
      this.fadingThoughts.delete(id);
    }

    const elevationStep = deltaMs / thoughtElevationDuration;
    for (const record of this.thoughtBubbles.values()) {
      if (record.appearance < 1) {
        record.appearance = Math.min(
          1,
          record.appearance + deltaMs / thoughtAppearanceDuration,
        );
        applyThoughtAppearance(record.bubble, record.appearance);
      }
      if (record.elevation === record.targetElevation) continue;
      const direction = Math.sign(record.targetElevation - record.elevation);
      record.elevation = Math.max(
        0,
        Math.min(
          1,
          record.elevation +
            direction *
              Math.min(
                elevationStep,
                Math.abs(record.targetElevation - record.elevation),
              ),
        ),
      );
      record.cachedVisual.y =
        record.elevation === 0 ? 0 : -thoughtRise * record.elevation;
      if (record.shadowFilter) {
        applyThoughtElevation(record.shadowFilter, record.elevation);
        record.cachedVisual.updateCacheTexture();
      }
    }
  }

  private drawInteractionOutline(
    state: SpatialInteractionSnapshot['state'],
    selectedId: string | null,
    attachmentCandidateIds: string[],
  ) {
    const outlinedIds = new Set<string>();
    if (selectedId) {
      const clusterIds = connectedThoughtIds(selectedId, state.attachments);
      if (clusterIds.size > 1) {
        for (const id of clusterIds) outlinedIds.add(id);
      }
    } else {
      for (const candidateId of attachmentCandidateIds) {
        for (const id of connectedThoughtIds(candidateId, state.attachments)) {
          outlinedIds.add(id);
        }
      }
    }

    this.clusterOutlineTargetAlpha = outlinedIds.size > 0 ? 1 : 0;
    if (outlinedIds.size === 0) {
      if (this.clusterOutline.alpha === 0) this.clusterOutline.clear();
      return;
    }

    this.clusterOutline.clear();
    for (const thought of state.thoughts) {
      if (!outlinedIds.has(thought.id)) continue;
      this.clusterOutline
        .circle(thought.x, thought.y, thought.radius + 8)
        .fill({ color: 0x718c7d, alpha: 0.22 });
    }
  }
}

function sameThoughtVisual(
  record: ThoughtBubbleRecord,
  thought: SpatialInteractionSnapshot['state']['thoughts'][number],
) {
  return (
    record.text === thought.text &&
    record.radius === thought.radius &&
    record.tone === thought.tone
  );
}

function applyThoughtAppearance(bubble: Container, progress: number) {
  const eased = 1 - (1 - progress) ** 3;
  bubble.alpha = thoughtAppearanceStartAlpha + (1 - thoughtAppearanceStartAlpha) * eased;
}

function sameBondGeometry(left: BondGeometry, right: BondGeometry) {
  return (
    left.from.x === right.from.x &&
    left.from.y === right.from.y &&
    left.to.x === right.to.x &&
    left.to.y === right.to.y
  );
}

function bondKey(a: string, b: string) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function createBond(geometry: BondGeometry) {
  return drawBond(new Graphics(), geometry);
}

function drawBond(graphic: Graphics, { from, to }: BondGeometry) {
  return graphic
    .clear()
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
  const scene = new SpatialFieldScene(onThoughtPointerDown, createThoughtShadowFilter);
  const advanceAnimations = (ticker: Ticker) => {
    scene.advanceAnimations(ticker.deltaMS);
  };
  app.ticker.add(advanceAnimations);
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
      app.ticker.remove(advanceAnimations);
      app.destroy(true, { children: true });
    },
  };
}

function createThoughtBubble(
  thought: SpatialInteractionSnapshot['state']['thoughts'][number],
  onPointerDown: ThoughtPointerDown,
  createShadowFilter?: ThoughtShadowFilterFactory,
  elevation = 0,
) {
  const bubble = new Container();
  bubble.x = thought.x;
  bubble.y = thought.y;
  bubble.eventMode = 'static';
  bubble.cursor = 'grab';
  bubble.hitArea = {
    contains: (x: number, y: number) => x * x + y * y <= thought.radius * thought.radius,
  };

  const body = new Graphics()
    .circle(0, 0, thought.radius)
    .fill({ color: getThoughtTone(thought.tone).canvas, alpha: 0.96 })
    .circle(-thought.radius * 0.22, -thought.radius * 0.24, thought.radius * 0.66)
    .fill({ color: 0xffffff, alpha: 0.15 })
    .circle(0, 0, thought.radius - 1)
    .stroke({ color: 0xffffff, alpha: 0.55, width: 1 });
  const shadowFilter = createShadowFilter?.(elevation);
  if (shadowFilter) {
    applyThoughtElevation(shadowFilter, elevation);
    body.filters = [shadowFilter];
  }

  let textStyle: TextStyle | null = null;
  const textLayout = layoutThoughtText({
    text: thought.text,
    radius: thought.radius,
    measureText: (text, style) => {
      textStyle ??= new TextStyle(style);
      return CanvasTextMetrics.measureText(text, textStyle, undefined, false).width;
    },
  });
  textStyle ??= new TextStyle(textLayout.style);
  const label = new Text({
    text: textLayout.text,
    autoGenerateMipmaps: true,
    style: textStyle,
  });
  label.anchor.set(0.5);
  const cachedVisual = new Container();
  cachedVisual.y = -thoughtRise * elevation;
  if (shadowFilter) {
    const extent = thought.radius + maxThoughtShadowPadding;
    const cachePadding = new Graphics()
      .rect(-extent, -extent, extent * 2, extent * 2)
      .fill({ color: 0, alpha: 0 });
    cachedVisual.addChild(cachePadding);
  }
  cachedVisual.addChild(body, label);
  cachedVisual.cacheAsTexture({ antialias: true });
  bubble.addChild(cachedVisual);
  bubble.on('pointerdown', (event: FederatedPointerEvent) => {
    onPointerDown(
      thought.id,
      { x: event.global.x, y: event.global.y },
      event.shiftKey,
      event.pointerId,
    );
    bubble.cursor = 'grabbing';
  });
  return { bubble, cachedVisual, shadowFilter };
}

function createThoughtShadowFilter(elevation: number) {
  const filter = new DropShadowFilter({
    offset: { x: 2, y: 6 },
    color: 0x49504a,
    alpha: 0.1,
    blur: 8,
    quality: 3,
  });
  applyThoughtElevation(filter, elevation);
  return filter;
}

function applyThoughtElevation(filter: DropShadowFilter, elevation: number) {
  filter.offsetX = 2;
  filter.offsetY = 5 + elevation * 5;
  filter.alpha = 0.1 + elevation * 0.08;
  filter.blur = 8 + elevation * 3;
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
