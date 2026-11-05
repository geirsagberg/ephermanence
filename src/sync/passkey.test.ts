import { createClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { toBase64, toBase64Url } from './encoding'
import { registerPasskey, signInWithPasskey } from './passkey'

const buffer = (value: number) => new Uint8Array([value]).buffer
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'sync@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
}
const claims = toBase64Url(
  new TextEncoder().encode(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })),
)
const session = {
  access_token: `e30.${claims}.signature`,
  refresh_token: 'refresh',
  token_type: 'bearer',
  expires_in: 3600,
  user,
}

function harness(prf: unknown, { rejectAuthentication = false } = {}) {
  const requests: string[] = []
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input)
    requests.push(`${url.pathname} ${typeof init?.body === 'string' ? init.body : ''}`)
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
    if (url.pathname.endsWith('/registration/options'))
      return json({
        challenge_id: 'registration',
        options: {
          challenge: 'AQID',
          rp: { id: 'localhost', name: 'Ephermanence' },
          user: { id: 'BAUG', name: user.email, displayName: 'Sync' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        },
      })
    if (url.pathname.endsWith('/registration/verify')) return json({ id: 'registered' })
    if (url.pathname.endsWith('/authentication/options'))
      return json({ challenge_id: 'authentication', options: { challenge: 'BwgJ', rpId: 'localhost' } })
    if (url.pathname.endsWith('/authentication/verify'))
      return rejectAuthentication ? json({ msg: 'Rejected challenge' }, 400) : json(session)
    if (url.pathname.endsWith('/user')) return json(user)
    if (url.pathname.endsWith('/token')) return json(session)
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
  const credential = (response: object) => ({
    rawId: buffer(7),
    response,
    getClientExtensionResults: () => ({ prf }),
    toJSON: () => {
      throw new Error('Must never serialize the whole credential')
    },
  })
  const create = vi.fn(async () => credential({ clientDataJSON: buffer(1), attestationObject: buffer(2) }))
  const get = vi.fn(async () =>
    credential({ clientDataJSON: buffer(1), authenticatorData: buffer(3), signature: buffer(4), userHandle: null }),
  )
  vi.stubGlobal('navigator', { credentials: { create, get } })
  const client = createClient('https://sync.supabase.co', 'sb_publishable_test', {
    auth: { experimental: { passkey: true }, persistSession: false, autoRefreshToken: false },
    global: { fetch: fetcher },
  })
  return { client, requests, get }
}

describe('passkey sign-in', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the PRF output without sending it to Supabase', async () => {
    const secret = crypto.getRandomValues(new Uint8Array(32))
    const output = Array.from(secret)
    const { client, requests, get } = harness({ results: { first: output } })

    const result = await signInWithPasskey(client)

    expect(result.userId).toBe(user.id)
    expect(new Uint8Array(result.prfSecret)).toEqual(secret)
    expect(output.every((byte) => byte === 0)).toBe(true)
    const options = (get.mock.calls[0] as unknown as [CredentialRequestOptions])[0].publicKey!
    expect(options.challenge).toEqual(new Uint8Array([7, 8, 9]))
    const sent = requests.join('\n')
    expect(sent).toContain('"clientExtensionResults":{}')
    expect(sent).not.toContain(JSON.stringify(Array.from(secret)))
    expect(sent).not.toContain(toBase64(secret))
    expect(sent).not.toContain(toBase64Url(secret))
  })

  it('refuses a passkey without PRF support', async () => {
    const { client } = harness(undefined)
    await expect(signInWithPasskey(client)).rejects.toThrow('does not support encrypted sync')
  })

  it('does not register a passkey whose provider reports no PRF support', async () => {
    const { client, requests } = harness({ enabled: false })
    await client.auth.signInWithPassword({ email: user.email, password: 'signed-in' })
    await expect(registerPasskey(client)).rejects.toThrow('does not support encrypted sync')
    expect(requests.some((request) => request.includes('/registration/verify'))).toBe(false)
  })

  it('rejects a failed server verification', async () => {
    const { client } = harness(
      { results: { first: crypto.getRandomValues(new Uint8Array(32)).buffer } },
      {
        rejectAuthentication: true,
      },
    )
    await expect(signInWithPasskey(client)).rejects.toThrow('Rejected challenge')
  })
})
