import type { CSSProperties } from 'react'
import { css } from '../../styled-system/css'

type Position = { x: number; y: number }

type ToneStyle = CSSProperties & Record<'--thought-tone' | '--thought-tone-dark', string>

export function launcherToneStyle(tone: string, darkTone: string): ToneStyle {
  return {
    '--thought-tone': tone,
    '--thought-tone-dark': darkTone,
  }
}

export function launcherDragStyle(position: Position): CSSProperties {
  return {
    left: position.x,
    top: position.y,
    right: 'auto',
    bottom: 'auto',
    transform: 'translate(-50%, -50%)',
  }
}

type SeedStyle = CSSProperties & Record<'--launch-x' | '--launch-y', string>

export function launcherSeedStyle(start: Position, target: Position): SeedStyle {
  return {
    left: start.x,
    top: start.y,
    '--launch-x': `${target.x - start.x}px`,
    '--launch-y': `${target.y - start.y}px`,
  }
}

export const launcherClass = css({
  position: 'fixed',
  zIndex: 8,
  inset: 0,
  pointerEvents: 'none',
})

export const launcherBubbleClass = css({
  position: 'fixed',
  bottom: 'max(22px, env(safe-area-inset-bottom))',
  left: '50%',
  display: 'grid',
  width: '58px',
  height: '58px',
  placeItems: 'center',
  padding: 0,
  border: '1px solid rgb(255 255 255 / 72%)',
  borderRadius: '50%',
  backgroundColor: 'var(--thought-tone)',
  backgroundImage: 'radial-gradient(circle at 35% 28%, rgb(255 255 255 / 58%), transparent 34%)',
  boxShadow: '0 12px 34px rgb(48 61 54 / 14%), inset 0 -4px 12px rgb(70 92 80 / 6%)',
  color: '#43544b',
  cursor: 'grab',
  touchAction: 'none',
  transform: 'translateX(-50%)',
  pointerEvents: 'auto',
  WebkitTapHighlightColor: 'transparent',
  _active: {
    width: '66px',
    height: '66px',
    boxShadow: '0 16px 40px rgb(48 61 54 / 18%)',
    cursor: 'grabbing',
  },
  '[data-theme=dark] &': {
    borderColor: 'rgb(236 242 238 / 24%)',
    backgroundColor: 'var(--thought-tone-dark)',
    backgroundImage: 'radial-gradient(circle at 35% 28%, rgb(255 255 255 / 12%), transparent 34%)',
    boxShadow: '0 14px 38px rgb(0 0 0 / 26%), inset 0 -4px 12px rgb(0 0 0 / 8%)',
    color: '#e7ede8',
  },
  transition:
    'width 180ms ease, height 180ms ease, border-color 480ms ease, background-color 480ms ease, box-shadow 480ms ease, color 480ms ease',
})

export const launcherSeedClass = css({
  position: 'fixed',
  width: '58px',
  height: '58px',
  border: '1px solid rgb(255 255 255 / 76%)',
  borderRadius: '50%',
  backgroundColor: 'var(--thought-tone)',
  backgroundImage: 'radial-gradient(circle at 35% 28%, rgb(255 255 255 / 62%), transparent 34%)',
  boxShadow: '0 12px 34px rgb(48 61 54 / 12%)',
  animation: 'launchSeed 200ms ease-out both',
  '[data-theme=dark] &': {
    borderColor: 'rgb(236 242 238 / 26%)',
    backgroundColor: 'var(--thought-tone-dark)',
    backgroundImage: 'radial-gradient(circle at 35% 28%, rgb(255 255 255 / 14%), transparent 34%)',
    boxShadow: '0 12px 34px rgb(0 0 0 / 24%)',
  },
})
