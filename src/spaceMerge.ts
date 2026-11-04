import { attachmentKey } from './spatialField'
import { thoughtRadius } from './thoughtTextLayout'
import type { Attachment, SpaceState, Thought } from './types'

/**
 * Three-way merge of whole spaces for sync. Remote order comes first, followed by
 * thoughts and attachments only the local space has, so the result is deterministic.
 */
export function mergeSpaces(base: SpaceState, local: SpaceState, remote: SpaceState): SpaceState {
  const baseThoughts = byId(base.thoughts)
  const localThoughts = byId(local.thoughts)
  const remoteThoughts = byId(remote.thoughts)
  const takenIds = new Set([...localThoughts.keys(), ...remoteThoughts.keys()])
  const thoughts: Thought[] = []

  for (const remoteThought of remote.thoughts) {
    const baseThought = baseThoughts.get(remoteThought.id)
    const localThought = localThoughts.get(remoteThought.id)

    if (!localThought) {
      if (!baseThought || !isSameThought(baseThought, remoteThought)) thoughts.push(remoteThought)
      continue
    }

    const merged = mergeThought(baseThought, localThought, remoteThought)
    thoughts.push(merged)
    if (hasTextConflict(baseThought, localThought, remoteThought)) {
      thoughts.push(localCopy(localThought, merged, takenIds))
    }
  }

  for (const localThought of local.thoughts) {
    if (remoteThoughts.has(localThought.id)) continue
    const baseThought = baseThoughts.get(localThought.id)
    if (!baseThought || !isSameThought(baseThought, localThought)) thoughts.push(localThought)
  }

  const ids = new Set(thoughts.map(({ id }) => id))
  const attachments = mergeAttachments(base.attachments, local.attachments, remote.attachments).filter(
    ([a, b]) => ids.has(a) && ids.has(b),
  )

  return { thoughts, attachments }
}

function mergeThought(base: Thought | undefined, local: Thought, remote: Thought): Thought {
  const localMoved = !base || local.x !== base.x || local.y !== base.y
  const remoteMoved = !base || remote.x !== base.x || remote.y !== base.y
  const position = localMoved && !remoteMoved ? local : remote

  return {
    id: remote.id,
    text: pick(base?.text, local.text, remote.text),
    x: position.x,
    y: position.y,
    tone: pick(base?.tone, local.tone, remote.tone),
  }
}

/** A change on only one side wins; otherwise remote wins. */
function pick<T>(base: T | undefined, local: T, remote: T) {
  return base !== undefined && remote === base ? local : remote
}

function hasTextConflict(base: Thought | undefined, local: Thought, remote: Thought) {
  if (local.text === remote.text) return false
  return !base || (local.text !== base.text && remote.text !== base.text)
}

/** Places the local version beside the kept thought, with an id derived from the original. */
function localCopy(local: Thought, kept: Thought, takenIds: Set<string>): Thought {
  let id = `${local.id}-local`
  for (let suffix = 2; takenIds.has(id); suffix += 1) id = `${local.id}-local-${suffix}`
  takenIds.add(id)

  return {
    ...local,
    id,
    x: kept.x + thoughtRadius(kept.text) + thoughtRadius(local.text),
    y: kept.y,
  }
}

function mergeAttachments(base: Attachment[], local: Attachment[], remote: Attachment[]) {
  const baseKeys = new Set(base.map(attachmentKey))
  const localByKey = byKey(local)
  const merged = new Map<string, Attachment>()

  for (const [key, attachment] of byKey(remote)) {
    if (localByKey.has(key) || !baseKeys.has(key)) merged.set(key, attachment)
  }
  for (const [key, attachment] of localByKey) {
    if (!merged.has(key) && !baseKeys.has(key)) merged.set(key, attachment)
  }

  return [...merged.values()]
}

function byKey(attachments: Attachment[]) {
  return new Map(attachments.map((attachment) => [attachmentKey(attachment), attachment]))
}

function byId(thoughts: Thought[]) {
  return new Map(thoughts.map((thought) => [thought.id, thought]))
}

function isSameThought(a: Thought, b: Thought) {
  return a.text === b.text && a.x === b.x && a.y === b.y && a.tone === b.tone
}
