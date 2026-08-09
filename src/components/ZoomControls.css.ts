import { css } from '../../styled-system/css'

export const zoomControlsClass = css({
  display: 'flex',
  gap: '8px',
  color: 'inherit',
  '& button': {
    display: 'grid',
    width: '39px',
    height: '39px',
    placeItems: 'center',
    padding: 0,
    border: '1px solid rgb(39 48 44 / 16%)',
    borderRadius: '19.5px',
    background: 'rgb(247 246 241 / 76%)',
    boxShadow: '0 5px 20px rgb(39 48 44 / 7%)',
    color: 'inherit',
    cursor: 'pointer',
    backdropFilter: 'blur(16px) saturate(115%)',
    WebkitTapHighlightColor: 'transparent',
    _hover: { background: 'rgb(247 246 241 / 94%)' },
    _active: { background: 'rgb(237 235 228 / 94%)' },
  },
  '[data-theme=dark] &': {
    '& button': {
      borderColor: 'rgb(236 242 238 / 14%)',
      background: 'rgb(30 36 33 / 78%)',
      boxShadow: '0 8px 26px rgb(0 0 0 / 18%)',
      _hover: { background: 'rgb(38 44 41 / 90%)' },
      _active: { background: 'rgb(45 51 48 / 92%)' },
    },
  },
})
