import { describe, expect, it } from 'vitest'

import type { SpaceState, Thought } from '../types'
import { toBase64 } from './encoding'
import {
  connectSpace,
  createSpaceSync,
  type LocalSpace,
  type RemoteSpace,
  type SpaceRemote,
  type SyncState,
  type SyncVault,
} from './spaceSync'

const userId = 'user-a'
const thought = (id: string, text: string, x = 0, tone = 0): Thought => ({ id, text, x, y: 0, tone })
const space = (thoughts: Thought[], attachments: SpaceState['attachments'] = []): SpaceState => ({
  thoughts,
  attachments,
})

function createServer() {
  const rows = new Map<string, RemoteSpace>()
  const payloads: string[] = []
  let failures = 0
  let beforeUpdate: (() => void) | undefined
  let afterLoad: (() => void) | undefined

  const remoteFor = (owner: string): SpaceRemote => ({
    async load() {
      if (failures > 0) {
        failures -= 1
        throw new Error('Network down')
      }
      const row = structuredClone(rows.get(owner) ?? null)
      afterLoad?.()
      afterLoad = undefined
      return row
    },
    async create(next) {
      payloads.push(JSON.stringify(next))
      if (rows.has(owner)) return false
      rows.set(owner, structuredClone(next))
      return true
    },
    async update(expectedRevision, revision, next) {
      payloads.push(JSON.stringify(next))
      beforeUpdate?.()
      beforeUpdate = undefined
      const row = rows.get(owner)
      if (!row || row.revision !== expectedRevision) return false
      rows.set(owner, { ...row, revision, space: structuredClone(next) })
      return true
    },
  })

  return {
    rows,
    payloads,
    remoteFor,
    failNextLoads(count: number) {
      failures = count
    },
    onNextUpdate(callback: () => void) {
      beforeUpdate = callback
    },
    onNextLoad(callback: () => void) {
      afterLoad = callback
    },
  }
}

function memoryVault(): SyncVault & { state: () => SyncState | null } {
  let state: SyncState | null = null
  return {
    state: () => state,
    load: async () => state,
    save: async (next) => {
      state = next
    },
    clear: async () => {
      state = null
    },
  }
}

function memoryLocal(initial: SpaceState): LocalSpace & { blocked: boolean } {
  let current = initial
  const local = {
    blocked: false,
    read: () => current,
    apply(next: SpaceState) {
      if (local.blocked) return false
      current = next
      return true
    },
  }
  return local
}

async function createDevice(
  server: ReturnType<typeof createServer>,
  secret: ArrayBuffer,
  initial = space([]),
  owner = userId,
) {
  const vault = memoryVault()
  const local = memoryLocal(initial)
  const remote = server.remoteFor(owner)
  await connectSpace(owner, secret, remote, vault)
  return { vault, local, sync: createSpaceSync(owner, remote, vault, local) }
}

const prfSecret = () => crypto.getRandomValues(new Uint8Array(32)).buffer

