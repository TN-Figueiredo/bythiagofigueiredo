import { describe, it, expect } from 'vitest'
import { EMAIL_COLORS, EMAIL_FONTS, emailDarkStyles } from '../../../src/emails/components/email-tokens'

describe('email-tokens', () => {
  it('exports light mode colors with correct accent', () => {
    expect(EMAIL_COLORS.accent).toBe('#FF8240')
    expect(EMAIL_COLORS.bg).toBe('#F7F1E8')
    expect(EMAIL_COLORS.card).toBe('#FBF6EC')
    expect(EMAIL_COLORS.ink).toBe('#1F1B17')
    expect(EMAIL_COLORS.muted).toBe('#6A5F48')
    expect(EMAIL_COLORS.faint).toBe('#9C9178')
    expect(EMAIL_COLORS.line).toBe('#E8DCC8')
  })

  it('exports font stacks as strings', () => {
    expect(EMAIL_FONTS.serif).toContain('Georgia')
    expect(EMAIL_FONTS.sans).toContain('Arial')
    expect(EMAIL_FONTS.mono).toContain('Courier New')
  })

  it('returns dark mode CSS media query block', () => {
    const dark = emailDarkStyles()
    expect(dark).toContain('@media (prefers-color-scheme: dark)')
    expect(dark).toContain('#1A1714')
    expect(dark).toContain('#221E1A')
  })
})
