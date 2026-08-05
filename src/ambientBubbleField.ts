import { Container, Graphics } from 'pixi.js';

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

const chunkSize = 560;
const tones = [0x8fa398, 0xa59ab3, 0xb6a580, 0x8fa5b0];

export class AmbientBubbleField extends Container {
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
        const chunk = createChunk(chunkX, chunkY, normalized);
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

function createChunk(chunkX: number, chunkY: number, settings: AmbientBubbleSettings) {
  const chunk = new Container();
  chunk.position.set(chunkX * chunkSize, chunkY * chunkSize);

  for (let index = 0; index < settings.density; index += 1) {
    const salt = index * 7;
    const x = random(chunkX, chunkY, salt + 1) * chunkSize;
    const y = random(chunkX, chunkY, salt + 2) * chunkSize;
    const radius = (58 + random(chunkX, chunkY, salt + 3) * 122) * settings.size;
    const tone = tones[Math.floor(random(chunkX, chunkY, salt + 4) * tones.length)];
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
