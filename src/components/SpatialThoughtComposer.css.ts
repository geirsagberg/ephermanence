import type { CSSProperties } from 'react'
import { css } from '../../styled-system/css'

type ComposerStyle = CSSProperties & Record<'--composer-open-scale' | '--composer-close-scale', string | number>

export function composerStyle({
  x,
  y,
  openScale,
  closeScale,
}: {
  x: number
  y: number
  openScale: number
  closeScale: number
}): ComposerStyle {
  return {
    left: x,
    top: y,
    '--composer-open-scale': openScale,
    '--composer-close-scale': closeScale,
  }
}

export const composerClass = css({
  position: 'fixed',
  zIndex: 10,
  display: 'grid',
  width: '210px',
  height: '210px',
  placeItems: 'center',
  padding: '28px',
  border: 0,
  borderRadius: '50%',
  background: 'transparent',
  transform: 'translate(-50%, -50%)',
  animation: 'composerBloom 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
  '&[data-exit]': {
    pointerEvents: 'none',
  },
  '&[data-exit="cancel-dismiss"]': {
    animation: 'composerDismiss 180ms ease-in both',
  },
  '&[data-exit="cancel-close"], &[data-exit="keep"]': {
    animation: 'composerClose 200ms cubic-bezier(0.4, 0, 0.2, 1) both',
  },
  '& textarea': {
    width: '100%',
    height: 'auto',
    maxHeight: '112px',
    overflowY: 'hidden',
    padding: 0,
    border: 0,
    background: 'transparent',
    color: '#26312d',
    fontFamily: 'serif',
    fontSize: '18px',
    lineHeight: 1.18,
    textAlign: 'center',
    outline: 0,
    resize: 'none',
    '&::placeholder': {
      color: 'rgb(38 49 45 / 38%)',
    },
    '[data-theme=dark] &': {
      color: '#e8eee9',
      '&::placeholder': {
        color: 'rgb(232 238 233 / 40%)',
      },
    },
    transition: 'color 480ms ease',
  },
})
