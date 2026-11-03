// Disposable capability probe, not the application's encryption format.
const message = 'Ephermanence cross-device PRF probe v1'
const context = new TextEncoder().encode(message)

export type Probe = {
  version: 1
  rpId: string
  credentialId: string
  salt: string
  iv: string
  ciphertext: string
}

function encode(value: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  return btoa(String.fromCharCode(...new Uint8Array(value instanceof ArrayBuffer ? value : value.buffer)))
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

async function key(secret: ArrayBuffer, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: context },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function sealProbe(
  secret: ArrayBuffer,
  credentialId: string,
  rpId: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<Probe> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: context },
    await key(secret, salt),
    context,
  )
  return { version: 1, rpId, credentialId, salt: encode(salt), iv: encode(iv), ciphertext: encode(ciphertext) }
}

export async function openProbe(secret: ArrayBuffer, probe: Probe): Promise<void> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(probe.iv), additionalData: context },
    await key(secret, decode(probe.salt)),
    decode(probe.ciphertext),
  )
  if (new TextDecoder().decode(plaintext) !== message) throw new Error('Unexpected probe contents.')
}

export function parseProbe(text: string, rpId: string): Probe {
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object') throw new Error('Invalid probe.')
  const probe = value as Record<string, unknown>
  if (
    probe.version !== 1 ||
    probe.rpId !== rpId ||
    !['credentialId', 'salt', 'iv', 'ciphertext'].every((field) => typeof probe[field] === 'string')
  ) {
    throw new Error('Invalid probe or different hostname. Use the original hostname on every device.')
  }
  if (decode(probe.salt as string).length !== 32 || decode(probe.iv as string).length !== 12)
    throw new Error('Invalid probe salt or IV.')
  decode(probe.credentialId as string)
  decode(probe.ciphertext as string)
  return probe as Probe
}

async function evaluate(credentialId: string, salt: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: decode(credentialId) }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('No passkey returned.')
  const extensions = credential.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & {
    prf?: { results?: { first?: ArrayBuffer } }
  }
  const secret = extensions.prf?.results?.first
  if (!secret || secret.byteLength !== 32)
    throw new Error('This browser/provider did not return a PRF secret. Capability check failed.')
  return secret
}

export async function createProbe(): Promise<Probe> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { id: location.hostname, name: 'Ephermanence capability probe' },
      user: {
        id: crypto.getRandomValues(new Uint8Array(32)),
        name: `probe-${Date.now()}`,
        displayName: 'Disposable sync probe',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      attestation: 'none',
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('No passkey created.')
  const credentialId = encode(credential.rawId)
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const secret = await evaluate(credentialId, salt)
  try {
    return await sealProbe(secret, credentialId, location.hostname, salt)
  } finally {
    new Uint8Array(secret).fill(0)
  }
}

export async function verifyProbe(probe: Probe): Promise<void> {
  const secret = await evaluate(probe.credentialId, decode(probe.salt))
  try {
    await openProbe(secret, probe)
  } finally {
    new Uint8Array(secret).fill(0)
  }
}
