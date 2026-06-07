import { describe, it, expect, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'
import { encrypt, decrypt, getMasterKey } from './token-vault'

const KEY = randomBytes(32)
const HEX_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes

describe('token-vault: encrypt/decrypt round-trip', () => {
  it('round-trips plain ASCII', () => {
    const plain = 'ya29.a0AfH6SMB-fake-access-token'
    expect(decrypt(encrypt(plain, KEY), KEY)).toBe(plain)
  })

  it('round-trips UTF-8 (accents + emoji)', () => {
    const plain = 'ção — café 日本語 🔐'
    expect(decrypt(encrypt(plain, KEY), KEY)).toBe(plain)
  })

  it('round-trips the empty string', () => {
    expect(decrypt(encrypt('', KEY), KEY)).toBe('')
  })

  it('round-trips a large payload (>10KB)', () => {
    const plain = 'x'.repeat(12_000)
    expect(decrypt(encrypt(plain, KEY), KEY)).toBe(plain)
  })
})

describe('token-vault: ciphertext properties', () => {
  it('produces valid base64 with at least IV(12)+TAG(16) bytes', () => {
    const encoded = encrypt('hello', KEY)
    const buf = Buffer.from(encoded, 'base64')
    expect(buf.length).toBeGreaterThanOrEqual(12 + 16)
    // base64 round-trips back to the same bytes
    expect(buf.toString('base64')).toBe(encoded)
  })

  it('uses a fresh IV per call (same plaintext → different ciphertext)', () => {
    const a = encrypt('same', KEY)
    const b = encrypt('same', KEY)
    expect(a).not.toBe(b)
    // ...but both decrypt to the original
    expect(decrypt(a, KEY)).toBe('same')
    expect(decrypt(b, KEY)).toBe('same')
  })
})

describe('token-vault: tamper resistance (GCM auth)', () => {
  const make = () => Buffer.from(encrypt('secret-token', KEY), 'base64')

  it('rejects a flipped byte in the ciphertext body', () => {
    const buf = make()
    buf[buf.length - 1] ^= 0x01 // last byte = ciphertext
    expect(() => decrypt(buf.toString('base64'), KEY)).toThrow()
  })

  it('rejects a tampered auth tag', () => {
    const buf = make()
    buf[12] ^= 0x01 // first tag byte (tag spans bytes 12..28)
    expect(() => decrypt(buf.toString('base64'), KEY)).toThrow()
  })

  it('rejects a tampered IV', () => {
    const buf = make()
    buf[0] ^= 0x01 // first IV byte (IV spans bytes 0..12)
    expect(() => decrypt(buf.toString('base64'), KEY)).toThrow()
  })

  it('rejects decryption with the wrong key', () => {
    const encoded = encrypt('secret-token', KEY)
    expect(() => decrypt(encoded, randomBytes(32))).toThrow()
  })

  it('rejects a truncated payload (shorter than IV+TAG)', () => {
    const tooShort = randomBytes(20).toString('base64')
    expect(() => decrypt(tooShort, KEY)).toThrow()
  })
})

describe('token-vault: getMasterKey', () => {
  const original = process.env['SOCIAL_MASTER_KEY']
  afterEach(() => {
    if (original === undefined) delete process.env['SOCIAL_MASTER_KEY']
    else process.env['SOCIAL_MASTER_KEY'] = original
  })

  it('returns a 32-byte Buffer for a 64 hex-char key', () => {
    process.env['SOCIAL_MASTER_KEY'] = HEX_KEY
    const key = getMasterKey()
    expect(key).toBeInstanceOf(Buffer)
    expect(key.length).toBe(32)
  })

  it('the derived key encrypts/decrypts round-trip', () => {
    process.env['SOCIAL_MASTER_KEY'] = HEX_KEY
    const key = getMasterKey()
    expect(decrypt(encrypt('via-env-key', key), key)).toBe('via-env-key')
  })

  it('throws when SOCIAL_MASTER_KEY is missing', () => {
    delete process.env['SOCIAL_MASTER_KEY']
    expect(() => getMasterKey()).toThrow(/64 hex/)
  })

  it('throws when SOCIAL_MASTER_KEY has the wrong length', () => {
    process.env['SOCIAL_MASTER_KEY'] = 'abc123'
    expect(() => getMasterKey()).toThrow(/64 hex/)
  })
})
