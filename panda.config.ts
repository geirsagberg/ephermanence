import { defineConfig, defineGlobalStyles } from '@pandacss/dev';

const globalCss = defineGlobalStyles({
  ':root': {
    fontFamily: 'sans',
    color: 'ink',
    background: 'canvas',
    fontSynthesis: 'none',
    textRendering: 'optimizeLegibility',
  },
  'html, body, #root': {
    width: '100%',
    minWidth: '320px',
    height: '100%',
    margin: '0',
    overflow: 'hidden',
  },
  button: {
    userSelect: 'none',
  },
  'button:focus-visible, input:focus-visible, textarea:focus-visible': {
    outline: '2px solid token(colors.focusRing)',
    outlineOffset: '3px',
  },
});

export default defineConfig({
  preflight: true,
  jsxFramework: 'react',
  include: ['./src/**/*.{ts,tsx}'],
  outdir: 'styled-system',
  globalCss,
  theme: {
    extend: {
      tokens: {
        fonts: {
          sans: { value: '"DM Sans", sans-serif' },
          serif: { value: '"Newsreader", serif' },
        },
        colors: {
          ink: { value: '#27302c' },
          canvas: { value: '#ebe8df' },
          focusRing: { value: '#5e6f65' },
        },
      },
      keyframes: {
        bubbleActionEnter: {
          from: {
            opacity: 0.2,
            transform:
              'translate(calc(-50% + var(--action-origin-x)), calc(-50% + var(--action-origin-y))) scale(0.68)',
          },
          to: {
            opacity: 1,
            transform: 'translate(-50%, -50%) scale(1)',
          },
        },
        composerBloom: {
          from: {
            opacity: 0.3,
            transform: 'translate(-50%, -50%) scale(0.25)',
          },
          to: {
            opacity: 1,
            transform: 'translate(-50%, -50%) scale(1)',
          },
        },
        launchSeed: {
          from: {
            opacity: 0.72,
            transform: 'translate(-50%, -50%) scale(0.82)',
          },
          to: {
            opacity: 1,
            transform:
              'translate(calc(-50% + var(--launch-x)), calc(-50% + var(--launch-y))) scale(1.08)',
          },
        },
      },
    },
  },
});
