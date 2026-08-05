import { Container, Graphics } from 'pixi.js';

export type WorldBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const chunkSize = 560;
const spill = 220;
const bubblesPerChunk = 3;
const tones = [0x8fa398, 0xa59ab3, 0xb6a580, 0x8fa5b0];

export class AmbientBubbleField extends Container {
  private readonly chunks = new Map<string, Container>();

  constructor() {
    super();
    this.eventMode = 'none';
  }

  update(bounds: WorldBounds) {
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
        const chunk = createChunk(chunkX, chunkY);
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
}

function createChunk(chunkX: number, chunkY: number) {
  const chunk = new Container();
  chunk.position.set(chunkX * chunkSize, chunkY * chunkSize);

  for (let index = 0; index < bubblesPerChunk; index += 1) {
    const salt = index * 7;
    const x = random(chunkX, chunkY, salt + 1) * chunkSize;
    const y = random(chunkX, chunkY, salt + 2) * chunkSize;
    const radius = 58 + random(chunkX, chunkY, salt + 3) * 122;
    const tone = tones[Math.floor(random(chunkX, chunkY, salt + 4) * tones.length)];
    const strength = 0.75 + random(chunkX, chunkY, salt + 5) * 0.5;

    const bubble = new Graphics()
      .circle(x + 3, y + 7, radius + 7)
      .fill({ color: 0x4b554f, alpha: 0.018 * strength })
      .circle(x, y, radius)
      .fill({ color: tone, alpha: 0.07 * strength })
      .circle(x - radius * 0.2, y - radius * 0.22, radius * 0.62)
      .fill({ color: 0xffffff, alpha: 0.06 * strength })
      .circle(x, y, radius - 1)
      .stroke({ color: 0xffffff, width: 1.2, alpha: 0.14 * strength });
    chunk.addChild(bubble);
  }
  return chunk;
}

function random(x: number, y: number, salt: number) {
  let value =
    Math.imul(x, 374_761_393) + Math.imul(y, 668_265_263) + Math.imul(salt, 69_069);
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296;
}
