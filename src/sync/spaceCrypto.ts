import { parseSpaceState } from '../spaceStorage'
import type { SpaceState } from '../types'
import { fromBase64, toBase64 } from './encoding'

/** The space key, encrypted with a key derived from the passkey's PRF output. */
export type SealedSpaceKey = { version: 1; salt: string; iv: string; wrappedKey: string }

/** A whole space, encrypted with the space key. */
export type SealedSpace = { version: 1; iv: string; ciphertext: string }

/** Binds a sealed space to its owner and revision, so the backend cannot swap or relabel it. */
export type SpaceContext = { userId: string; revision: number }

const encoder = new TextEncoder()
const keyInfo = encoder.encode('ephermanence space key v1')
const spaceKeyAlgorithm = { name: 'AES-GCM', length: 256 } as const

/** Creates a random space key. The returned key is non-extractable; only the sealed copy leaves the device. */
export async function createSpaceKey(prfSecret: ArrayBuffer) {
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const spaceKey = await crypto.subtle.generateKey(spaceKeyAlgorithm, true, ['encrypt', 'decrypt'])
  const wrappedKey = await crypto.subtle.wrapKey('raw', spaceKey, await unlockingKey(prfSecret, salt), {
    name: 'AES-GCM',
    iv,
  })
  const sealed: SealedSpaceKey = {
    version: 1,
    salt: toBase64(salt),
    iv: toBase64(iv),
    wrappedKey: toBase64(wrappedKey),
  }
  return { key: await openSpaceKey(prfSecret, sealed), sealed }
}

export async function openSpaceKey(prfSecret: ArrayBuffer, sealed: SealedSpaceKey): Promise<CryptoKey> {
  if (sealed.version !== 1) throw new Error('Unsupported space key format.')
  return crypto.subtle.unwrapKey(
    'raw',
    fromBase64(sealed.wrappedKey),
    await unlockingKey(prfSecret, fromBase64(sealed.salt)),
    { name: 'AES-GCM', iv: fromBase64(sealed.iv) },
    spaceKeyAlgorithm,
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function sealSpace(key: CryptoKey, space: SpaceState, context: SpaceContext): Promise<SealedSpace> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(context) },
    key,
    encoder.encode(JSON.stringify(space)),
  )
  return { version: 1, iv: toBase64(iv), ciphertext: toBase64(ciphertext) }
}

/** Decrypts and validates a sealed space. Throws rather than returning data that could replace local work. */
export async function openSpace(key: CryptoKey, sealed: SealedSpace, context: SpaceContext): Promise<SpaceState> {
  if (sealed.version !== 1) throw new Error('Unsupported space format.')
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(sealed.iv), additionalData: additionalData(context) },
    key,
    fromBase64(sealed.ciphertext),
  )
  const space = parseSpaceState(JSON.parse(new TextDecoder().decode(plaintext)))
  if (!space) throw new Error('The synced space is not valid.')
  return space
}

async function unlockingKey(prfSecret: ArrayBuffer, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey('raw', prfSecret, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: keyInfo },
    material,
    spaceKeyAlgorithm,
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

function additionalData({ userId, revision }: SpaceContext) {
  return encoder.encode(`ephermanence space v1:${userId}:${revision}`)
}
