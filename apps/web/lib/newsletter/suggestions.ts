/**
 * Newsletter cross-promotion: locale filtering, relevance scoring, and cached suggestion query.
 */

// ── Types ───────────────────────���──────────────────────────────��─────────────

export interface SuggestionCandidate {
  id: string
  slug: string
  name: string
  tagline: string | null
  cadence_label: string | null
  cadence_days: number
  cadence_start_date: string | null
  color: string
  color_dark: string | null
  locale: 'en' | 'pt-BR'
  created_at: string
  subscriber_count: number
  last_sent_at: string | null
}

export interface ScoredSuggestion extends SuggestionCandidate {
  score: number
}

// ── Locale filter ──────────────────��─────────────────────────────────────────

/**
 * PT-BR visitors see both PT-BR and EN newsletters.
 * EN visitors see only EN newsletters.
 */
export function filterByLocale(
  types: SuggestionCandidate[],
  visitorLocale: string,
): SuggestionCandidate[] {
  if (visitorLocale === 'pt-BR') {
    return types.filter((t) => t.locale === 'pt-BR' || t.locale === 'en')
  }
  return types.filter((t) => t.locale === visitorLocale)
}

// ── Relevance scoring ───��─────────────────��──────────────────────────────────

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

/**
 * Computes a relevance score for a newsletter suggestion candidate.
 *
 * Score = (normalized_subscriber_count * 0.6)
 *       + (recency_bonus * 0.3)
 *       + (newness_bonus * 0.1)
 *
 * @param candidate  The newsletter type to score
 * @param maxSubscriberCount  The maximum subscriber count across all candidates (for normalization)
 * @param now  Current timestamp in ms (injectable for testing)
 */
export function computeSuggestionScore(
  candidate: SuggestionCandidate,
  maxSubscriberCount: number,
  now: number = Date.now(),
): number {
  // Normalized subscriber count (0-1)
  const normalizedSubs =
    maxSubscriberCount > 0
      ? candidate.subscriber_count / maxSubscriberCount
      : 0

  // Recency bonus based on last edition sent
  let recencyBonus = 0
  if (candidate.last_sent_at) {
    const daysSinceSent = now - new Date(candidate.last_sent_at).getTime()
    if (daysSinceSent <= FOURTEEN_DAYS_MS) recencyBonus = 1.0
    else if (daysSinceSent <= THIRTY_DAYS_MS) recencyBonus = 0.7
    else if (daysSinceSent <= NINETY_DAYS_MS) recencyBonus = 0.3
  }

  // Newness bonus based on newsletter type creation date
  let newnessBonus = 0
  const daysSinceCreated = now - new Date(candidate.created_at).getTime()
  if (daysSinceCreated <= THIRTY_DAYS_MS) newnessBonus = 1.0
  else if (daysSinceCreated <= SIXTY_DAYS_MS) newnessBonus = 0.5

  return normalizedSubs * 0.6 + recencyBonus * 0.3 + newnessBonus * 0.1
}

/**
 * Scores and sorts candidates by relevance, returning the top N.
 */
export function rankSuggestions(
  candidates: SuggestionCandidate[],
  limit: number = 3,
  now: number = Date.now(),
): ScoredSuggestion[] {
  if (candidates.length === 0) return []

  const maxSubs = Math.max(...candidates.map((c) => c.subscriber_count))

  return candidates
    .map((c) => ({
      ...c,
      score: computeSuggestionScore(c, maxSubs, now),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
