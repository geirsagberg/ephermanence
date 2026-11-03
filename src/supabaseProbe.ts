import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { openProbe, parseProbe, readPrfSecret, sealProbe, type Probe } from './passkeyProbe'

function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function bytes(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (character) => character.charCodeAt(0))
}

// Explicit allowlists: never call credential.toJSON() or send extension results.
export function registrationPayload(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse
  return {
    id: base64url(credential.rawId), rawId: base64url(credential.rawId), type: 'public-key' as const,
    response: {
      clientDataJSON: base64url(response.clientDataJSON),
      attestationObject: base64url(response.attestationObject),
    },
    clientExtensionResults: {},
  }
}

export function authenticationPayload(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse
  return {
    id: base64url(credential.rawId), rawId: base64url(credential.rawId), type: 'public-key' as const,
    response: {
      clientDataJSON: base64url(response.clientDataJSON),
      authenticatorData: base64url(response.authenticatorData),
      signature: base64url(response.signature),
      userHandle: response.userHandle ? base64url(response.userHandle) : undefined,
    },
    clientExtensionResults: {},
  }
}

export function probeClient(url: string, publishableKey: string) {
  if (!publishableKey.startsWith('sb_publishable_')) throw new Error('Use a Supabase publishable key (sb_publishable_).')
  return createClient(url, publishableKey, {
    auth: { experimental: { passkey: true }, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function authenticate(client: SupabaseClient, credentialId: string, salt: Uint8Array<ArrayBuffer>) {
  const signedOut = await client.auth.signOut({ scope: 'local' })
  if (signedOut.error) throw signedOut.error
  const { data, error } = await client.auth.passkey.startAuthentication()
  if (error) throw error
  if (data.options.rpId !== location.hostname) throw new Error('Supabase RP ID must match this hostname.')
  const credential = await navigator.credentials.get({ publicKey: {
    ...data.options,
    challenge: bytes(data.options.challenge),
    allowCredentials: [{ type: 'public-key', id: bytes(credentialId) }],
    userVerification: 'required',
    extensions: { prf: { eval: { first: salt } } },
  } }) as PublicKeyCredential | null
  if (!credential) throw new Error('No passkey returned.')
  if (base64url(credential.rawId) !== base64url(bytes(credentialId).buffer)) throw new Error('Wrong passkey selected.')
  const secret = readPrfSecret(credential)
  try {
    const verified = await client.auth.passkey.verifyAuthentication({
      challengeId: data.challenge_id, credential: authenticationPayload(credential),
    })
    if (verified.error) throw verified.error
    if (!verified.data.session) throw new Error('Supabase did not create a session.')
    const user = await client.auth.getUser()
    if (user.error) throw user.error
    return { secret, userId: user.data.user.id }
  } catch (error) {
    new Uint8Array(secret).fill(0)
    await client.auth.signOut({ scope: 'local' })
    throw error
  }
}

export async function registerSupabaseProbe(client: SupabaseClient): Promise<Probe> {
  const { data, error } = await client.auth.passkey.startRegistration()
  if (error) throw error
  if (data.options.rp.id !== location.hostname) throw new Error('Supabase RP ID must match this hostname.')
  const credential = await navigator.credentials.create({ publicKey: {
    ...data.options,
    challenge: bytes(data.options.challenge),
    user: { ...data.options.user, id: bytes(data.options.user.id) },
    excludeCredentials: data.options.excludeCredentials?.map((entry) => ({ type: entry.type, id: bytes(entry.id) })),
    extensions: { prf: {} },
  } }) as PublicKeyCredential | null
  if (!credential) throw new Error('No passkey created.')
  const verified = await client.auth.passkey.verifyRegistration({
    challengeId: data.challenge_id, credential: registrationPayload(credential),
  })
  if (verified.error) throw verified.error
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
  const { secret, userId } = await authenticate(client, credentialId, salt)
  try {
    const probe = await sealProbe(secret, credentialId, location.hostname, salt)
    const stored = await client.from('secure_sync_probes').upsert({ user_id: userId, fixture: probe })
    if (stored.error) throw stored.error
    return probe
  } finally {
    new Uint8Array(secret).fill(0)
    await client.auth.signOut({ scope: 'local' })
  }
}

export async function verifySupabaseProbe(client: SupabaseClient, probe: Probe): Promise<void> {
  const { secret, userId } = await authenticate(client, probe.credentialId, bytes(probe.salt))
  try {
    const stored = await client.from('secure_sync_probes').select('fixture').eq('user_id', userId).single()
    if (stored.error) throw stored.error
    const remote = parseProbe(JSON.stringify(stored.data.fixture), location.hostname)
    if (remote.credentialId !== probe.credentialId || remote.salt !== probe.salt) throw new Error('Stored fixture does not match this passkey probe.')
    await openProbe(secret, remote)
  } finally {
    new Uint8Array(secret).fill(0)
    await client.auth.signOut({ scope: 'local' })
  }
}
