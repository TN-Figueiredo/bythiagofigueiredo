import type { ReferrerSrc } from './events'

const SEARCH_RE = /google\.|bing\.|yahoo\.|duckduckgo\.|baidu\./
const SOCIAL_RE = /twitter\.|x\.com|facebook\.|instagram\.|linkedin\.|threads\.net|reddit\./
const NEWSLETTER_DOMAIN = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'

export function classifyReferrer(
  referrer: string | null,
  currentUrl: string,
): ReferrerSrc {
  if (!referrer) return 'direct'

  try {
    const host = new URL(referrer).hostname
    if (SEARCH_RE.test(host)) return 'google'
    if (host.includes(NEWSLETTER_DOMAIN)) return 'newsletter'
    if (SOCIAL_RE.test(host)) return 'social'
  } catch {
    // malformed referrer URL
  }

  try {
    if (currentUrl) {
      const utm = new URL(currentUrl).searchParams.get('utm_source')
      if (utm === 'newsletter') return 'newsletter'
    }
  } catch {
    // ignore
  }

  return referrer ? 'other' : 'direct'
}
