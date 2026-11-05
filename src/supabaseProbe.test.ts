import { afterEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { registerSupabaseProbe, verifySupabaseProbe } from './supabaseProbe'
import type { Probe } from './passkeyProbe'

const encode = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
const buffer = (value: number) => new Uint8Array([value]).buffer
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'probe@example.test',
  email_confirmed_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
}
const session = {
  access_token: `e30.${encode(new TextEncoder().encode(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })))}.signature`,
  refresh_token: 'test-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  user,
}

describe('Supabase PRF probe', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses server challenges, strips PRF output from requests, and decrypts a downloaded fixture', async () => {
    vi.stubGlobal('location', { hostname: 'localhost' })
    const secret = crypto.getRandomValues(new Uint8Array(32))
    const secrets: number[][] = []
    const create = vi.fn().mockResolvedValue({
      rawId: buffer(7),
      response: { clientDataJSON: buffer(1), attestationObject: buffer(2) },
      getClientExtensionResults: () => ({ prf: { results: { first: Array.from(secret) } } }),
      toJSON: () => {
        throw new Error('Must never serialize the whole credential')
      },
    })
    const get = vi.fn().mockImplementation(async () => {
      const output = Array.from(secret)
      secrets.push(output)
      return {
        rawId: buffer(7),
        response: {
          clientDataJSON: buffer(1),
          authenticatorData: buffer(3),
          signature: buffer(4),
          userHandle: buffer(5),
        },
        getClientExtensionResults: () => ({ prf: { results: { first: output } } }),
        toJSON: () => {
          throw new Error('Must never serialize the whole credential')
        },
      }
    })
    vi.stubGlobal('navigator', { credentials: { create, get } })
    let stored: Probe | undefined
    let rejectAuthentication = false
    const requests: { path: string; body: unknown }[] = []
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input)
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
      requests.push({ path: url.pathname, body })
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
      if (url.pathname.endsWith('/token')) return json(session)
      if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 })
      if (url.pathname.endsWith('/user')) return json(user)
      if (url.pathname.endsWith('/registration/options'))
        return json({
          challenge_id: 'registration-challenge',
          options: {
            challenge: 'AQID',
            rp: { id: 'localhost', name: 'Probe' },
            user: { id: 'BAUG', name: user.email, displayName: 'Probe' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          },
        })
      if (url.pathname.endsWith('/registration/verify')) return json({ id: 'registered' })
      if (url.pathname.endsWith('/authentication/options'))
        return json({ challenge_id: 'authentication-challenge', options: { challenge: 'BwgJ', rpId: 'localhost' } })
      if (url.pathname.endsWith('/authentication/verify'))
        return rejectAuthentication ? json({ msg: 'Rejected challenge' }, 400) : json(session)
      if (url.pathname.endsWith('/secure_sync_probes')) {
        if (init?.method === 'POST') {
          expect(body.user_id).toBe(user.id)
          stored = body.fixture
          return json(null, 201)
        }
        expect(url.searchParams.get('user_id')).toBe(`eq.${user.id}`)
        return json({ fixture: stored })
      }
      throw new Error(`Unexpected request: ${url.pathname}`)
    })
    const client = createClient('https://probe.supabase.co', 'sb_publishable_test', {
      auth: {
        experimental: { passkey: true },
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: fetcher },
    })
    await client.auth.signInWithPassword({ email: user.email, password: 'disposable' })
    const probe = await registerSupabaseProbe(client)
    await expect(verifySupabaseProbe(client, probe)).resolves.toBeUndefined()
    expect(create.mock.calls[0][0].publicKey.challenge).toEqual(new Uint8Array([1, 2, 3]))
    expect(get.mock.calls[0][0].publicKey.challenge).toEqual(new Uint8Array([7, 8, 9]))
    expect(get.mock.calls[0][0].publicKey.extensions.prf.eval.first).toHaveLength(32)
    const verification = requests.filter((request) => request.path.endsWith('/verify'))
    expect(verification).toHaveLength(3)
    for (const request of verification) {
      const body = request.body as { challenge_id: string; credential: Record<string, unknown> }
      expect(body.challenge_id).toMatch(/^(registration|authentication)-challenge$/)
      expect(Object.keys(body.credential).sort()).toEqual(['clientExtensionResults', 'id', 'rawId', 'response', 'type'])
      expect(body.credential.clientExtensionResults).toEqual({})
    }
    const serialized = JSON.stringify(requests)
    expect(serialized).not.toContain(JSON.stringify(Array.from(secret)))
    expect(serialized).not.toContain(btoa(String.fromCharCode(...secret)))
    expect(Object.keys(stored!).sort()).toEqual(['ciphertext', 'credentialId', 'iv', 'rpId', 'salt', 'version'])
    expect(secrets.every((output) => output.every((byte) => byte === 0))).toBe(true)
    expect((await client.auth.getSession()).data.session).toBeNull()

    stored = { ...probe, ciphertext: btoa('tampered') }
    await expect(verifySupabaseProbe(client, probe)).rejects.toThrow()
    expect((await client.auth.getSession()).data.session).toBeNull()

    rejectAuthentication = true
    const readsBefore = requests.filter((request) => request.path.endsWith('/secure_sync_probes')).length
    await expect(verifySupabaseProbe(client, probe)).rejects.toThrow('Rejected challenge')
    expect(requests.filter((request) => request.path.endsWith('/secure_sync_probes'))).toHaveLength(readsBefore)
    expect(secrets.every((output) => output.every((byte) => byte === 0))).toBe(true)
  })
})
