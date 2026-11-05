import { css } from '../../styled-system/css'

export const syncDialogClass = css({
  width: 'min(340px, calc(100vw - 36px))',
  padding: '22px',
  border: '1px solid rgb(39 48 44 / 16%)',
  borderRadius: '19.5px',
  background: 'rgb(247 246 241 / 92%)',
  boxShadow: '0 12px 34px rgb(39 48 44 / 12%)',
  backdropFilter: 'blur(16px) saturate(115%)',
  color: '#27302c',
  fontSize: '14px',
  lineHeight: 1.5,
  _backdrop: {
    background: 'rgb(39 48 44 / 12%)',
  },
  '[data-theme=dark] &': {
    borderColor: 'rgb(236 242 238 / 14%)',
    background: 'rgb(30 36 33 / 92%)',
    boxShadow: '0 8px 26px rgb(0 0 0 / 18%)',
    color: '#e7ebe7',
  },
  '& form': {
    display: 'grid',
    gap: '12px',
  },
  '& p': {
    margin: 0,
  },
  '& input': {
    height: '37px',
    padding: '0 12px',
    border: '1px solid rgb(39 48 44 / 18%)',
    borderRadius: '10px',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    '[data-theme=dark] &': {
      borderColor: 'rgb(236 242 238 / 18%)',
    },
  },
})

export const syncButtonClass = css({
  height: '37px',
  border: '1px solid rgb(39 48 44 / 18%)',
  borderRadius: '999px',
  background: 'rgb(39 48 44 / 6%)',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
  _disabled: {
    cursor: 'progress',
    opacity: 0.6,
  },
  '[data-theme=dark] &': {
    borderColor: 'rgb(236 242 238 / 18%)',
    background: 'rgb(236 242 238 / 7%)',
  },
})

export const syncQuietButtonClass = css({
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
  opacity: 0.7,
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
})

export const syncErrorClass = css({
  color: '#9b3d32',
  '[data-theme=dark] &': {
    color: '#f0a397',
  },
})