describe('encrypted space sync', () => {
  it('restores thoughts, positions, tones and bonds on another device without exposing them', async () => {
    const server = createServer()
    const secret = prfSecret()
    const saved = space([thought('a', 'Quiet harbour', 12, 3), thought('b', 'Lantern', -40, 5)], [['a', 'b']])
    const first = await createDevice(server, secret, saved)
    await first.sync.sync()

    const second = await createDevice(server, secret)
    await second.sync.sync()

    expect(second.local.read()).toEqual(saved)
    const sent = server.payloads.join('\n')
    expect(sent).not.toContain('Quiet harbour')
    expect(sent).not.toContain('Lantern')
    expect(sent).not.toContain(toBase64(secret))
  })

  it('preserves both spaces when connecting a device that already has thoughts', async () => {
    const server = createServer()
    const secret = prfSecret()
    const first = await createDevice(server, secret, space([thought('a', 'Remote')]))
    await first.sync.sync()

    const second = await createDevice(server, secret, space([thought('b', 'Local')]))
    await second.sync.sync()
    await first.sync.sync()

    const expected = space([thought('a', 'Remote'), thought('b', 'Local')])
    expect(second.local.read()).toEqual(expected)
    expect(first.local.read()).toEqual(expected)
  })

  it('merges a stale upload instead of overwriting it', async () => {
    const server = createServer()
    const secret = prfSecret()
    const first = await createDevice(server, secret, space([thought('a', 'Shared')]))
    await first.sync.sync()
    const second = await createDevice(server, secret)
    await second.sync.sync()

    first.local.apply(space([thought('a', 'Shared'), thought('b', 'From first')]))
    second.local.apply(space([thought('a', 'Shared', 50)]))
    await first.sync.sync()
    await second.sync.sync()
    await first.sync.sync()

    const expected = space([thought('a', 'Shared', 50), thought('b', 'From first')])
    expect(first.local.read()).toEqual(expected)
    expect(second.local.read()).toEqual(expected)
  })

  it('retries when another device wins the revision race', async () => {
    const server = createServer()
    const secret = prfSecret()
    const first = await createDevice(server, secret, space([thought('a', 'Shared')]))
    await first.sync.sync()
    const second = await createDevice(server, secret)
    await second.sync.sync()

    second.local.apply(space([thought('a', 'Shared'), thought('c', 'Second')]))
    first.local.apply(space([thought('a', 'Shared'), thought('b', 'First')]))
    server.onNextUpdate(() => void second.sync.sync())
    await first.sync.sync()
    await second.sync.sync()
    await first.sync.sync()

    expect(
      first.local
        .read()
        .thoughts.map(({ id }) => id)
        .sort(),
    ).toEqual(['a', 'b', 'c'])
    expect(await first.sync.hasPendingChanges()).toBe(false)
  })

  it('keeps offline work pending until a later sync succeeds', async () => {
    const server = createServer()
    const secret = prfSecret()
    const first = await createDevice(server, secret)
    await first.sync.sync()

    first.local.apply(space([thought('a', 'Written offline')]))
    server.failNextLoads(1)
    await expect(first.sync.sync()).rejects.toThrow('Network down')
    expect(first.local.read()).toEqual(space([thought('a', 'Written offline')]))
    expect(await first.sync.hasPendingChanges()).toBe(true)

    await first.sync.sync()
    expect(await first.sync.hasPendingChanges()).toBe(false)
    const second = await createDevice(server, secret)
    await second.sync.sync()
    expect(second.local.read()).toEqual(space([thought('a', 'Written offline')]))
  })

  it('keeps edits made while a sync was in flight', async () => {
    const server = createServer()
    const secret = prfSecret()
    const first = await createDevice(server, secret, space([thought('a', 'Remote')]))
    await first.sync.sync()
    const second = await createDevice(server, secret, space([thought('b', 'Before')]))

    server.onNextLoad(() => second.local.apply(space([thought('b', 'Before'), thought('c', 'During')])))
    await second.sync.sync()

    expect(second.local.read().thoughts.map(({ id }) => id)).toEqual(['a', 'b', 'c'])
    expect(await second.sync.hasPendingChanges()).toBe(true)
  })

  it('does not lose the uploaded merge when the local space cannot be replaced yet', async () => {
    const server = createServer()
    const secret = prfSecret()
    const first = await createDevice(server, secret, space([thought('a', 'Remote')]))
    await first.sync.sync()
    const second = await createDevice(server, secret, space([thought('b', 'Local')]))

    second.local.blocked = true
    await second.sync.sync()
    second.local.blocked = false
    await second.sync.sync()

    expect(second.local.read().thoughts.map(({ id }) => id)).toEqual(['a', 'b'])
    await first.sync.sync()
    expect(first.local.read().thoughts.map(({ id }) => id)).toEqual(['a', 'b'])
  })

  it('refuses tampered ciphertext and leaves local work in place', async () => {
    const server = createServer()
    const secret = prfSecret()
    const first = await createDevice(server, secret, space([thought('a', 'Remote')]))
    await first.sync.sync()
    const second = await createDevice(server, secret, space([thought('b', 'Local')]))

    const row = server.rows.get(userId)!
    row.space = { ...row.space, ciphertext: toBase64(new Uint8Array(64)) }
    await expect(second.sync.sync()).rejects.toThrow()
    expect(second.local.read()).toEqual(space([thought('b', 'Local')]))
  })

  it('refuses a space relabelled with another revision', async () => {
    const server = createServer()
    const secret = prfSecret()
    const first = await createDevice(server, secret, space([thought('a', 'Remote')]))
    await first.sync.sync()
    const second = await createDevice(server, secret, space([thought('b', 'Local')]))

    server.rows.get(userId)!.revision = 7
    await expect(second.sync.sync()).rejects.toThrow()
    expect(second.local.read()).toEqual(space([thought('b', 'Local')]))
  })

  it('cannot unlock a space with a different passkey', async () => {
    const server = createServer()
    const first = await createDevice(server, prfSecret(), space([thought('a', 'Remote')]))
    await first.sync.sync()

    await expect(createDevice(server, prfSecret())).rejects.toThrow()
  })

  it('does not sync one account through another account', async () => {
    const server = createServer()
    const secret = prfSecret()
    const device = await createDevice(server, secret, space([thought('a', 'Account A')]))
    const otherAccount = createSpaceSync('user-b', server.remoteFor('user-b'), device.vault, device.local)

    await expect(otherAccount.sync()).rejects.toThrow('not connected to this account')
    expect(server.rows.size).toBe(0)
  })

  it('reports local work as pending before the first sync', async () => {
    const server = createServer()
    const device = await createDevice(server, prfSecret(), space([thought('a', 'Unsynced')]))

    expect(await device.sync.hasPendingChanges()).toBe(true)
    expect(device.vault.state()?.base).toBeNull()
  })
})
