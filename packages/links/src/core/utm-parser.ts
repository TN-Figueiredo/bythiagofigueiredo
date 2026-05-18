import type { UtmParams } from '../types.js'

/**
 * Parse utm_* query parameters from a URL string.
 */
export function parseUtm(urlStr: string): UtmParams {
  const url = new URL(urlStr)
  return extractUtmFromSearchParams(url.searchParams)
}

/**
 * Extract UTM params from a URLSearchParams object.
 */
export function extractUtmFromSearchParams(params: URLSearchParams): UtmParams {
  const get = (key: string): string | undefined => params.get(key) ?? undefined
  return {
    utmSource: get('utm_source'),
    utmMedium: get('utm_medium'),
    utmCampaign: get('utm_campaign'),
    utmTerm: get('utm_term'),
    utmContent: get('utm_content'),
    utmId: get('utm_id'),
  }
}

/**
 * Build a URL with UTM params appended.
 * Does NOT overwrite existing UTM params on the destination URL.
 */
export function buildUtmUrl(baseUrl: string, utm: UtmParams): string {
  const url = new URL(baseUrl)

  const mapping: Array<[keyof UtmParams, string]> = [
    ['utmSource', 'utm_source'],
    ['utmMedium', 'utm_medium'],
    ['utmCampaign', 'utm_campaign'],
    ['utmTerm', 'utm_term'],
    ['utmContent', 'utm_content'],
    ['utmId', 'utm_id'],
  ]

  for (const [key, param] of mapping) {
    const value = utm[key]
    if (value != null && !url.searchParams.has(param)) {
      url.searchParams.set(param, value)
    }
  }

  return url.toString()
}

/**
 * Strip all utm_* parameters from a URL.
 */
export function stripUtm(urlStr: string): string {
  const url = new URL(urlStr)
  const keysToDelete: string[] = []
  for (const key of url.searchParams.keys()) {
    if (key.startsWith('utm_')) {
      keysToDelete.push(key)
    }
  }
  for (const key of keysToDelete) {
    url.searchParams.delete(key)
  }
  // Remove trailing '?' if no params left
  let result = url.toString()
  if (result.endsWith('?')) {
    result = result.slice(0, -1)
  }
  return result
}
