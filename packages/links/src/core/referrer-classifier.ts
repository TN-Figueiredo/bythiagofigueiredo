import type { ReferrerCategory } from '../types.js'

const SOCIAL_DOMAINS = [
  'facebook.com',
  'fb.com',
  't.co',
  'twitter.com',
  'x.com',
  'instagram.com',
  'linkedin.com',
  'reddit.com',
  'tiktok.com',
  'youtube.com',
  'youtu.be',
  'threads.net',
  'bsky.app',
  'mastodon.social',
  'pinterest.com',
  'tumblr.com',
  'snapchat.com',
]

const EMAIL_DOMAINS = [
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'mail.yahoo.com',
  'mail.protonmail.com',
  'protonmail.com',
  'mail.aol.com',
  'webmail.',
]

/**
 * Classify a referrer URL into one of 7 categories.
 */
export function classifyReferrer(referrer: string | null | undefined): ReferrerCategory {
  if (!referrer) return 'direct'

  let url: URL
  try {
    url = new URL(referrer)
  } catch {
    return 'other'
  }

  const hostname = url.hostname.toLowerCase()
  const fullUrl = referrer.toLowerCase()

  // Check QR referrer markers first (utm_source=qr, utm_medium=qr, ref=qr)
  const params = url.searchParams
  if (
    params.get('ref') === 'qr' ||
    params.get('utm_source') === 'qr' ||
    params.get('utm_medium') === 'qr'
  ) {
    return 'qr'
  }

  // Check for newsletter (utm_medium=email from newsletter context)
  if (params.get('utm_medium') === 'email') {
    return 'newsletter'
  }

  // Check email providers
  for (const domain of EMAIL_DOMAINS) {
    if (hostname.includes(domain)) return 'email'
  }

  // Check Google (must be after email check for mail.google.com)
  if (/^(www\.)?google\./i.test(hostname)) return 'google'

  // Check social platforms
  for (const domain of SOCIAL_DOMAINS) {
    if (hostname === domain || hostname.endsWith('.' + domain)) return 'social'
  }

  return 'other'
}
