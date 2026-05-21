import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const originalCronSecret = process.env.CRON_SECRET
beforeEach(() => { process.env.CRON_SECRET = 'test-secret' })
afterEach(() => {
  if (originalCronSecret !== undefined) process.env.CRON_SECRET = originalCronSecret
  else delete process.env.CRON_SECRET
})

import { generateUnsubscribeToken } from '../../../lib/newsletter/confirm-email'

describe('generateUnsubscribeToken', () => {
  it('returns deterministic raw + hash for same inputs', () => {
    const a = generateUnsubscribeToken('site-1', 'user@example.com')
    const b = generateUnsubscribeToken('site-1', 'user@example.com')
    expect(a.raw).toBe(b.raw)
    expect(a.hash).toBe(b.hash)
  })

  it('is case-insensitive on email', () => {
    const lower = generateUnsubscribeToken('site-1', 'user@example.com')
    const upper = generateUnsubscribeToken('site-1', 'User@Example.COM')
    expect(lower.raw).toBe(upper.raw)
  })

  it('differs for different site IDs', () => {
    const a = generateUnsubscribeToken('site-1', 'user@example.com')
    const b = generateUnsubscribeToken('site-2', 'user@example.com')
    expect(a.raw).not.toBe(b.raw)
  })

  it('differs for different emails', () => {
    const a = generateUnsubscribeToken('site-1', 'user@example.com')
    const b = generateUnsubscribeToken('site-1', 'other@example.com')
    expect(a.raw).not.toBe(b.raw)
  })

  it('raw is hex string of 64 chars (SHA-256 HMAC)', () => {
    const { raw } = generateUnsubscribeToken('site-1', 'user@example.com')
    expect(raw).toMatch(/^[a-f0-9]{64}$/)
  })

  it('hash is hex string of 64 chars (SHA-256)', () => {
    const { hash } = generateUnsubscribeToken('site-1', 'user@example.com')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('hash is SHA-256 of raw', () => {
    const { raw, hash } = generateUnsubscribeToken('site-1', 'user@example.com')
    const { createHash } = require('node:crypto')
    const expected = createHash('sha256').update(raw).digest('hex')
    expect(hash).toBe(expected)
  })
})
