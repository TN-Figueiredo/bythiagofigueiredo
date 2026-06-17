import { describe, it, expect } from 'vitest'
import { redactMessage, scrub } from '../../lib/waitlists/scrub'

describe('redactMessage', () => {
  it('redacts email and IPv4 from a mixed string', () => {
    const result = redactMessage('a@b.com from 203.0.113.5')
    expect(result).not.toContain('a@b.com')
    expect(result).not.toContain('203.0.113.5')
    expect(result).toContain('[email]')
    expect(result).toContain('[ip]')
  })

  it('redacts a full IPv6 address', () => {
    const result = redactMessage('client 2001:db8::1 here')
    expect(result).toContain('[ip]')
    expect(result).not.toContain('2001:db8::1')
  })

  it('redacts an IPv4-mapped IPv6 address to a single [ip] token', () => {
    const result = redactMessage('addr ::ffff:203.0.113.5')
    // The IPv6 pass collapses ::ffff:203.0.113.5 → [ip]; no leftover digits
    expect(result).toContain('[ip]')
    expect(result).not.toContain('::ffff:')
    expect(result).not.toContain('203.0.113.5')
    // Must be exactly one [ip] token — no leftover digits that become a second one
    expect(result.match(/\[ip\]/g)?.length).toBe(1)
  })
})

describe('scrub', () => {
  it('drops email/ip/user_agent keys and keeps the rest', () => {
    const out = scrub({ email: 'a@b.com', ip: '203.0.113.5', user_agent: 'curl/8', foo: 1, bar: 'keep' })
    expect(out).toEqual({ foo: 1, bar: 'keep' })
  })

  it('is a no-op when none of the PII keys are present', () => {
    expect(scrub({ foo: 1 })).toEqual({ foo: 1 })
  })
})
