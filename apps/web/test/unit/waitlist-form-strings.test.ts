import { describe, it, expect } from 'vitest'
import { FORM_STRINGS, type WaitlistLocale } from '@/components/waitlists/form-strings'

const LOCALES: WaitlistLocale[] = ['pt-BR', 'en']
// Every state the public form state machine renders (spec §7) must have copy.
const STRING_KEYS = [
  'emailPlaceholder', 'emailLabel', 'button', 'buttonLoading', 'successHeadline', 'successBody',
  'duplicateHeadline', 'duplicateBody', 'closed', 'launched', 'raceClosed',
  'error', 'rateLimited', 'unavailable', 'reassurance',
] as const

describe('FORM_STRINGS', () => {
  it('defines copy for both supported locales', () => {
    expect(Object.keys(FORM_STRINGS).sort()).toEqual(['en', 'pt-BR'])
  })

  it('has a non-empty string for every state key in every locale', () => {
    for (const loc of LOCALES) {
      const s = FORM_STRINGS[loc]
      for (const k of STRING_KEYS) {
        expect(typeof s[k], `${loc}.${k}`).toBe('string')
        expect((s[k] as string).length, `${loc}.${k}`).toBeGreaterThan(0)
      }
    }
  })

  it('consentLabel is a function that interpolates the waitlist name (LGPD ledger match)', () => {
    for (const loc of LOCALES) {
      const label = FORM_STRINGS[loc].consentLabel('Curso X')
      expect(typeof label).toBe('string')
      expect(label).toContain('Curso X')
      // no leftover placeholder token — must equal the ledger text after substitution
      expect(label).not.toContain('{name}')
    }
  })

  it('pt-BR consent + en consent carry the unsubscribe/cancel reassurance', () => {
    expect(FORM_STRINGS['pt-BR'].consentLabel('X').toLowerCase()).toContain('cancelar')
    expect(FORM_STRINGS.en.consentLabel('X').toLowerCase()).toContain('unsubscribe')
  })
})
