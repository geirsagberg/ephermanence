import { mergeSpaces } from '../spaceMerge'
import type { SpaceState } from '../types'
import {
  createSpaceKey,
  openSpace,
  openSpaceKey,
  sealSpace,
  type SealedSpace,
  type SealedSpaceKey,
} from './spaceCrypto'

export type RemoteSpace = { revision: number; spaceKey: SealedSpaceKey; space: SealedSpace }

/** Encrypted storage for one account's space. Implementations must never overwrite unconditionally. */
export type SpaceRemote = {
  load: () => Promise<RemoteSpace | null>
  /** Stores the first revision. Resolves false when a space already exists. */
  create: (space: RemoteSpace) => Promise<boolean>
  /** Replaces `expectedRevision` atomically. Resolves false when the remote has moved on. */
  update: (expectedRevision: number, revision: number, space: SealedSpace) => Promise<boolean>
}

/** What a device keeps between sessions. `base` is the last space both sides agreed on. */
export type SyncState = {
  userId: string
  key: CryptoKey
  spaceKey: SealedSpaceKey
  base: { revision: number; space: SpaceState } | null
}

export type SyncVault = {
  load: () => Promise<SyncState | null>
  save: (state: SyncState) => Promise<void>
  clear: () => Promise<void>
}

export type LocalSpace = {
  read: () => SpaceState
  /** Replaces the local space. Returns false when it cannot be replaced right now, such as during a drag. */
  apply: (space: SpaceState) => boolean
}

const emptySpace: SpaceState = { thoughts: [], attachments: [] }
const maxAttempts = 3

/**
 * Prepares this device for an account. Unlocks the existing space key, or creates one when the
 * account has no space yet. The first sync merges local and remote spaces with an empty base.
 */
export async function connectSpace(userId: string, prfSecret: ArrayBuffer, remote: SpaceRemote, vault: SyncVault) {
  const existing = await remote.load()
  const { key, sealed } = existing
    ? { key: await openSpaceKey(prfSecret, existing.spaceKey), sealed: existing.spaceKey }
    : await createSpaceKey(prfSecret)
  await vault.save({ userId, key, spaceKey: sealed, base: null })
}

export type SpaceSync = {
  /** Syncs now, or once more after the sync in progress. Rejects when this attempt failed. */
  sync: () => Promise<void>
  /** Whether local work has not reached the remote yet. */
  hasPendingChanges: () => Promise<boolean>
  /** Stops syncing and waits for the sync in progress. Nothing is written locally afterwards. */
  stop: () => Promise<void>
}

export function createSpaceSync(userId: string, remote: SpaceRemote, vault: SyncVault, local: LocalSpace): SpaceSync {
  let running: Promise<void> | null = null
  let queued: Promise<void> | null = null
  let stopped = false

  const syncOnce = async () => {
    const state = await vault.load()
    if (!state || state.userId !== userId) throw new Error('This device is not connected to this account.')

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const localSpace = local.read()
      const remoteSpace = await remote.load()
      const base = state.base
      const known = remoteSpace && base?.revision === remoteSpace.revision ? base.space : null
      const remoteState =
        remoteSpace && !known
          ? await openSpace(state.key, remoteSpace.space, { userId, revision: remoteSpace.revision })
          : known
      const merged = remoteState ? mergeSpaces(base?.space ?? emptySpace, localSpace, remoteState) : localSpace

      let revision = remoteSpace?.revision ?? 0
      if (!remoteState || !isSameSpace(merged, remoteState)) {
        revision += 1
        const space = await sealSpace(state.key, merged, { userId, revision })
        const saved = remoteSpace
          ? await remote.update(remoteSpace.revision, revision, space)
          : await remote.create({ revision, spaceKey: state.spaceKey, space })
        if (!saved) continue
      }

      if (!isSameSpace(merged, localSpace)) {
        const current = local.read()
        const next = current === localSpace ? merged : mergeSpaces(localSpace, current, merged)
        if (stopped) return
        // Keep the old base, so the next sync merges the uploaded space again instead of overwriting it.
        if (!local.apply(next)) return
      }
      if (stopped) return
      await vault.save({ ...state, base: { revision, space: merged } })
      return
    }
    throw new Error('The synced space kept changing. Try again later.')
  }

  const sync = (): Promise<void> => {
    if (stopped) return Promise.resolve()
    if (!running) {
      running = syncOnce().finally(() => {
        running = null
      })
      return running
    }
    queued ??= running
      .catch(() => {})
      .then(() => {
        queued = null
        return sync()
      })
    return queued
  }

  return {
    sync,
    async hasPendingChanges() {
      const state = await vault.load()
      if (!state?.base) return local.read().thoughts.length > 0
      return !isSameSpace(local.read(), state.base.space)
    },
    async stop() {
      stopped = true
      await (queued ?? running)?.catch(() => {})
    },
  }
}

function isSameSpace(a: SpaceState, b: SpaceState) {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}
