import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../../../src/lib/ads/crypto'

const TEST_KEY = 'a'.repeat(64)
const ALT_KEY  = 'b'.repeat(64)

describe('ads/crypto', () => {
  it('roundtrip: decrypt(encrypt(plaintext)) === plaintext', () => {
    const plaintext = 'ya29.refresh-token-value'
    const ciphertext = encrypt(plaintext, TEST_KEY)
    expect(ciphertext).not.toBe(plaintext)
    expect(decrypt(ciphertext, TEST_KEY)).toBe(plaintext)
  })

  it('produces different ciphertext on each call (random IV)', () => {
    const a = encrypt('same-value', TEST_KEY)
    const b = encrypt('same-value', TEST_KEY)
    expect(a).not.toBe(b)
    expect(decrypt(a, TEST_KEY)).toBe('same-value')
    expect(decrypt(b, TEST_KEY)).toBe('same-value')
  })

  it('wrong key throws on decrypt', () => {
    const ciphertext = encrypt('secret', TEST_KEY)
    expect(() => decrypt(ciphertext, ALT_KEY)).toThrow()
  })

  it('tampered ciphertext (flipped byte) throws on decrypt', () => {
    const ciphertext = encrypt('secret', TEST_KEY)
    const buf = Buffer.from(ciphertext, 'base64')
    buf[buf.length - 1] ^= 0xff
    const tampered = buf.toString('base64')
    expect(() => decrypt(tampered, TEST_KEY)).toThrow()
  })

  it('handles empty string roundtrip', () => {
    expect(decrypt(encrypt('', TEST_KEY), TEST_KEY)).toBe('')
  })

  it('handles unicode characters', () => {
    const value = '日本語テスト 🎉'
    expect(decrypt(encrypt(value, TEST_KEY), TEST_KEY)).toBe(value)
  })
})
