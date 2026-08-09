import { css } from '../../styled-system/css'

export const tunerClass = css({
  position: 'fixed',
  zIndex: 20,
  top: '18px',
  right: '18px',
  width: 'min(244px, calc(100vw - 36px))',
  padding: '14px',
  border: '1px solid rgb(255 255 255 / 72%)',
  borderRadius: '18px',
  background: 'rgb(245 243 236 / 88%)',
  boxShadow: '0 12px 32px rgb(51 59 54 / 15%)',
  backdropFilter: 'blur(18px)',
  '@media (max-width: 720px)': {
    top: '56px',
  },
})

export const headingClass = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  marginBottom: '10px',
  color: '#36423c',
  fontSize: '12px',
  fontWeight: 500,
  '& small': {
    color: 'rgb(54 66 60 / 48%)',
    fontSize: '9px',
    fontWeight: 500,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
})

export const presetsClass = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '5px',
  marginBottom: '12px',
})

export const presetButtonClass = css({
  padding: '6px 4px',
  border: '1px solid rgb(54 66 60 / 12%)',
  borderRadius: '999px',
  background: 'rgb(255 255 255 / 42%)',
  color: 'rgb(54 66 60 / 65%)',
  fontSize: '10px',
  textTransform: 'capitalize',
  cursor: 'pointer',
})

export const activePresetButtonClass = css({
  borderColor: 'rgb(72 94 82 / 38%)',
  background: 'rgb(218 229 222 / 80%)',
  color: '#35473e',
})

export const sliderClass = css({
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: '5px 8px',
  alignItems: 'center',
  marginTop: '9px',
  color: 'rgb(54 66 60 / 72%)',
  fontSize: '10px',
  '& output': {
    color: '#36423c',
    fontVariantNumeric: 'tabular-nums',
  },
  '& input': {
    gridColumn: '1 / -1',
    width: '100%',
    accentColor: '#718c7d',
  },
})
