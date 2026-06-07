import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

export function getMasterKey(): Buffer {
  const hex = process.env['SOCIAL_MASTER_KEY']
  if (!hex || hex.length !== 64) {
    throw new Error(
      'SOCIAL_MASTER_KEY must be a 64 hex-char string (32 bytes)',
    )
  }
  return Buffer.from(hex, 'hex')
}

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  // base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(encoded: string, key: Buffer): string {
  const buf = Buffer.from(encoded, 'base64')

  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)

  // authTagLength enforces a full 128-bit tag — without it Node accepts
  // truncated tags, weakening GCM integrity guarantees.
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(tag)

  return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8')
}
