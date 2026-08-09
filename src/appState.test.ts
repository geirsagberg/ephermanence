import { describe, expect, it, vi } from 'vitest'

import {
  ambientBubbleSettingsAtom,
  composerOpenAtom,
  createAppState,
  editingThoughtIdAtom,
  fieldSnapshotAtom,
  launcherRequestAtom,
  sendThoughtAuthoringAtom,
  thoughtAuthoringStateAtom,
} from './appState'
import { defaultAmbientBubbleSettings } from './spatialFieldScene'
import { createSpatialInteraction } from './spatialInteraction'
import { createThoughtAuthoring } from './thoughtAuthoring'
import type { Thought } from './types'

function createHarness(thoughts: Thought[] = []) {
  const interaction = createSpatialInteraction({ thoughts, attachments: [] })
  const authoring = createThoughtAuthoring()
  const sendToField = vi.fn()
  const state = createAppState({
    initialSnapshot: interaction.read(),
    initialAmbientBubbleSettings: defaultAmbientBubbleSettings,
    authoring,
    sendToField,
  })
  return { ...state, interaction, sendToField }
}

describe('app state subscriptions', () => {
  it('projects a field frame into focused subscriptions', () => {
    const thought = { id: 'selected', text: 'Selected', x: 0, y: 0, tone: 2 }
    const harness = createHarness([thought])
    const composerChanged = vi.fn()
    const stop = harness.store.sub(composerOpenAtom, composerChanged)

    harness.acceptFieldFrame({
      snapshot: harness.interaction.read(),
      effects: [
        {
          type: 'request-edit',
          thought,
          screenPosition: { x: 500, y: 400 },
        },
      ],
      launchRequests: 2,
    })

    expect(harness.store.get(fieldSnapshotAtom)).toBe(harness.interaction.read())
    expect(harness.store.get(composerOpenAtom)).toBe(true)
    expect(harness.store.get(editingThoughtIdAtom)).toBe('selected')
    expect(harness.store.get(launcherRequestAtom)).toBe(2)
    expect(composerChanged).toHaveBeenCalledOnce()
    stop()
  })

  it('routes authoring commands through the state interface', () => {
    const harness = createHarness()
    harness.acceptFieldFrame({
      snapshot: harness.interaction.read(),
      effects: [
        {
          type: 'request-create',
          screenPosition: { x: 400, y: 300 },
          worldPosition: { x: 10, y: 20 },
          tone: 3,
        },
      ],
      launchRequests: 0,
    })

    harness.store.set(sendThoughtAuthoringAtom, { type: 'keep', text: 'Remember' })

    expect(harness.store.get(thoughtAuthoringStateAtom)).toEqual({ mode: 'idle' })
    expect(harness.sendToField).toHaveBeenCalledWith({
      type: 'authoring-command',
      command: {
        type: 'create-thought',
        id: expect.stringMatching(/^thought-/),
        text: 'Remember',
        position: { x: 10, y: 20 },
        tone: 3,
      },
    })
  })

  it('keeps provider stores isolated', () => {
    const first = createHarness()
    const second = createHarness()
    const tuned = { size: 1.2, presence: 0.8, density: 3 }

    first.store.set(ambientBubbleSettingsAtom, tuned)

    expect(first.store.get(ambientBubbleSettingsAtom)).toEqual(tuned)
    expect(second.store.get(ambientBubbleSettingsAtom)).toEqual(defaultAmbientBubbleSettings)
  })
})
