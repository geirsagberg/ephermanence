import { afterEach, describe, expect, it, vi } from 'vitest'
import { openProbe, parseProbe, sealProbe, verifyProbe } from './passkeyProbe'

describe('PRF capability probe', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requires PRF output from a fresh ceremony and clears it after decryption', async () => {
    const secret = crypto.getRandomValues(new Uint8Array(32)).buffer
    const probe = await sealProbe(secret, btoa('credential'), 'localhost', crypto.getRandomValues(new Uint8Array(32)))
    vi.stubGlobal('location', { hostname: 'localhost' })
    const get = vi.fn().mockResolvedValue({ getClientExtensionResults: () => ({}) })
    vi.stubGlobal('navigator', { credentials: { get } })
    await expect(verifyProbe(probe)).rejects.toThrow('did not return a PRF secret')
    get.mockResolvedValue({ getClientExtensionResults: () => ({ prf: { results: { first: secret } } }) })
    await expect(verifyProbe(probe)).resolves.toBeUndefined()
    expect(new Uint8Array(secret).every((byte) => byte === 0)).toBe(true)
    get.mockRejectedValue(new DOMException('Cancelled', 'NotAllowedError'))
    await expect(verifyProbe(probe)).rejects.toThrow('Cancelled')
  })

  it('decrypts a transferred fixture with the same secret and rejects another secret or altered ciphertext', async () => {
    const secret = crypto.getRandomValues(new Uint8Array(32)).buffer
    const probe = await sealProbe(secret, btoa('credential'), 'localhost', crypto.getRandomValues(new Uint8Array(32)))
    const transferred = parseProbe(JSON.stringify(probe), 'localhost')
    await expect(openProbe(secret, transferred)).resolves.toBeUndefined()
    await expect(openProbe(crypto.getRandomValues(new Uint8Array(32)).buffer, transferred)).rejects.toThrow()
    const bytes = Uint8Array.from(atob(probe.ciphertext), (character) => character.charCodeAt(0))
    bytes[0] ^= 1
    await expect(openProbe(secret, { ...probe, ciphertext: btoa(String.fromCharCode(...bytes)) })).rejects.toThrow()
    expect(Object.keys(probe).sort()).toEqual(['ciphertext', 'credentialId', 'iv', 'rpId', 'salt', 'version'])
  })

  it('rejects another hostname and malformed fixtures before asking for a passkey', () => {
    expect(() => parseProbe('{}', 'localhost')).toThrow()
    expect(() => parseProbe(JSON.stringify({ version: 1, rpId: 'other' }), 'localhost')).toThrow()
  })
})
