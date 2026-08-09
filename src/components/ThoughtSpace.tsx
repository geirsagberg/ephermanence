import { Grip, Pencil, X } from 'lucide-react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Fragment, useEffect, useRef } from 'react'
import { useAtomValue } from 'jotai'
import { cx } from '../../styled-system/css'

import { ambientBubbleSettingsAtom, composerOpenAtom, editingThoughtIdAtom, fieldSnapshotAtom } from '../appState'
import type { SpatialInteraction } from '../spatialInteraction'
import type { SpatialFieldInputAdapter, ThoughtControl, ThoughtControlEvent } from '../spatialFieldInputAdapter'
import type { ThoughtAuthoring } from '../thoughtAuthoring'
import { hasThoughtAttachment, positionThoughtActions } from '../thoughtActions'
import { thoughtRadius } from '../thoughtTextLayout'
import { shouldPreserveNativeLongPressHaptics } from '../touchThoughtAuthoring'
import { ThoughtLauncher } from './ThoughtLauncher'
import {
  actionButtonClass,
  actionStyle,
  directActionButtonClass,
  grabActionButtonClass,
  thoughtSpaceClass,
} from './ThoughtSpace.css'

type ThoughtSpaceProps = {
  interaction: SpatialInteraction
  inputAdapter: SpatialFieldInputAdapter
  findFreePosition: ThoughtAuthoring['findFreePosition']
  colorMode: 'light' | 'dark'
  className?: string
}

export function ThoughtSpace({
  interaction,
  inputAdapter,
  findFreePosition,
  colorMode,
  className = '',
}: ThoughtSpaceProps) {
  const snapshot = useAtomValue(fieldSnapshotAtom)
  const editingThoughtId = useAtomValue(editingThoughtIdAtom)
  const composerOpen = useAtomValue(composerOpenAtom)
  const ambientBubbleSettings = useAtomValue(ambientBubbleSettingsAtom)
  const hostRef = useRef<HTMLDivElement>(null)
  const getNewThoughtPosition = () => {
    const current = interaction.read()
    const currentZoom = current.camera.zoom
    return findFreePosition({
      thoughts: current.state.thoughts.map((thought) => ({
        ...interaction.worldToScreen(thought),
        radius: thoughtRadius(thought.text) * currentZoom,
      })),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      zoom: currentZoom,
    })
  }
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    return inputAdapter.mount(host)
  }, [inputAdapter])

  useEffect(() => {
    inputAdapter.send({
      type: 'present',
      presentation: {
        ambientBubbleSettings,
        hiddenThoughtId: editingThoughtId,
        colorMode,
      },
    })
  }, [inputAdapter, ambientBubbleSettings, colorMode, editingThoughtId])

  const selectedThought = snapshot.state.thoughts.find((thought) => thought.id === snapshot.selectedId)
  const host = hostRef.current
  const selectedPosition = selectedThought && host ? interaction.worldToScreen(selectedThought) : null
  const zoom = snapshot.camera.zoom
  const actionPositions =
    selectedThought && selectedPosition
      ? positionThoughtActions(selectedPosition, thoughtRadius(selectedThought.text) * zoom)
      : null
  const selectedThoughtHasBond = selectedThought && hasThoughtAttachment(selectedThought.id, snapshot.state.attachments)
  const sendControl = (control: ThoughtControl, thoughtId: string, event: ThoughtControlEvent) =>
    inputAdapter.send({ type: 'thought-control', control, thoughtId, event })

  return (
    <div
      ref={hostRef}
      className={cx(thoughtSpaceClass, className)}
      data-authoring={composerOpen || undefined}
      data-native-long-press-haptics={shouldPreserveNativeLongPressHaptics(navigator) || undefined}
    >
      {!composerOpen && selectedThought && selectedPosition && actionPositions && (
        <Fragment key={selectedThought.id}>
          <button
            title="Edit thought"
            className={cx(actionButtonClass, directActionButtonClass)}
            style={actionStyle(selectedPosition, actionPositions.edit)}
            onPointerDown={(event) =>
              sendControl('edit', selectedThought.id, pointerControlEvent('pointer-down', event))
            }
            onPointerUp={(event) => sendControl('edit', selectedThought.id, pointerControlEvent('pointer-up', event))}
            onPointerCancel={(event) =>
              sendControl('edit', selectedThought.id, pointerControlEvent('pointer-cancel', event))
            }
            onClick={(event) => sendControl('edit', selectedThought.id, keyboardControlEvent(event))}
            aria-label={`Edit thought: ${selectedThought.text}`}
          >
            <Pencil size={20} strokeWidth={1} aria-hidden="true" />
          </button>
          <button
            title="Delete thought"
            className={cx(actionButtonClass, directActionButtonClass)}
            style={actionStyle(selectedPosition, actionPositions.delete)}
            onPointerDown={(event) =>
              sendControl('delete', selectedThought.id, pointerControlEvent('pointer-down', event))
            }
            onPointerUp={(event) => sendControl('delete', selectedThought.id, pointerControlEvent('pointer-up', event))}
            onPointerCancel={(event) =>
              sendControl('delete', selectedThought.id, pointerControlEvent('pointer-cancel', event))
            }
            onClick={(event) => sendControl('delete', selectedThought.id, keyboardControlEvent(event))}
            aria-label={`Delete thought: ${selectedThought.text}`}
          >
            <X size={20} strokeWidth={1} aria-hidden="true" />
          </button>
          {selectedThoughtHasBond && (
            <button
              title="Move thought independently"
              className={cx(actionButtonClass, grabActionButtonClass)}
              style={actionStyle(selectedPosition, actionPositions.grab)}
              onPointerDown={(event) =>
                sendControl('grab', selectedThought.id, pointerControlEvent('pointer-down', event))
              }
              onPointerUp={(event) => sendControl('grab', selectedThought.id, pointerControlEvent('pointer-up', event))}
              onPointerCancel={(event) =>
                sendControl('grab', selectedThought.id, pointerControlEvent('pointer-cancel', event))
              }
              aria-label={`Move thought independently: ${selectedThought.text}`}
            >
              <Grip size={20} strokeWidth={1} aria-hidden="true" />
            </button>
          )}
        </Fragment>
      )}
      <ThoughtLauncher
        getTapPosition={getNewThoughtPosition}
        onOpen={(screenPosition) => {
          inputAdapter.send({
            type: 'launcher-open',
            point: screenPosition,
          })
        }}
      />
    </div>
  )
}

function pointerControlEvent(
  phase: 'pointer-down' | 'pointer-up' | 'pointer-cancel',
  event: ReactPointerEvent<HTMLButtonElement>,
): ThoughtControlEvent {
  return {
    phase,
    pointerId: event.pointerId,
    pointerKind: event.pointerType,
    clientPoint: { x: event.clientX, y: event.clientY },
    timeStamp: event.timeStamp,
    consume: () => {
      event.preventDefault()
      event.stopPropagation()
    },
    capturePointer: () => event.currentTarget.setPointerCapture(event.pointerId),
  }
}

function keyboardControlEvent(event: ReactMouseEvent<HTMLButtonElement>): ThoughtControlEvent {
  return {
    phase: 'keyboard-activate',
    timeStamp: event.timeStamp,
    clickDetail: event.detail,
    consume: () => {
      if (event.detail === 0) event.preventDefault()
      event.stopPropagation()
    },
  }
}
