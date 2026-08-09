export const THOUGHT_TONES = [0xf5eadc, 0xe3ece7, 0xe8e2ef, 0xf0e8d7, 0xdfe8ee] as const
export const THOUGHT_DARK_TONES = [0x51443a, 0x354a40, 0x463e53, 0x514936, 0x354a55] as const

export function normalizeThoughtTone(tone: number) {
  return ((tone % THOUGHT_TONES.length) + THOUGHT_TONES.length) % THOUGHT_TONES.length
}

export function getThoughtTone(tone: number) {
  const normalizedTone = normalizeThoughtTone(tone)
  const canvas = THOUGHT_TONES[normalizedTone]
  const darkCanvas = THOUGHT_DARK_TONES[normalizedTone]
  return {
    canvas,
    css: colorToCss(canvas),
    darkCanvas,
    darkCss: colorToCss(darkCanvas),
  }
}

function colorToCss(color: number) {
  return `#${color.toString(16).padStart(6, '0')}`
}
