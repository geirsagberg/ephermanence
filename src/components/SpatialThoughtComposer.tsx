import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ThoughtAuthoringPresentation } from '../spatialFieldScene'
import { composerPositionForKeyboard } from '../touchThoughtAuthoring'
import { composerClass, composerStyle } from './SpatialThoughtComposer.css'

export type DraftPosition = { x: number; y: number }

type SpatialThoughtComposerProps = {
  dismissOnCancel?: boolean
  cancelTargetScale?: number
  openScale?: number
  position: DraftPosition
  initialText?: string
  label?: string
  visualId: string
  tone: number
  elevation: ThoughtAuthoringPresentation['elevation']
  onCancel: () => void
  onExitComplete: () => void
  onKeep: (text: string) => void
  onVisualChange: (presentation?: ThoughtAuthoringPresentation) => void
  onViewportOffsetChange: (offsetY: number) => void
  targetScaleForText: (text: string) => number
}

export function SpatialThoughtComposer({
  dismissOnCancel = false,
  cancelTargetScale = 0.25,
  openScale = 0.25,
  position,
  initialText = '',
  label = 'New thought at this position',
  visualId,
  tone,
  elevation,
  onCancel,
  onExitComplete,
  onKeep,
  onVisualChange,
  onViewportOffsetChange,
  targetScaleForText,
}: SpatialThoughtComposerProps) {
  const [text, setText] = useState(initialText)
  const [exit, setExit] = useState<'cancel-close' | 'cancel-dismiss' | 'keep' | null>(null)
  const [closeScale, setCloseScale] = useState(0.25)
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const savedRef = useRef(false)
  const pendingTextRef = useRef('')

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const updatePosition = () => {
      const visualViewport = window.visualViewport
      const safePosition = composerPositionForKeyboard({
        position,
        layoutHeight: window.innerHeight,
        visualViewport: visualViewport
          ? { offsetTop: visualViewport.offsetTop, height: visualViewport.height }
          : undefined,
      })
      onViewportOffsetChange(safePosition.y - position.y)
    }
    updatePosition()
    textarea.focus({ preventScroll: true })
    const end = textarea.value.length
    textarea.setSelectionRange(end, end)
    window.visualViewport?.addEventListener('resize', updatePosition)
    window.visualViewport?.addEventListener('scroll', updatePosition)
    return () => {
      window.visualViewport?.removeEventListener('resize', updatePosition)
      window.visualViewport?.removeEventListener('scroll', updatePosition)
      onViewportOffsetChange(0)
    }
  }, [onViewportOffsetChange, position])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = '0'
    const contentHeight = Math.ceil(textarea.scrollHeight)
    textarea.style.height = `${Math.min(contentHeight, 112)}px`
    textarea.style.overflowY = contentHeight > 112 ? 'auto' : 'hidden'
  }, [text])

  useLayoutEffect(() => {
    onVisualChange({
      id: visualId,
      position,
      tone,
      openScale,
      phase: exit ?? 'open',
      closeScale,
      text: exit === 'keep' ? pendingTextRef.current : exit === 'cancel-close' ? initialText : undefined,
      elevation,
    })
  }, [closeScale, elevation, exit, initialText, onVisualChange, openScale, position, tone, visualId])

  useLayoutEffect(() => () => onVisualChange(), [onVisualChange])

  const keep = useCallback(() => {
    const next = text.trim()
    if (!next || savedRef.current) return
    savedRef.current = true
    pendingTextRef.current = next
    setCloseScale(targetScaleForText(next))
    setExit('keep')
  }, [targetScaleForText, text])

  const cancel = useCallback(() => {
    if (savedRef.current) return
    savedRef.current = true
    if (!dismissOnCancel) setCloseScale(cancelTargetScale)
    setExit(dismissOnCancel ? 'cancel-dismiss' : 'cancel-close')
  }, [cancelTargetScale, dismissOnCancel])

  useEffect(() => {
    if (!exit) return
    const suppressClick = (event: MouseEvent) => {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    window.addEventListener('click', suppressClick, true)
    window.addEventListener('dblclick', suppressClick, true)
    return () => {
      window.removeEventListener('click', suppressClick, true)
      window.removeEventListener('dblclick', suppressClick, true)
    }
  }, [exit])

  useEffect(() => {
    const saveOnTapAway = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node) || formRef.current?.contains(target)) return
      event.preventDefault()
      event.stopPropagation()
      if (text.trim()) {
        keep()
      } else {
        cancel()
      }
    }
    window.addEventListener('pointerdown', saveOnTapAway, true)
    return () => window.removeEventListener('pointerdown', saveOnTapAway, true)
  }, [cancel, keep, text])

  return (
    <form
      ref={formRef}
      className={composerClass}
      data-exit={exit ?? undefined}
      style={composerStyle({
        x: position.x,
        y: position.y,
        openScale,
        closeScale,
      })}
      onSubmit={(event) => {
        event.preventDefault()
        keep()
      }}
      onAnimationEnd={() => {
        if (!exit) return
        if (exit === 'keep') onKeep(pendingTextRef.current)
        else onCancel()
        onExitComplete()
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            cancel()
          }
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            keep()
          }
        }}
        placeholder="A thought…"
        maxLength={220}
        rows={1}
        aria-label={label}
      />
    </form>
  )
}
