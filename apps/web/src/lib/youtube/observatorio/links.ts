import type { NicheScope } from './niche'
import type { Fmt } from './types'

export const OBS_BASE = '/cms/youtube/competitors'

/** Object keys that prevent niche= from being included in the query string. */
const OBJ_KEYS = ['video', 'change', 'changes', 'channel', 'reading'] as const

/**
 * Converts an object to a query string, filtering out null/empty values
 * and applying URLSearchParams-style encoding.
 */
function qs(obj: Record<string, unknown> | undefined): string {
  if (!obj) return ''
  const params = new URLSearchParams()

  Object.entries(obj).forEach(([key, value]) => {
    // Filter out null, empty string, empty arrays, and false values
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0) || value === false) {
      return
    }

    if (Array.isArray(value)) {
      params.set(key, value.join(','))
    } else {
      params.set(key, String(value))
    }
  })

  return params.toString()
}

/**
 * Cleans up link parameters:
 * - Removes niche= if any OBJ_KEYS are present
 * - Handles theme= specially (if not light|dark, moves it to topic=)
 */
function cleanLink(params: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!params) return {}

  const cleaned = { ...params }

  // Handle theme: if it's not 'light' or 'dark', move it to topic
  if (cleaned.theme != null && cleaned.theme !== 'light' && cleaned.theme !== 'dark') {
    if (cleaned.topic == null) {
      cleaned.topic = cleaned.theme
    }
    delete cleaned.theme
  }

  // Remove niche if any OBJ_KEYS are present
  if (OBJ_KEYS.some((key) => cleaned[key] != null && cleaned[key] !== '')) {
    delete cleaned.niche
  }

  return cleaned
}

/**
 * Builds a query string from parameters, returning empty string if no params.
 */
function buildQuery(params: Record<string, unknown> | undefined): string {
  const queryString = qs(params)
  return queryString ? '?' + queryString : ''
}

export const link = {
  /**
   * Link to canais screen.
   */
  canais(p?: { niche?: NicheScope; channel?: string; add?: 1; filter?: 'problemas'; nicheEditor?: 1 }): string {
    const cleaned = cleanLink(p)
    const query = buildQuery(cleaned)
    return OBS_BASE + query
  },

  /**
   * Link to mudancas screen.
   */
  mudancas(p?: {
    niche?: NicheScope
    type?: string
    channel?: string
    video?: string
    changes?: string[]
    reading?: string
    win?: 7 | 30 | 90
    fmt?: Fmt | 'all'
    q?: string
  }): string {
    const cleaned = cleanLink(p)
    const query = buildQuery(cleaned)
    return OBS_BASE + '/mudancas' + query
  },

  /**
   * Link to outliers screen.
   * Per CONVENCOES "Links entre telas": the input parameter `ages` is emitted as query param `age=`.
   */
  outliers(p?: {
    niche?: NicheScope
    fmt?: Fmt
    ages?: string[] | 'all'
    min?: number
    topic?: string
    theme?: 'light' | 'dark'
    formula?: string
    channel?: string
    asof?: string
    reading?: string
  }): string {
    const cleaned = cleanLink(p)

    // Map ages input parameter to age query parameter
    if (cleaned.ages != null) {
      cleaned.age = cleaned.ages
      delete cleaned.ages
    }

    const query = buildQuery(cleaned)
    return OBS_BASE + '/outliers' + query
  },

  /**
   * Link to insights screen.
   */
  insights(p?: { niche?: NicheScope }): string {
    const cleaned = cleanLink(p)
    const query = buildQuery(cleaned)
    return OBS_BASE + '/insights' + query
  },

  /**
   * Link to video historico screen.
   */
  historico(
    videoId: string,
    p?: {
      from?: 'canais' | 'mudancas' | 'outliers' | 'insights'
      back?: string
      ids?: string[]
    },
  ): string {
    const cleaned = cleanLink(p)

    // Ignore back parameter if it doesn't start with '?'
    if (cleaned.back != null && typeof cleaned.back === 'string' && !cleaned.back.startsWith('?')) {
      delete cleaned.back
    }

    const query = buildQuery(cleaned)
    return OBS_BASE + '/video/' + encodeURIComponent(videoId) + query
  },
}
