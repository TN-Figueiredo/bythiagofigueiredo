export type UtmField = 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content' | 'utm_id'

export interface UtmFieldsInput {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_term?: string | null
  utm_content?: string | null
  utm_id?: string | null
}

export interface UtmFieldsNormalized {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  utm_id: string | null
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function normalizeUtmValue(field: UtmField, value: string | null | undefined): string | null {
  if (value == null) return null
  let v = safeDecode(value)
  if (field === 'utm_term') {
    v = v.trim().toLowerCase()
    return v.length === 0 ? null : v
  }
  v = v.normalize('NFKD')
  v = v.replace(/[̀-ͯ]/g, '')
  v = v.toLowerCase().trim()
  v = v.replace(/\s+/g, '-')
  v = v.replace(/[^a-z0-9._-]/g, '')
  v = v.replace(/-{2,}/g, '-')
  v = v.replace(/^-+|-+$/g, '')
  return v.length === 0 ? null : v
}

export function normalizeAllUtmFields(input: UtmFieldsInput): UtmFieldsNormalized {
  return {
    utm_source: normalizeUtmValue('utm_source', input.utm_source),
    utm_medium: normalizeUtmValue('utm_medium', input.utm_medium),
    utm_campaign: normalizeUtmValue('utm_campaign', input.utm_campaign),
    utm_term: normalizeUtmValue('utm_term', input.utm_term),
    utm_content: normalizeUtmValue('utm_content', input.utm_content),
    utm_id: normalizeUtmValue('utm_id', input.utm_id),
  }
}

export function slugifyForCampaign(title: string): string {
  return normalizeUtmValue('utm_campaign', title) ?? ''
}

export const GA4_MEDIUM_SUGGESTIONS = [
  'cpc', 'cpm', 'cpv', 'ppc',
  'paid_social', 'paid_search', 'retargeting',
  'display', 'banner',
  'email', 'social', 'referral', 'affiliate',
  'sms', 'qr', 'video', 'whatsapp', 'push',
  'podcast', 'print', 'organic', 'organic_social',
  'in-app', 'direct_mail', 'audio',
] as const

export function isKnownMedium(value: string): boolean {
  return (GA4_MEDIUM_SUGGESTIONS as readonly string[]).includes(value)
}

export const KNOWN_UTM_SOURCES = [
  'google', 'youtube', 'facebook', 'instagram', 'tiktok',
  'twitter', 'linkedin', 'pinterest', 'reddit', 'whatsapp',
  'telegram', 'bluesky', 'threads', 'newsletter', 'email',
  'bing', 'duckduckgo', 'spotify', 'podcast',
] as const
