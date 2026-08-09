import { Focus, RotateCcw } from 'lucide-react'
import { useAtomValue } from 'jotai'

import { fieldSnapshotAtom } from '../appState'
import type { SpatialFieldInputAdapter } from '../spatialFieldInputAdapter'
import { zoomControlsClass } from './ZoomControls.css'

export function ZoomControls({ inputAdapter }: { inputAdapter: SpatialFieldInputAdapter }) {
  const { zoom } = useAtomValue(fieldSnapshotAtom).camera
  const canResetZoom = Math.abs(zoom - 1) > 0.001

  return (
    <div className={zoomControlsClass}>
      {canResetZoom && (
        <button
          type="button"
          aria-label="Reset zoom"
          title="Reset zoom"
          onClick={() => inputAdapter.send({ type: 'camera-control', control: 'reset-zoom' })}
        >
          <RotateCcw size={17} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        aria-label="Zoom to fit all thoughts"
        title="Zoom to fit all thoughts"
        onClick={() => inputAdapter.send({ type: 'camera-control', control: 'fit-all' })}
      >
        <Focus size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}
