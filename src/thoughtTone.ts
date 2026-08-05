export const THOUGHT_TONES = [0xf5eadc, 0xe3ece7, 0xe8e2ef, 0xf0e8d7, 0xdfe8ee] as const;

export function normalizeThoughtTone(tone: number) {
  return ((tone % THOUGHT_TONES.length) + THOUGHT_TONES.length) % THOUGHT_TONES.length;
}

export function getThoughtTone(tone: number) {
  const canvas = THOUGHT_TONES[normalizeThoughtTone(tone)];
  return { canvas, css: `#${canvas.toString(16).padStart(6, '0')}` };
}
