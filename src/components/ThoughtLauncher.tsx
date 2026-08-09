import { Plus } from 'lucide-react'
import { useAtomValue } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  composerOpenAtom,
  launcherRequestAtom,
  nextThoughtDarkToneColorAtom,
  nextThoughtToneColorAtom,
} from '../appState'
import { getLauncherDragUpdate, type Position } from '../thoughtLauncherDrag'
import { isIOSDevice, shouldOpenThoughtImmediately } from '../touchThoughtAuthoring'
import {
  launcherBubbleClass,
  launcherClass,
  launcherDragStyle,
  launcherSeedClass,
  launcherSeedStyle,
  launcherToneStyle,
} from './ThoughtLauncher.css'

type ThoughtLauncherProps = {
  getTapPosition: () => Position
  onOpen: (position: Position) => void
}

export function ThoughtLauncher({ getTapPosition, onOpen }: ThoughtLauncherProps) {
  const composerOpen = useAtomValue(composerOpenAtom)
  const launchRequest = useAtomValue(launcherRequestAtom)
  const toneColor = useAtomValue(nextThoughtToneColorAtom)
  const darkToneColor = useAtomValue(nextThoughtDarkToneColorAtom)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const handledLaunchRequest = useRef(launchRequest)
  const pointerStart = useRef<Position | null>(null)
  const launcherCenter = useRef<Position | null>(null)
  const dragStarted = useRef(false)
  const dragPositionRef = useRef<Position | null>(null)
  const [dragPosition, setDragPosition] = useState<Position | null>(null)
  const [launch, setLaunch] = useState<{
    start: Position
    target: Position
  } | null>(null)
  const openImmediately = isIOSDevice(navigator)

  useEffect(() => {
    if (launchRequest === handledLaunchRequest.current) return
    handledLaunchRequest.current = launchRequest
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect || launch) return
    setLaunch({
      start: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      target: getTapPosition(),
    })
  }, [getTapPosition, launch, launchRequest])

  if (composerOpen && !launch) return null

  return (
    <div className={launcherClass} style={launcherToneStyle(toneColor, darkToneColor)}>
      {!composerOpen && !launch && (
        <button
          ref={buttonRef}
          className={launcherBubbleClass}
          style={dragPosition ? launcherDragStyle(dragPosition) : undefined}
          aria-label="Add a thought"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            const pointer = { x: event.clientX, y: event.clientY }
            const rect = event.currentTarget.getBoundingClientRect()
            const center = {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            }
            pointerStart.current = pointer
            launcherCenter.current = center
            dragStarted.current = false
            dragPositionRef.current = center
            setDragPosition(center)
          }}
          onPointerMove={(event) => {
            if (!pointerStart.current || !launcherCenter.current) return
            const update = getLauncherDragUpdate({
              launcherCenter: launcherCenter.current,
              pointer: { x: event.clientX, y: event.clientY },
              pointerStart: pointerStart.current,
            })
            dragStarted.current ||= update.isDrag
            dragPositionRef.current = update.center
            setDragPosition(update.center)
          }}
          onPointerUp={(event) => {
            const update =
              pointerStart.current && launcherCenter.current
                ? getLauncherDragUpdate({
                    launcherCenter: launcherCenter.current,
                    pointer: { x: event.clientX, y: event.clientY },
                    pointerStart: pointerStart.current,
                  })
                : null
            const wasDrag = dragStarted.current || Boolean(update?.isDrag)
            const dragTarget = update?.center ?? dragPositionRef.current
            pointerStart.current = null
            launcherCenter.current = null
            dragStarted.current = false
            dragPositionRef.current = null
            setDragPosition(null)
            if (wasDrag && dragTarget) {
              if (shouldOpenThoughtImmediately(event.pointerType, openImmediately)) {
                flushSync(() => onOpen(dragTarget))
              } else {
                onOpen(dragTarget)
              }
              return
            }

            const rect = event.currentTarget.getBoundingClientRect()
            const target = getTapPosition()
            if (shouldOpenThoughtImmediately(event.pointerType, openImmediately)) {
              flushSync(() => {
                setLaunch({
                  start: {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                  },
                  target,
                })
                onOpen(target)
              })
              return
            }
            setLaunch({
              start: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
              target,
            })
          }}
          onPointerCancel={() => {
            pointerStart.current = null
            launcherCenter.current = null
            dragStarted.current = false
            dragPositionRef.current = null
            setDragPosition(null)
          }}
        >
          <Plus size={24} aria-hidden="true" />
        </button>
      )}
      {launch && (
        <span
          className={launcherSeedClass}
          style={launcherSeedStyle(launch.start, launch.target)}
          onAnimationEnd={() => {
            const target = launch.target
            setLaunch(null)
            if (!composerOpen) onOpen(target)
          }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
