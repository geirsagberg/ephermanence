import type { SupabaseClient } from '@supabase/supabase-js'

import { fromBase64Url, toBase64Url } from './encoding'

// Every device asks the passkey for the same PRF output, so the same passkey unlocks the space anywhere.
const prfInput = new TextEncoder().encode('ephermanence passkey prf v1')

/** Registers a passkey for the signed-in account and returns its credential ID. */
export async function registerPasskey(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.passkey.startRegistration()
  if (error) throw error
  const credential = (await navigator.credentials.create({
    publicKey: {
      ...data.options,
      challenge: fromBase64Url(data.options.challenge),
      user: { ...data.options.user, id: fromBase64Url(data.options.user.id) },
      excludeCredentials: data.options.excludeCredentials?.map((entry) => ({
        type: entry.type,
        id: fromBase64Url(entry.id),
      })),
      extensions: { prf: {} },
    },
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('No passkey was created.')
  // Stop before Supabase stores a passkey that could never unlock the space.
  const { prf } = credential.getClientExtensionResults() as { prf?: { enabled?: boolean } }
  if (prf?.enabled !== true) throw new Error('This browser or passkey provider does not support encrypted sync.')
  const verified = await client.auth.passkey.verifyRegistration({
    challengeId: data.challenge_id,
    credential: registrationPayload(credential),
  })
  if (verified.error) throw verified.error
  return toBase64Url(credential.rawId)
}

/**
 * Signs in with a passkey and evaluates PRF in the same ceremony. The PRF output stays on this
 * device: the payload sent to Supabase is built field by field and never includes extension results.
 */
export async function signInWithPasskey(client: SupabaseClient, credentialId?: string) {
  const { data, error } = await client.auth.passkey.startAuthentication()
  if (error) throw error
  const credential = (await navigator.credentials.get({
    publicKey: {
      ...data.options,
      challenge: fromBase64Url(data.options.challenge),
      allowCredentials: credentialId
        ? [{ type: 'public-key', id: fromBase64Url(credentialId) }]
        : data.options.allowCredentials?.map((entry) => ({ type: entry.type, id: fromBase64Url(entry.id) })),
      userVerification: 'required',
      extensions: { prf: { eval: { first: prfInput } } },
    },
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('No passkey was selected.')
  const prfSecret = readPrfSecret(credential)
  try {
    const verified = await client.auth.passkey.verifyAuthentication({
      challengeId: data.challenge_id,
      credential: authenticationPayload(credential),
    })
    if (verified.error) throw verified.error
    const userId = verified.data.session?.user.id
    if (!userId) throw new Error('Supabase did not create a session.')
    return { userId, prfSecret }
  } catch (error) {
    new Uint8Array(prfSecret).fill(0)
    throw error
  }
}

export function readPrfSecret(credential: PublicKeyCredential): ArrayBuffer {
  const extensions = credential.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & {
    prf?: { results?: { first?: ArrayBuffer | ArrayBufferView | number[] } }
  }
  const secret = extensions.prf?.results?.first
  if (!secret) throw new Error('This browser or passkey provider does not support encrypted sync.')
  // 1Password can return a plain array instead of a BufferSource.
  if (Array.isArray(secret)) {
    if (secret.length !== 32 || !secret.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255))
      throw new Error('The passkey returned an unexpected PRF output.')
    const buffer = Uint8Array.from(secret).buffer
    secret.fill(0)
    return buffer
  }
  const bytes = ArrayBuffer.isView(secret)
    ? new Uint8Array(secret.buffer, secret.byteOffset, secret.byteLength)
    : new Uint8Array(secret)
  if (bytes.byteLength !== 32) throw new Error('The passkey returned an unexpected PRF output.')
  return bytes.slice().buffer
}

// Explicit allowlists: never call credential.toJSON() or send extension results.
export function registrationPayload(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse
  return {
    id: toBase64Url(credential.rawId),
    rawId: toBase64Url(credential.rawId),
    type: 'public-key' as const,
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      attestationObject: toBase64Url(response.attestationObject),
    },
    clientExtensionResults: {},
  }
}

export function authenticationPayload(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse
  return {
    id: toBase64Url(credential.rawId),
    rawId: toBase64Url(credential.rawId),
    type: 'public-key' as const,
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: toBase64Url(response.authenticatorData),
      signature: toBase64Url(response.signature),
      userHandle: response.userHandle ? toBase64Url(response.userHandle) : undefined,
    },
    clientExtensionResults: {},
  }
}
