import type { SupabaseClient } from '@supabase/supabase-js'

import type { SealedSpace, SealedSpaceKey } from './spaceCrypto'
import type { RemoteSpace, SpaceRemote } from './spaceSync'

const table = 'synced_spaces'
const uniqueViolation = '23505'

type Row = { revision: number; space_key: SealedSpaceKey; space: SealedSpace }

/** Encrypted space storage for one account. Row-level security limits the session to its own row. */
export function supabaseRemote(client: SupabaseClient, userId: string): SpaceRemote {
  return {
    async load() {
      const { data, error } = await client
        .from(table)
        .select('revision, space_key, space')
        .eq('user_id', userId)
        .maybeSingle<Row>()
      if (error) throw error
      return data && { revision: data.revision, spaceKey: data.space_key, space: data.space }
    },
    async create({ revision, spaceKey, space }: RemoteSpace) {
      const { error } = await client.from(table).insert({ user_id: userId, revision, space_key: spaceKey, space })
      if (error?.code === uniqueViolation) return false
      if (error) throw error
      return true
    },
    async update(expectedRevision, revision, space) {
      const { data, error } = await client
        .from(table)
        .update({ revision, space, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('revision', expectedRevision)
        .select('revision')
      if (error) throw error
      return data.length === 1
    },
  }
}
