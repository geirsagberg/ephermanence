import { atom, createStore } from 'jotai'

import { defaultAmbientBubbleSettings, type AmbientBubbleSettings } from './spatialFieldScene'
import type { SpatialInteractionSnapshot } from './spatialInteraction'
import type { SpatialFieldFrame, SpatialFieldInputAdapter } from './spatialFieldInputAdapter'
import type { ThoughtAuthoring, ThoughtAuthoringInput, ThoughtAuthoringState } from './thoughtAuthoring'
import { getThoughtTone } from './thoughtTone'

const fieldSnapshotStateAtom = atom<SpatialInteractionSnapshot | null>(null)
const authoringStateAtom = atom<ThoughtAuthoringState>({ mode: 'idle' })
const launcherRequestStateAtom = atom(0)
const sendAuthoringStateAtom = atom<((input: ThoughtAuthoringInput) => void) | null>(null)

export const ambientBubbleSettingsAtom = atom<AmbientBubbleSettings>(defaultAmbientBubbleSettings)

export const fieldSnapshotAtom = atom((get) => {
  const snapshot = get(fieldSnapshotStateAtom)
  if (!snapshot) throw new Error('App state was read before initialization')
  return snapshot
})

export const thoughtAuthoringStateAtom = atom((get) => get(authoringStateAtom))
export const composerOpenAtom = atom((get) => get(authoringStateAtom).mode !== 'idle')
export const editingThoughtIdAtom = atom((get) => {
  const state = get(authoringStateAtom)
  return state.mode === 'editing' ? state.id : undefined
})
export const launcherRequestAtom = atom((get) => get(launcherRequestStateAtom))
export const nextThoughtToneColorAtom = atom((get) => {
  const snapshot = get(fieldSnapshotAtom)
  return getThoughtTone(snapshot.state.thoughts.length).css
})

export const nextThoughtDarkToneColorAtom = atom((get) => {
  const snapshot = get(fieldSnapshotAtom)
  return getThoughtTone(snapshot.state.thoughts.length).darkCss
})

export const sendThoughtAuthoringAtom = atom(null, (get, _set, input: ThoughtAuthoringInput) => {
  const send = get(sendAuthoringStateAtom)
  if (!send) throw new Error('App commands were used before initialization')
  send(input)
})

const applyFieldFrameAtom = atom(
  null,
  (
    get,
    set,
    update: {
      frame: SpatialFieldFrame
      authoringState: ThoughtAuthoringState
    },
  ) => {
    set(fieldSnapshotStateAtom, update.frame.snapshot)
    set(authoringStateAtom, update.authoringState)
    if (update.frame.launchRequests > 0) {
      set(launcherRequestStateAtom, get(launcherRequestStateAtom) + update.frame.launchRequests)
    }
  },
)

type CreateAppStateOptions = {
  initialSnapshot: SpatialInteractionSnapshot
  initialAmbientBubbleSettings: AmbientBubbleSettings
  authoring: ThoughtAuthoring
  sendToField: (input: Parameters<SpatialFieldInputAdapter['send']>[0]) => void
}

export function createAppState({
  initialSnapshot,
  initialAmbientBubbleSettings,
  authoring,
  sendToField,
}: CreateAppStateOptions) {
  const store = createStore()

  const sendAuthoring = (input: ThoughtAuthoringInput) => {
    const commands = authoring.dispatch(input)
    store.set(authoringStateAtom, authoring.read())
    for (const command of commands) {
      sendToField({ type: 'authoring-command', command })
    }
  }

  store.set(fieldSnapshotStateAtom, initialSnapshot)
  store.set(authoringStateAtom, authoring.read())
  store.set(ambientBubbleSettingsAtom, initialAmbientBubbleSettings)
  store.set(sendAuthoringStateAtom, () => sendAuthoring)

  return {
    store,
    acceptFieldFrame(frame: SpatialFieldFrame) {
      for (const effect of frame.effects) {
        switch (effect.type) {
          case 'request-create':
            authoring.dispatch({
              type: 'open-create',
              screenPosition: effect.screenPosition,
              worldPosition: effect.worldPosition,
              tone: effect.tone,
            })
            break
          case 'request-edit':
            authoring.dispatch({
              type: 'open-edit',
              thought: effect.thought,
              screenPosition: effect.screenPosition,
            })
            break
          case 'empty-activated':
            authoring.dispatch({ type: 'cancel' })
            break
        }
      }
      store.set(applyFieldFrameAtom, { frame, authoringState: authoring.read() })
    },
  }
}
