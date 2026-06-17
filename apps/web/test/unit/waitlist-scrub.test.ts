import { describe, it, expect } from 'vitest'
import { redactMessage, scrub } from '../../lib/waitlists/scrub'

// redactMessage delegates to the canonical scrubPiiString (WL-CQ-1), whose tokens are
// `<email>` / `[REDACTED_IP]` / `[REDACTED_CPF]` / `[REDACTED_PHONE]`. We assert the
// security property (no raw PII survives) rather than coupling to a specific token.
describe('redactMessage', () => {
  it('redacts email and IPv4 from a mixed string', () => {
    const result = redactMessage('a@b.com from 203.0.113.5')
    expect(result).not.toContain('a@b.com')
    expect(result).not.toContain('203.0.113.5')
    expect(result).toContain('<email>')
    expect(result).toContain('[REDACTED_IP]')
  })

  it('redacts a full IPv6 address', () => {
    const result = redactMessage('client 2001:db8::1 here')
    expect(result).toContain('[REDACTED_IP]')
    expect(result).not.toContain('2001:db8::1')
  })

  it('inherits CPF redaction from the canonical scrubber', () => {
    const result = redactMessage('subject 123.456.789-00 failed')
    expect(result).not.toContain('123.456.789-00')
    expect(result).toContain('[REDACTED_CPF]')
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
