import { createClient } from '@supabase/supabase-js'

import { indexedDbVault } from './indexedDbVault'
import { registerPasskey, signInWithPasskey } from './passkey'
import { connectSpace, createSpaceSync, type LocalSpace, type SpaceSync } from './spaceSync'
import { supabaseRemote } from './supabaseRemote'

export type SyncStatus =
  | { type: 'loading' }
  | { type: 'signed-out' }
  /** Signed in, but this device does not hold the space key yet. */
  | { type: 'setup'; hasSpace: boolean }
  | { type: 'connected' }

export type SyncRuntime = ReturnType<typeof createSyncRuntime>

const changeDelay = 2000
const retryDelay = 30_000

/** Sync is available when the build is configured for a Supabase project. */
export function readSyncConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  return url && publishableKey ? { url, publishableKey } : null
}

export function createSyncRuntime(
  config: { url: string; publishableKey: string },
  local: LocalSpace & { clear: () => void },
) {
  const client = createClient(config.url, config.publishableKey, { auth: { experimental: { passkey: true } } })
  const vault = indexedDbVault()
  const listeners = new Set<() => void>()
  let status: SyncStatus = { type: 'loading' }
  let sync: SpaceSync | null = null
  let timer: number | undefined
  let refreshing = Promise.resolve()

  const setStatus = (next: SyncStatus) => {
    status = next
    for (const listener of listeners) listener()
  }

  const schedule = (delay: number) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      sync?.sync().catch((error: unknown) => {
        console.warn('Sync failed; local work is kept.', error instanceof Error ? error.message : error)
        schedule(retryDelay)
      })
    }, delay)
  }

  const refresh = () => {
    refreshing = refreshing
      .catch(() => {})
      .then(async () => {
        const { data } = await client.auth.getSession()
        const userId = data.session?.user.id
        const state = await vault.load()
        sync = null
        if (!userId) return setStatus({ type: 'signed-out' })
        if (state && state.userId !== userId) {
          // This device holds another account's space. Never mix the two.
          await client.auth.signOut({ scope: 'local' })
          return setStatus({ type: 'signed-out' })
        }
        if (!state) {
          const hasSpace = await supabaseRemote(client, userId)
            .load()
            .then(
              (existing) => existing !== null,
              () => false,
            )
          return setStatus({ type: 'setup', hasSpace })
        }
        sync = createSpaceSync(userId, supabaseRemote(client, userId), vault, local)
        setStatus({ type: 'connected' })
        schedule(0)
      })
    return refreshing
  }

  const connect = async ({ userId, prfSecret }: { userId: string; prfSecret: ArrayBuffer }) => {
    try {
      const state = await vault.load()
      if (state && state.userId !== userId) throw new Error('Sign out of the other account first.')
      // A device that still holds this account's key keeps its merge base.
      if (!state) await connectSpace(userId, prfSecret, supabaseRemote(client, userId), vault)
    } finally {
      new Uint8Array(prfSecret).fill(0)
    }
    await refresh()
  }

  client.auth.onAuthStateChange((event) => {
    // Supabase calls this while holding its auth lock, so refresh afterwards.
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      window.setTimeout(refresh, 0)
    }
  })
  const syncSoon = () => {
    if (document.visibilityState === 'visible') schedule(0)
  }
  document.addEventListener('visibilitychange', syncSoon)
  window.addEventListener('online', syncSoon)

  return {
    read: () => status,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    /** Call after the local space was saved. Frequent changes are coalesced. */
    localChanged: () => schedule(changeDelay),
    sendCode: async (email: string) => {
      const { error } = await client.auth.signInWithOtp({ email })
      if (error) throw error
    },
    verifyCode: async (email: string, token: string) => {
      const { error } = await client.auth.verifyOtp({ email, token, type: 'email' })
      if (error) throw error
    },
    /** Signs in with an existing passkey and unlocks the space on this device. */
    unlock: async () => connect(await signInWithPasskey(client)),
    /** Creates the account's passkey, then the space key it protects. */
    createPasskey: async () => {
      const { data } = await client.auth.getSession()
      const userId = data.session?.user.id
      if (!userId) throw new Error('Sign in first.')
      if (await supabaseRemote(client, userId).load()) {
        await refresh()
        throw new Error('This account already has a passkey. Unlock with it instead.')
      }
      const credentialId = await registerPasskey(client)
      await connect(await signInWithPasskey(client, credentialId))
    },
    hasPendingChanges: async () => (sync ? sync.hasPendingChanges() : false),
    /** Removes the space key, session, merge base and local space from this device. */
    signOut: async () => {
      window.clearTimeout(timer)
      sync = null
      await vault.clear()
      local.clear()
      await client.auth.signOut({ scope: 'local' })
      await refresh()
    },
  }
}
