import type { CSSProperties } from 'react'
import { css } from '../styled-system/css'

export function authoringViewportStyle(offsetY: number): CSSProperties {
  return { '--authoring-offset-y': `${offsetY}px` } as CSSProperties
}

export const authoringViewportClass = css({
  position: 'fixed',
  inset: 0,
  transform: 'translateY(var(--authoring-offset-y))',
})

export const appShellClass = css({
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  background:
    'radial-gradient(circle at 48% 43%, rgb(255 255 255 / 65%), transparent 42%), linear-gradient(135deg, #e8e7df, #f2efe7 55%, #e4e8e2)',
  color: '#27302c',
  _after: {
    position: 'absolute',
    zIndex: 0,
    inset: 0,
    background:
      'radial-gradient(circle at 48% 43%, rgb(63 72 68 / 24%), transparent 44%), linear-gradient(135deg, #121614, #1d2220 55%, #141a17)',
    content: '""',
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 480ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  '[data-theme=dark] &': {
    color: '#e7ebe7',
    _after: {
      opacity: 1,
    },
  },
})

export const appHeaderClass = css({
  position: 'absolute',
  zIndex: 20,
  top: 0,
  right: 0,
  left: 0,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: '24px 30px',
  pointerEvents: 'none',
  '& > *': {
    pointerEvents: 'auto',
  },
  '@media (max-width: 720px)': {
    padding: '18px',
  },
})

export const wordmarkMenuClass = css({
  width: '156px',
  overflow: 'hidden',
  border: '1px solid rgb(39 48 44 / 16%)',
  borderRadius: '19.5px',
  background: 'rgb(247 246 241 / 76%)',
  boxShadow: '0 5px 20px rgb(39 48 44 / 7%)',
  backdropFilter: 'blur(16px) saturate(115%)',
  transition: 'border-color 480ms ease, background-color 480ms ease, box-shadow 480ms ease',
  '&[data-open]': {
    boxShadow: '0 12px 34px rgb(39 48 44 / 12%)',
  },
  '[data-theme=dark] &': {
    borderColor: 'rgb(236 242 238 / 14%)',
    background: 'rgb(30 36 33 / 78%)',
    boxShadow: '0 8px 26px rgb(0 0 0 / 18%)',
  },
})

export const wordmarkTriggerClass = css({
  display: 'flex',
  width: '100%',
  height: '37px',
  gap: '10px',
  alignItems: 'center',
  padding: '0 10px',
  border: 0,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
  letterSpacing: '-0.01em',
  textAlign: 'left',
  WebkitTapHighlightColor: 'transparent',
})

export const wordmarkOrbClass = css({
  width: '17px',
  height: '17px',
  border: '1px solid rgb(39 48 44 / 55%)',
  borderRadius: '50%',
  boxShadow: 'inset 4px 4px 8px rgb(255 255 255 / 45%)',
  transition: 'border-color 480ms ease, box-shadow 480ms ease',
  '[data-theme=dark] &': {
    borderColor: 'rgb(231 235 231 / 58%)',
    boxShadow: 'inset 4px 4px 8px rgb(255 255 255 / 10%)',
  },
})

export const wordmarkItemsClass = css({
  height: 0,
  opacity: 0,
  visibility: 'hidden',
  transition: 'height 240ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 160ms ease, visibility 0s linear 240ms',
  '[data-open] &': {
    height: '111px',
    opacity: 1,
    visibility: 'visible',
    transitionDelay: '0ms',
  },
})

export const themeChoiceClass = css({
  display: 'grid',
  height: '35px',
  width: 'calc(100% - 12px)',
  gridTemplateColumns: '16px 1fr auto',
  gap: '7px',
  alignItems: 'center',
  margin: '0 6px',
  padding: '9px 8px',
  overflow: 'hidden',
  border: 0,
  borderTop: '1px solid rgb(39 48 44 / 10%)',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: '13px',
  textAlign: 'left',
  '[data-theme=dark] &': {
    borderTopColor: 'rgb(236 242 238 / 10%)',
  },
})

export const menuActionClass = css({
  display: 'grid',
  height: '35px',
  width: 'calc(100% - 12px)',
  gridTemplateColumns: '16px 1fr',
  gap: '7px',
  alignItems: 'center',
  margin: '0 6px',
  padding: '9px 8px',
  overflow: 'hidden',
  border: 0,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: '13px',
  textAlign: 'left',
  _hover: {
    background: 'rgb(39 48 44 / 6%)',
  },
  '[data-theme=dark] &': {
    _hover: {
      background: 'rgb(236 242 238 / 7%)',
    },
  },
  '&:last-child': {
    marginBottom: '6px',
  },
})

export const fileInputClass = css({
  display: 'none',
})

export const themeSwitchClass = css({
  position: 'relative',
  width: '30px',
  height: '18px',
  border: '1px solid rgb(39 48 44 / 22%)',
  borderRadius: '999px',
  background: 'rgb(39 48 44 / 8%)',
  transition: 'border-color 300ms ease, background-color 300ms ease',
  '& > span': {
    position: 'absolute',
    top: '3px',
    left: '3px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#57615c',
    transition: 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 300ms ease',
  },
  '[aria-checked=true] &': {
    borderColor: 'rgb(180 201 189 / 46%)',
    background: 'rgb(125 157 140 / 42%)',
    '& > span': {
      background: '#edf2ee',
      transform: 'translateX(12px)',
    },
  },
})
