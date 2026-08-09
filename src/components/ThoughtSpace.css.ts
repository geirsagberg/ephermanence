import type { CSSProperties } from 'react'
import { css } from '../../styled-system/css'
import { THOUGHT_ACTION_SIZE } from '../thoughtActions'

type ActionStyle = CSSProperties & Record<'--action-origin-x' | '--action-origin-y', string>

export function actionStyle(center: { x: number; y: number }, position: { x: number; y: number }): ActionStyle {
  return {
    left: position.x,
    top: position.y,
    width: THOUGHT_ACTION_SIZE,
    height: THOUGHT_ACTION_SIZE,
    '--action-origin-x': `${center.x - position.x}px`,
    '--action-origin-y': `${center.y - position.y}px`,
  }
}

export const thoughtSpaceClass = css({
  position: 'absolute',
  zIndex: 1,
  inset: 0,
  touchAction: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  '& canvas': {
    display: 'block',
    width: '100%',
    height: '100%',
    cursor: 'grab',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitTapHighlightColor: 'transparent',
  },
  '&[data-authoring] canvas': {
    pointerEvents: 'none',
  },
  '&[data-native-long-press-haptics]': {
    userSelect: 'auto',
    '& canvas': {
      userSelect: 'auto',
    },
  },
})

export const actionButtonClass = css({
  position: 'absolute',
  zIndex: 6,
  display: 'grid',
  placeItems: 'center',
  padding: 0,
  appearance: 'none',
  border: '1px solid rgb(39 48 44 / 18%)',
  borderRadius: '50%',
  background: '#fff',
  boxShadow: '0 7px 22px rgb(45 52 48 / 10%)',
  color: 'rgb(39 48 44 / 72%)',
  transform: 'translate(-50%, -50%)',
  animation: 'bubbleActionEnter 160ms cubic-bezier(0.2, 0.82, 0.2, 1) both',
  backdropFilter: 'blur(10px)',
  WebkitTapHighlightColor: 'transparent',
  _hover: {
    color: '#28312d',
  },
  _active: {
    background: '#f1efe8',
  },
  '[data-theme=dark] &': {
    borderColor: 'rgb(236 242 238 / 14%)',
    background: 'rgb(37 43 40 / 88%)',
    boxShadow: '0 7px 24px rgb(0 0 0 / 20%)',
    color: 'rgb(236 242 238 / 74%)',
    _hover: {
      color: '#f1f4f1',
    },
    _active: {
      background: '#303633',
    },
  },
  transition: 'border-color 480ms ease, background-color 480ms ease, box-shadow 480ms ease, color 480ms ease',
})

export const directActionButtonClass = css({
  cursor: 'pointer',
})

export const grabActionButtonClass = css({
  cursor: 'grab',
  _active: {
    cursor: 'grabbing',
  },
})
