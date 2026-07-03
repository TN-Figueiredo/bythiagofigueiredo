import { describe, it, expect } from 'vitest'
import { parseEmbedAccent } from '../../lib/waitlists/embed'

// Surface 2 — `?accent=RRGGBB` validation (^[0-9a-fA-F]{6}$). The value lands in an
// inline style attribute, so anything but exactly 6 hex digits MUST be rejected
// (returns null → the theme default --pb-accent stays in effect).
describe('parseEmbedAccent', () => {
  it('accepts 6 lowercase hex digits and returns a #-prefixed color', () => {
    expect(parseEmbedAccent('ff8240')).toBe('#ff8240')
  })

  it('accepts uppercase/mixed-case hex and normalizes to lowercase', () => {
    expect(parseEmbedAccent('FF8240')).toBe('#ff8240')
    expect(parseEmbedAccent('C14513')).toBe('#c14513')
    expect(parseEmbedAccent('aB12Cd')).toBe('#ab12cd')
  })

  it('returns null when the param is absent', () => {
    expect(parseEmbedAccent(undefined)).toBeNull()
  })

  it.each([
    ['3-digit shorthand', 'f84'],
    ['too long (8 digits)', 'ff8240ff'],
    ['leading #', '#ff8240'],
    ['non-hex letters', 'gg8240'],
    ['CSS keyword', 'orange'],
    ['CSS injection attempt', 'ff8240;background:url(x)'],
    ['whitespace-padded', ' ff8240'],
    ['empty string', ''],
  ])('rejects %s', (_label, raw) => {
    expect(parseEmbedAccent(raw)).toBeNull()
  })

  it('rejects a repeated param (string array) instead of picking one', () => {
    expect(parseEmbedAccent(['ff8240', 'c14513'])).toBeNull()
  })
})
