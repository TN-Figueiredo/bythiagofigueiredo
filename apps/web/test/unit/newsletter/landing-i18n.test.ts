import { describe, it, expect } from 'vitest'
import en from '@/locales/en.json'
import pt from '@/locales/pt-BR.json'

// Flat dot-notation keys as used in the locale files.
// The project uses flat keys (e.g. "newsletter.landing.crumbHome") not nested
// JSON objects, so we access them directly via en[key] / pt[key].
const LANDING_STRING_KEYS = [
  'newsletter.landing.crumbHome',
  'newsletter.landing.crumbHub',
  'newsletter.landing.newBadge',
  'newsletter.landing.subsLabel',
  'newsletter.landing.issuesLabel',
  'newsletter.landing.sentLabel',
  'newsletter.landing.daysAgo.today',
  'newsletter.landing.daysAgo.yesterday',
  'newsletter.landing.daysAgo.n',
  'newsletter.landing.sectionWhat',
  'newsletter.landing.stepLabel',
  'newsletter.landing.formTitle',
  'newsletter.landing.formSubtitle',
  'newsletter.landing.emailLabel',
  'newsletter.landing.emailPlaceholder',
  'newsletter.landing.consentPrefix',
  'newsletter.landing.consentSuffix',
  'newsletter.landing.privacy',
  'newsletter.landing.submit',
  'newsletter.landing.submitting',
  'newsletter.landing.noSpam',
  'newsletter.landing.noPitch',
  'newsletter.landing.oneClickLeave',
  'newsletter.landing.pendingTitle',
  'newsletter.landing.pendingBody',
  'newsletter.landing.pendingStep1',
  'newsletter.landing.pendingStep2',
  'newsletter.landing.pendingStep3',
  'newsletter.landing.pendingTip',
  'newsletter.landing.pendingResend',
  'newsletter.landing.pendingResent',
  'newsletter.landing.pendingChangeEmail',
  'newsletter.landing.confirmedTitle',
  'newsletter.landing.confirmedBody',
  'newsletter.landing.confirmedExclamation',
  'newsletter.landing.successAgain',
  'newsletter.landing.errorRateLimit',
  'newsletter.landing.errorAlreadySubscribed',
  'newsletter.landing.errorInvalid',
  'newsletter.landing.errorServer',
  'newsletter.landing.sectionSamples',
  'newsletter.landing.sampleReadFull',
  'newsletter.landing.sectionAuthor',
  'newsletter.landing.authorRole',
  'newsletter.landing.authorBio',
  'newsletter.landing.authorMore',
  'newsletter.landing.authorNow',
  'newsletter.landing.sectionFaq',
  'newsletter.landing.finalKicker',
  'newsletter.landing.finalTitle',
  'newsletter.landing.finalSub',
  'newsletter.landing.finalSubscribers',
  'newsletter.landing.backToTopForm',
  'newsletter.landing.footerNote',
  'newsletter.landing.footerSub',
  'newsletter.landing.backToHome',
  'newsletter.landing.allNewsletters',
  'newsletter.landing.backToHub',
  'newsletter.landing.notFoundExclamation',
  'newsletter.landing.notFoundTitle',
  'newsletter.landing.notFoundBody',
  'newsletter.landing.goHome',
] as const

type LocaleJson = Record<string, unknown>

describe('newsletter landing i18n', () => {
  it('en.json has all landing string keys', () => {
    const dict = en as LocaleJson
    for (const key of LANDING_STRING_KEYS) {
      const val = dict[key]
      expect(val, `missing en key: ${key}`).toBeDefined()
      expect(typeof val === 'string' ? val.length > 0 : true, `empty en key: ${key}`).toBe(true)
    }
  })

  it('pt-BR.json has all landing string keys', () => {
    const dict = pt as LocaleJson
    for (const key of LANDING_STRING_KEYS) {
      const val = dict[key]
      expect(val, `missing pt-BR key: ${key}`).toBeDefined()
      expect(typeof val === 'string' ? val.length > 0 : true, `empty pt-BR key: ${key}`).toBe(true)
    }
  })

  it('both locales have FAQ arrays of equal length', () => {
    const enDict = en as LocaleJson
    const ptDict = pt as LocaleJson
    const enFaq = enDict['newsletter.landing.faq'] as Array<unknown>
    const ptFaq = ptDict['newsletter.landing.faq'] as Array<unknown>
    expect(Array.isArray(enFaq)).toBe(true)
    expect(Array.isArray(ptFaq)).toBe(true)
    expect(enFaq.length).toBe(ptFaq.length)
    expect(enFaq.length).toBeGreaterThanOrEqual(3)
  })
})
