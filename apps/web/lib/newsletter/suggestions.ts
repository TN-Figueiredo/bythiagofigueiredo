/**
 * Newsletter cross-promotion: locale filtering, relevance scoring, and cached suggestion query.
 */

import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Allowed locales for filter ───────────────────────────────────────────────

function getAllowedLocales(visitorLocale: string): string[] {
  if (visitorLocale === 'pt-BR') return ['pt-BR', 'en']
  return [visitorLocale]
}

// ── Cached suggestion fetcher ────────────────────────────────────────────────

export const getNewsletterSuggestions = unstable_cache(
  async (
    currentSlug: string,
    locale: string,
  ): Promise<ScoredSuggestion[]> => {
    const supabase = getSupabaseServiceClient()
    const allowedLocales = getAllowedLocales(locale)

    // Fetch all active types except the current one, filtered by locale
    const { data: types } = await supabase
      .from('newsletter_types')
      .select('id, slug, name, tagline, cadence_label, cadence_days, cadence_start_date, color, color_dark, locale, created_at')
      .eq('active', true)
      .neq('slug', currentSlug)
      .in('locale', allowedLocales)

    if (!types || types.length === 0) return []

    const typeIds = types.map((t) => t.id as string)

    // Fetch subscriber counts (confirmed only) and last sent edition in parallel
    const [subCountsResult, editionsResult] = await Promise.all([
      supabase
        .from('newsletter_subscriptions')
        .select('newsletter_id')
        .in('newsletter_id', typeIds)
        .eq('status', 'confirmed'),
      supabase
        .from('newsletter_editions')
        .select('newsletter_type_id, sent_at')
        .in('newsletter_type_id', typeIds)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false }),
    ])

    // Count subscribers per type
    const subCounts = new Map<string, number>()
    for (const row of subCountsResult.data ?? []) {
      const id = row.newsletter_id as string
      subCounts.set(id, (subCounts.get(id) ?? 0) + 1)
    }

    // Get latest sent_at per type
    const lastSentMap = new Map<string, string>()
    for (const row of editionsResult.data ?? []) {
      const tid = row.newsletter_type_id as string
      if (!lastSentMap.has(tid)) {
        lastSentMap.set(tid, row.sent_at as string)
      }
    }

    // Build candidates
    const candidates: SuggestionCandidate[] = types.map((t) => ({
      id: t.id as string,
      slug: t.slug as string,
      name: t.name as string,
      tagline: (t.tagline as string | null) ?? null,
      cadence_label: (t.cadence_label as string | null) ?? null,
      cadence_days: (t.cadence_days as number) ?? 0,
      cadence_start_date: (t.cadence_start_date as string | null) ?? null,
      color: (t.color as string) ?? '#C14513',
      color_dark: (t.color_dark as string | null) ?? null,
      locale: t.locale as 'en' | 'pt-BR',
      created_at: t.created_at as string,
      subscriber_count: subCounts.get(t.id as string) ?? 0,
      last_sent_at: lastSentMap.get(t.id as string) ?? null,
    }))

    return rankSuggestions(candidates, 3)
  },
  ['newsletter-suggestions'],
  { tags: ['newsletter-suggestions'], revalidate: 3600 },
)

// ── Post-subscribe filtering ─────────────────────────────────────────────────

/**
 * Fetches suggestions excluding types the subscriber is already subscribed to.
 * Called client-side via server action after successful subscribe.
 */
export async function getFilteredSuggestionsForSubscriber(
  currentSlug: string,
  locale: string,
  subscriberEmail: string,
): Promise<ScoredSuggestion[]> {
  const supabase = getSupabaseServiceClient()

  // Get all suggestions first
  const suggestions = await getNewsletterSuggestions(currentSlug, locale)

  if (suggestions.length === 0) return []

  // Query subscriber's existing subscriptions
  const { data: existingSubs } = await supabase
    .from('newsletter_subscriptions')
    .select('newsletter_id')
    .eq('email', subscriberEmail)
    .in('status', ['confirmed', 'pending_confirmation'])

  const subscribedIds = new Set(
    (existingSubs ?? []).map((s) => s.newsletter_id as string),
  )

  return suggestions.filter((s) => !subscribedIds.has(s.id))
}
