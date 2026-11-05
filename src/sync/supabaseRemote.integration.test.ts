import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { supabaseRemote } from './supabaseRemote'

// Runs against the local Supabase stack. See README for the environment variables.
const url = import.meta.env.SUPABASE_TEST_URL as string | undefined
const publishableKey = import.meta.env.SUPABASE_TEST_PUBLISHABLE_KEY as string | undefined
const secretKey = import.meta.env.SUPABASE_TEST_SECRET_KEY as string | undefined

const spaceKey = { version: 1, salt: 'salt', iv: 'iv', wrappedKey: 'key' } as const
const sealed = (ciphertext: string) => ({ version: 1, iv: 'iv', ciphertext }) as const

async function signedInUser() {
  const admin = createClient(url!, secretKey!, { auth: { persistSession: false } })
  const email = `sync-${crypto.randomUUID()}@example.test`
  const password = crypto.randomUUID()
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw created.error
  const client = createClient(url!, publishableKey!, { auth: { persistSession: false } })
  const signedIn = await client.auth.signInWithPassword({ email, password })
  if (signedIn.error) throw signedIn.error
  return { client, userId: created.data.user.id }
}

describe.skipIf(!url || !publishableKey || !secretKey)('Supabase space storage', () => {
  it('keeps each account to its own space', async () => {
    const owner = await signedInUser()
    const other = await signedInUser()
    const ownerRemote = supabaseRemote(owner.client, owner.userId)
    expect(await ownerRemote.create({ revision: 1, spaceKey, space: sealed('owner') })).toBe(true)

    const intruder = supabaseRemote(other.client, owner.userId)
    expect(await intruder.load()).toBeNull()
    expect(await intruder.update(1, 2, sealed('intruder'))).toBe(false)
    await expect(intruder.create({ revision: 5, spaceKey, space: sealed('intruder') })).rejects.toThrow()
    expect(await ownerRemote.load()).toEqual({ revision: 1, spaceKey, space: sealed('owner') })

    const anonymous = createClient(url!, publishableKey!, { auth: { persistSession: false } })
    const { data } = await anonymous.from('synced_spaces').select('user_id')
    expect(data ?? []).toEqual([])
  })

  it('accepts exactly one write per revision', async () => {
    const { client, userId } = await signedInUser()
    const remote = supabaseRemote(client, userId)
    expect(await remote.create({ revision: 1, spaceKey, space: sealed('first') })).toBe(true)
    expect(await remote.create({ revision: 1, spaceKey, space: sealed('again') })).toBe(false)

    const results = await Promise.all([remote.update(1, 2, sealed('a')), remote.update(1, 2, sealed('b'))])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await remote.update(1, 2, sealed('stale'))).toBe(false)
    expect((await remote.load())?.revision).toBe(2)
  })

  it('does not let the owner replace the space key', async () => {
    const { client, userId } = await signedInUser()
    await supabaseRemote(client, userId).create({ revision: 1, spaceKey, space: sealed('first') })

    const { error } = await client
      .from('synced_spaces')
      .update({ space_key: { ...spaceKey, wrappedKey: 'other' } })
      .eq('user_id', userId)
    expect(error).not.toBeNull()
  })
})
