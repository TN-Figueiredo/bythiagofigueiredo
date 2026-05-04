# Newsletter Cross-Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add locale-aware newsletter suggestions to individual landing pages in two positions: discovery (after author section) and upsell (after subscribe success).

**Architecture:** New `newsletter-suggestions.tsx` component with shared mini card design. Server-side suggestion fetching with hybrid relevance scoring (subscriber count 60% + recency 30% + newness 10%). `unstable_cache` with 1-hour TTL. Position A rendered in `page.tsx`, Position C in `subscribe-form.tsx`.

**Tech Stack:** React 19, Next.js 15 server components + client components, Supabase, unstable_cache, Vitest

---

## File Structure

### New Files

| File | Purpose |
|---|---|
| `apps/web/lib/newsletter/suggestions.ts` | Pure scoring functions + cached suggestion query |
| `apps/web/src/app/(public)/newsletters/[slug]/newsletter-suggestions.tsx` | Shared mini card component (Position A server, Position C client) |
| `apps/web/test/unit/newsletter/suggestions.test.ts` | Unit tests for scoring, locale filter, suggestion logic |
| `apps/web/test/unit/newsletter/upsell-section.test.tsx` | Component tests for UpsellSection (render, add, subscribed-to-all, empty) |

### Modified Files

| File | Change |
|---|---|
| `apps/web/src/app/(public)/newsletters/[slug]/page.tsx` | Import suggestions, render Position A after author section |
| `apps/web/src/app/(public)/newsletters/[slug]/subscribe-form.tsx` | Add Position C upsell section after success/pending states |
| `apps/web/src/app/(public)/newsletters/[slug]/newsletter-landing.css` | Styles for mini cards, suggestion sections, responsive grid |
| `apps/web/lib/newsletter/cache-invalidation.ts` | Add `revalidateNewsletterSuggestions()` |
| `apps/web/src/app/api/webhooks/ses/route.ts` | Call `revalidateTag('newsletter-suggestions')` on subscriber confirmation |
| `apps/web/src/app/api/cron/send-scheduled-newsletters/route.ts` | Call `revalidateTag('newsletter-suggestions')` after successful send |
| `apps/web/src/app/cms/(authed)/newsletters/actions.ts` | Call `revalidateTag('newsletter-suggestions')` in type create/update/delete |
| `apps/web/src/locales/en.json` | Add 7 new i18n keys |
| `apps/web/src/locales/pt-BR.json` | Add 7 new i18n keys |

---

### Task 1: Relevance Scoring Pure Functions + Tests

**Files:**
- Create: `apps/web/lib/newsletter/suggestions.ts`
- Create: `apps/web/test/unit/newsletter/suggestions.test.ts`

- [ ] **Step 1: Write the scoring functions**

Create `apps/web/lib/newsletter/suggestions.ts` with pure functions only (no DB, no cache). The cached query will be added in Task 3.

```typescript
// apps/web/lib/newsletter/suggestions.ts

/**
 * Newsletter cross-promotion: locale filtering, relevance scoring, and cached suggestion query.
 */

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

// ── Locale filter ────────────────────────────────────────────────────────────

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

// ── Relevance scoring ────────────────────────────────────────────────────────

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
```

- [ ] **Step 2: Write unit tests for scoring functions**

Create `apps/web/test/unit/newsletter/suggestions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  filterByLocale,
  computeSuggestionScore,
  rankSuggestions,
  type SuggestionCandidate,
} from '@/lib/newsletter/suggestions'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<SuggestionCandidate> = {}): SuggestionCandidate {
  return {
    id: 'type-1',
    slug: 'test-newsletter',
    name: 'Test Newsletter',
    tagline: 'A test tagline',
    cadence_label: 'Weekly',
    cadence_days: 7,
    cadence_start_date: null,
    color: '#C14513',
    color_dark: null,
    locale: 'en',
    created_at: '2025-01-01T00:00:00Z',
    subscriber_count: 100,
    last_sent_at: null,
    ...overrides,
  }
}

const NOW = new Date('2026-05-03T12:00:00Z').getTime()

// ── filterByLocale ───────────────────────────────────────────────────────────

describe('filterByLocale', () => {
  const enType = makeCandidate({ id: 'en-1', locale: 'en' })
  const ptType = makeCandidate({ id: 'pt-1', locale: 'pt-BR' })
  const all = [enType, ptType]

  it('EN visitor sees only EN newsletters', () => {
    const result = filterByLocale(all, 'en')
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('en-1')
  })

  it('PT-BR visitor sees both PT-BR and EN newsletters', () => {
    const result = filterByLocale(all, 'pt-BR')
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id).sort()).toEqual(['en-1', 'pt-1'])
  })

  it('unknown locale sees nothing', () => {
    const result = filterByLocale(all, 'fr')
    expect(result).toHaveLength(0)
  })

  it('empty input returns empty', () => {
    expect(filterByLocale([], 'en')).toHaveLength(0)
  })
})

// ── computeSuggestionScore ───────────────────────────────────────────────────

describe('computeSuggestionScore', () => {
  it('returns 0 for candidate with 0 subs, no editions, old creation', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: null,
      created_at: '2024-01-01T00:00:00Z',
    })
    expect(computeSuggestionScore(candidate, 100, NOW)).toBe(0)
  })

  it('gives full subscriber weight when candidate is the max', () => {
    const candidate = makeCandidate({
      subscriber_count: 100,
      last_sent_at: null,
      created_at: '2024-01-01T00:00:00Z',
    })
    // normalizedSubs = 100/100 = 1, recency = 0, newness = 0
    // score = 1 * 0.6 + 0 + 0 = 0.6
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.6)
  })

  it('gives full recency bonus for edition sent within 14 days', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: '2024-01-01T00:00:00Z',
    })
    // normalizedSubs = 0, recency = 1.0, newness = 0
    // score = 0 + 1.0 * 0.3 + 0 = 0.3
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.3)
  })

  it('gives 0.7 recency bonus for edition sent 15-30 days ago', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: new Date(NOW - 20 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: '2024-01-01T00:00:00Z',
    })
    // score = 0 + 0.7 * 0.3 + 0 = 0.21
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.21)
  })

  it('gives 0.3 recency bonus for edition sent 31-90 days ago', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: new Date(NOW - 60 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: '2024-01-01T00:00:00Z',
    })
    // score = 0 + 0.3 * 0.3 + 0 = 0.09
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.09)
  })

  it('gives 0 recency for edition sent > 90 days ago', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: new Date(NOW - 100 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: '2024-01-01T00:00:00Z',
    })
    expect(computeSuggestionScore(candidate, 100, NOW)).toBe(0)
  })

  it('gives full newness bonus for type created within 30 days', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: null,
      created_at: new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString(),
    })
    // score = 0 + 0 + 1.0 * 0.1 = 0.1
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.1)
  })

  it('gives 0.5 newness bonus for type created 31-60 days ago', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: null,
      created_at: new Date(NOW - 45 * 24 * 60 * 60 * 1000).toISOString(),
    })
    // score = 0 + 0 + 0.5 * 0.1 = 0.05
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.05)
  })

  it('combines all three factors', () => {
    const candidate = makeCandidate({
      subscriber_count: 50,
      last_sent_at: new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString(),
    })
    // normalizedSubs = 50/100 = 0.5, recency = 1.0, newness = 1.0
    // score = 0.5*0.6 + 1.0*0.3 + 1.0*0.1 = 0.3 + 0.3 + 0.1 = 0.7
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.7)
  })

  it('handles maxSubscriberCount of 0 gracefully', () => {
    const candidate = makeCandidate({ subscriber_count: 0 })
    expect(computeSuggestionScore(candidate, 0, NOW)).toBeGreaterThanOrEqual(0)
  })
})

// ── rankSuggestions ──────────────────────────────────────────────────────────

describe('rankSuggestions', () => {
  it('returns empty array for empty candidates', () => {
    expect(rankSuggestions([], 3, NOW)).toEqual([])
  })

  it('sorts by score descending', () => {
    const high = makeCandidate({
      id: 'high',
      subscriber_count: 100,
      last_sent_at: new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const low = makeCandidate({
      id: 'low',
      subscriber_count: 10,
      last_sent_at: null,
      created_at: '2024-01-01T00:00:00Z',
    })
    const result = rankSuggestions([low, high], 3, NOW)
    expect(result[0]!.id).toBe('high')
    expect(result[1]!.id).toBe('low')
  })

  it('respects limit', () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      makeCandidate({ id: `type-${i}`, subscriber_count: i * 10 }),
    )
    expect(rankSuggestions(candidates, 2, NOW)).toHaveLength(2)
  })

  it('returns all when fewer than limit', () => {
    const candidates = [makeCandidate({ id: 'only' })]
    expect(rankSuggestions(candidates, 3, NOW)).toHaveLength(1)
  })

  it('includes score property on returned items', () => {
    const result = rankSuggestions([makeCandidate()], 3, NOW)
    expect(result[0]).toHaveProperty('score')
    expect(typeof result[0]!.score).toBe('number')
  })

  it('handles candidate with 0 subscribers and 0 editions (still shown)', () => {
    const lonely = makeCandidate({
      subscriber_count: 0,
      last_sent_at: null,
      created_at: '2024-01-01T00:00:00Z',
    })
    const result = rankSuggestions([lonely], 3, NOW)
    expect(result).toHaveLength(1)
    expect(result[0]!.score).toBe(0)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run test/unit/newsletter/suggestions.test.ts
```

- [ ] **Step 4: Commit**

```
feat(newsletter): add cross-promotion relevance scoring functions with tests
```

---

### Task 2: Cached Suggestions Query

**Files:**
- Modify: `apps/web/lib/newsletter/suggestions.ts`

- [ ] **Step 1: Add the `getNewsletterSuggestions` cached query**

Append to `apps/web/lib/newsletter/suggestions.ts`:

```typescript
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

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
```

Note: The imports (`unstable_cache`, `getSupabaseServiceClient`) need to be added to the top of the file. The final file will have all imports at the top. The `deriveCadenceLabel` import is NOT needed here — it is only used by the component in Task 4.

- [ ] **Step 2: Run tests (existing tests should still pass)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run test/unit/newsletter/suggestions.test.ts
```

- [ ] **Step 3: Commit**

```
feat(newsletter): add cached suggestion query with subscriber-aware filtering
```

---

### Task 3: i18n Strings

**Files:**
- Modify: `apps/web/src/locales/en.json`
- Modify: `apps/web/src/locales/pt-BR.json`

- [ ] **Step 1: Add EN strings**

Add the following 7 keys to `apps/web/src/locales/en.json`, after `"newsletter.landing.allNewsletters"`:

```json
  "newsletter.landing.moreNewsletters": "More newsletters",
  "newsletter.landing.anotherNewsletter": "Another newsletter",
  "newsletter.landing.youMightAlsoLike": "You might also like",
  "newsletter.landing.addNewsletter": "+ add",
  "newsletter.landing.addedNewsletter": "added",
  "newsletter.landing.subscribedToAll": "You're subscribed to everything!",
  "newsletter.landing.upsellTitle": "You might also like...",
```

- [ ] **Step 2: Add PT-BR strings**

Add the following 7 keys to `apps/web/src/locales/pt-BR.json`, after `"newsletter.landing.allNewsletters"`:

```json
  "newsletter.landing.moreNewsletters": "Mais newsletters",
  "newsletter.landing.anotherNewsletter": "Outra newsletter",
  "newsletter.landing.youMightAlsoLike": "Talvez te interesse",
  "newsletter.landing.addNewsletter": "+ adicionar",
  "newsletter.landing.addedNewsletter": "adicionado",
  "newsletter.landing.subscribedToAll": "Você já assina tudo!",
  "newsletter.landing.upsellTitle": "Talvez te interesse...",
```

- [ ] **Step 3: Run i18n test to verify JSON validity**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run test/unit/newsletter/landing-i18n.test.ts
```

- [ ] **Step 4: Commit**

```
feat(newsletter): add cross-promotion i18n strings (EN + PT-BR)
```

---

### Task 4: Mini Card Component

**Files:**
- Create: `apps/web/src/app/(public)/newsletters/[slug]/newsletter-suggestions.tsx`

- [ ] **Step 1: Create the shared mini card and suggestion section components**

```tsx
// apps/web/src/app/(public)/newsletters/[slug]/newsletter-suggestions.tsx

import Link from 'next/link'
import type { ScoredSuggestion } from '@/lib/newsletter/suggestions'
import { deriveCadenceLabel } from '@/lib/newsletter/format'
import { formatSubscriberCount } from '@/lib/newsletter/format'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SuggestionStrings {
  moreNewsletters: string
  anotherNewsletter: string
  youMightAlsoLike: string
  addNewsletter: string
  addedNewsletter: string
  subscribedToAll: string
  upsellTitle: string
  allNewsletters: string
}

// ── Mini Card (shared) ───────────────────────────────────────────────────────

interface MiniCardProps {
  suggestion: ScoredSuggestion
  locale: 'en' | 'pt-BR'
}

export function SuggestionMiniCard({ suggestion, locale }: MiniCardProps) {
  const cadence = deriveCadenceLabel(
    suggestion.cadence_label,
    suggestion.cadence_days,
    locale,
    suggestion.cadence_start_date,
  )
  const subCount = formatSubscriberCount(suggestion.subscriber_count)

  return (
    <Link
      href={`/newsletters/${suggestion.slug}`}
      className="nl-suggestion-card"
      style={{
        '--card-accent': suggestion.color,
      } as React.CSSProperties}
    >
      <div className="nl-suggestion-card-accent" />
      <div className="nl-suggestion-card-body">
        <div className="nl-suggestion-card-name">
          {suggestion.name}
        </div>
        {suggestion.tagline && (
          <div className="nl-suggestion-card-tagline">
            {suggestion.tagline}
          </div>
        )}
        <div className="nl-suggestion-card-meta">
          {cadence && (
            <span className="nl-suggestion-card-cadence">
              {cadence}
            </span>
          )}
          {subCount && (
            <span className="nl-suggestion-card-subs">
              &#9673; {subCount} {locale === 'pt-BR' ? 'assinantes' : 'subscribers'}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Position A: Discovery Section (server component) ─────────────────────────

interface DiscoverySectionProps {
  suggestions: ScoredSuggestion[]
  locale: 'en' | 'pt-BR'
  strings: SuggestionStrings
}

export function NewsletterDiscoverySection({
  suggestions,
  locale,
  strings,
}: DiscoverySectionProps) {
  if (suggestions.length === 0) return null

  const title =
    suggestions.length === 1
      ? strings.anotherNewsletter
      : strings.moreNewsletters

  return (
    <section
      className="nl-section"
      style={{ marginBottom: 72 }}
      aria-labelledby="section-suggestions"
    >
      <h2
        id="section-suggestions"
        style={{
          fontFamily: 'var(--font-fraunces-var), serif',
          fontSize: 28,
          fontWeight: 600,
          color: 'var(--pb-ink)',
          marginBottom: 6,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          color: 'var(--pb-muted)',
          marginBottom: 24,
        }}
      >
        {strings.youMightAlsoLike}
      </p>

      <div className="nl-suggestion-grid">
        {suggestions.map((s) => (
          <SuggestionMiniCard key={s.id} suggestion={s} locale={locale} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```
feat(newsletter): add suggestion mini card and discovery section components
```

---

### Task 5: CSS Styles for Mini Cards

**Files:**
- Modify: `apps/web/src/app/(public)/newsletters/[slug]/newsletter-landing.css`

- [ ] **Step 1: Add suggestion card and grid styles**

Append to `newsletter-landing.css`:

```css
/* ── Suggestion grid ─────────────────────── */

.nl-suggestion-grid {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.nl-suggestion-grid > * {
  flex: 1 1 240px;
  max-width: 320px;
}

@media (max-width: 720px) {
  .nl-suggestion-grid > * {
    flex: 1 1 200px;
  }
}

@media (max-width: 480px) {
  .nl-suggestion-grid {
    flex-direction: column;
  }
  .nl-suggestion-grid > * {
    max-width: 100%;
  }
}

/* ── Suggestion mini card ────────────────── */

.nl-suggestion-card {
  display: flex;
  text-decoration: none;
  border: 1px solid var(--pb-line);
  border-radius: 6px;
  overflow: hidden;
  background: var(--pb-paper, var(--pb-bg));
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.nl-suggestion-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.nl-suggestion-card-accent {
  width: 3px;
  flex-shrink: 0;
  background: var(--card-accent, var(--nl-accent));
}

.nl-suggestion-card-body {
  padding: 12px 14px;
  min-width: 0;
  flex: 1;
}

.nl-suggestion-card-name {
  font-family: var(--font-fraunces-var), serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--card-accent, var(--nl-accent));
  margin-bottom: 4px;
  line-height: 1.2;
}

.nl-suggestion-card-tagline {
  font-family: Inter, sans-serif;
  font-size: 13px;
  color: var(--pb-muted);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 8px;
}

.nl-suggestion-card-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.nl-suggestion-card-cadence {
  font-family: var(--font-jetbrains-var), monospace;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--pb-faint);
}

.nl-suggestion-card-subs {
  font-family: var(--font-jetbrains-var), monospace;
  font-size: 10px;
  color: var(--pb-faint);
}

/* ── Upsell section (Position C) ─────────── */

.nl-upsell-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px dashed var(--pb-line);
  animation: fadeIn 0.3s ease;
}

.nl-upsell-title {
  font-family: var(--font-fraunces-var), serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--pb-ink);
  margin: 0 0 12px;
}

/* ── Upsell add button ───────────────────── */

.nl-upsell-card {
  display: flex;
  align-items: center;
  border: 1px solid var(--pb-line);
  border-radius: 6px;
  overflow: hidden;
  background: var(--pb-paper, var(--pb-bg));
  margin-bottom: 10px;
}

.nl-upsell-card-accent {
  width: 3px;
  flex-shrink: 0;
  background: var(--card-accent, var(--nl-accent));
  align-self: stretch;
}

.nl-upsell-card-body {
  padding: 10px 12px;
  flex: 1;
  min-width: 0;
}

.nl-upsell-card-name {
  font-family: var(--font-fraunces-var), serif;
  font-size: 15px;
  font-weight: 600;
  color: var(--card-accent, var(--nl-accent));
  line-height: 1.2;
}

.nl-upsell-card-tagline {
  font-family: Inter, sans-serif;
  font-size: 12px;
  color: var(--pb-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nl-add-btn {
  flex-shrink: 0;
  padding: 6px 14px;
  margin-right: 12px;
  border: 1px dashed var(--pb-line);
  border-radius: 4px;
  background: transparent;
  font-family: var(--font-jetbrains-var), monospace;
  font-size: 12px;
  color: var(--pb-muted);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.nl-add-btn:hover:not(:disabled) {
  border-color: var(--card-accent, var(--nl-accent));
  color: var(--card-accent, var(--nl-accent));
}

.nl-add-btn:disabled {
  border-style: solid;
  background: var(--card-accent, var(--nl-accent));
  border-color: var(--card-accent, var(--nl-accent));
  color: #fff;
  cursor: default;
}

.nl-add-btn-loading {
  opacity: 0.6;
}

/* ── Subscribed to all message ───────────── */

.nl-subscribed-all {
  font-family: var(--font-jetbrains-var), monospace;
  font-size: 13px;
  color: var(--pb-muted);
  text-align: center;
  padding: 12px 0;
}

.nl-subscribed-all a {
  color: var(--nl-accent);
  text-decoration: none;
}
```

- [ ] **Step 2: Commit**

```
feat(newsletter): add CSS styles for suggestion cards and upsell section
```

---

### Task 6: Position A — Discovery Section in page.tsx

**Files:**
- Modify: `apps/web/src/app/(public)/newsletters/[slug]/page.tsx`

- [ ] **Step 1: Import suggestions and render Position A**

Add import at top of `page.tsx`:

```typescript
import { getNewsletterSuggestions } from '@/lib/newsletter/suggestions'
import { NewsletterDiscoverySection } from './newsletter-suggestions'
import type { SuggestionStrings } from './newsletter-suggestions'
```

In the `Promise.all` call inside the page component (around line 104), add `getNewsletterSuggestions`:

```typescript
    const [stats, recentEditions, activeCount, config, suggestions] = await Promise.all([
      getNewsletterStats(type.id, siteId),
      getRecentEditions(type.id, siteId, 3),
      getActiveTypeCount(siteId),
      getSiteSeoConfig(siteId, host).catch(() => null),
      getNewsletterSuggestions(slug, locale),
    ])
```

Build the suggestion strings object after `formStrings`:

```typescript
    const suggestionStrings: SuggestionStrings = {
      moreNewsletters: t('newsletter.landing.moreNewsletters'),
      anotherNewsletter: t('newsletter.landing.anotherNewsletter'),
      youMightAlsoLike: t('newsletter.landing.youMightAlsoLike'),
      addNewsletter: t('newsletter.landing.addNewsletter'),
      addedNewsletter: t('newsletter.landing.addedNewsletter'),
      subscribedToAll: t('newsletter.landing.subscribedToAll'),
      upsellTitle: t('newsletter.landing.upsellTitle'),
      allNewsletters: t('newsletter.landing.allNewsletters'),
    }
```

Insert the discovery section JSX between the author section closing `</section>` and the FAQ section opening `{faqItems && faqItems.length > 0 && (`:

```tsx
          {/* ── Suggestions section (Position A) ─────────────────────── */}
          <NewsletterDiscoverySection
            suggestions={suggestions}
            locale={locale}
            strings={suggestionStrings}
          />
```

Also pass `suggestionStrings` and `suggestions` to `SubscribeForm` (for Position C, wired in Task 7). Add these to the SubscribeForm props:

```tsx
                  <SubscribeForm
                    newsletterId={type.id}
                    locale={locale}
                    accentColor={accentLight}
                    newsletterName={type.name}
                    strings={formStrings}
                    privacyHref={privacyHref}
                    onSubscribe={subscribeToNewsletters}
                    suggestions={suggestions}
                    suggestionStrings={suggestionStrings}
                  />
```

- [ ] **Step 2: Verify page renders without errors**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --run test/unit/newsletter/landing-i18n.test.ts
```

- [ ] **Step 3: Commit**

```
feat(newsletter): add Position A discovery section after author section
```

---

### Task 7: Position C — Upsell in subscribe-form.tsx

**Files:**
- Modify: `apps/web/src/app/(public)/newsletters/[slug]/subscribe-form.tsx`

- [ ] **Step 1: Add Position C upsell types and props**

Add imports at top of `subscribe-form.tsx`:

```typescript
import Link from 'next/link'
import type { ScoredSuggestion } from '@/lib/newsletter/suggestions'
import type { SuggestionStrings } from './newsletter-suggestions'
import { deriveCadenceLabel } from '@/lib/newsletter/format'
```

Extend `SubscribeFormProps` interface to include suggestion data:

```typescript
export interface SubscribeFormProps {
  newsletterId: string
  locale: 'en' | 'pt-BR'
  accentColor: string
  newsletterName: string
  strings: SubscribeFormStrings
  privacyHref: string
  turnstileSiteKey?: string
  onSubscribe: (
    email: string,
    ids: string[],
    locale: 'en' | 'pt-BR',
    token?: string,
  ) => Promise<{ success?: boolean; error?: string; subscribedIds?: string[] }>
  suggestions?: ScoredSuggestion[]
  suggestionStrings?: SuggestionStrings
}
```

Update the component signature to destructure the new props:

```typescript
export function SubscribeForm({
  newsletterId,
  locale,
  accentColor,
  newsletterName,
  strings,
  privacyHref,
  onSubscribe,
  suggestions,
  suggestionStrings,
}: SubscribeFormProps) {
```

Add state for tracking added suggestions:

```typescript
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [addingId, setAddingId] = useState<string | null>(null)
```

Add handler for the "+ add" action:

```typescript
  async function handleAddSuggestion(typeId: string) {
    if (!email || addedIds.has(typeId) || addingId) return
    setAddingId(typeId)
    try {
      const result = await onSubscribe(email, [typeId], locale)
      if (result.success || result.subscribedIds?.includes(typeId)) {
        setAddedIds((prev) => new Set([...prev, typeId]))
      }
    } catch {
      // silently ignore — user already subscribed to primary
    } finally {
      setAddingId(null)
    }
  }
```

- [ ] **Step 2: Add the UpsellSection inline component**

Add inside `subscribe-form.tsx`, just before the final export or after the `StepCircle` component:

```tsx
// ── Internal: upsell section after subscribe success ─────────────────────────

interface UpsellSectionProps {
  suggestions: ScoredSuggestion[]
  suggestionStrings: SuggestionStrings
  locale: 'en' | 'pt-BR'
  addedIds: Set<string>
  addingId: string | null
  onAdd: (typeId: string) => void
}

function UpsellSection({
  suggestions,
  suggestionStrings,
  locale,
  addedIds,
  addingId,
  onAdd,
}: UpsellSectionProps) {
  const available = suggestions.filter((s) => !addedIds.has(s.id))

  if (suggestions.length === 0) return null

  // All suggestions have been added
  if (available.length === 0) {
    return (
      <div className="nl-upsell-section">
        <p className="nl-subscribed-all">
          {suggestionStrings.subscribedToAll}{' '}
          <Link href={`/newsletters`}>
            {suggestionStrings.allNewsletters}
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="nl-upsell-section">
      <h3 className="nl-upsell-title">{suggestionStrings.upsellTitle}</h3>
      {available.map((s) => {
        const isAdding = addingId === s.id
        const isAdded = addedIds.has(s.id)
        return (
          <div
            key={s.id}
            className="nl-upsell-card"
            style={{ '--card-accent': s.color } as React.CSSProperties}
          >
            <div className="nl-upsell-card-accent" />
            <div className="nl-upsell-card-body">
              <div className="nl-upsell-card-name">{s.name}</div>
              {s.tagline && (
                <div className="nl-upsell-card-tagline">{s.tagline}</div>
              )}
            </div>
            <button
              type="button"
              className={`nl-add-btn ${isAdding ? 'nl-add-btn-loading' : ''}`}
              disabled={isAdded || isAdding}
              onClick={() => onAdd(s.id)}
            >
              {isAdded
                ? suggestionStrings.addedNewsletter
                : isAdding
                  ? '...'
                  : suggestionStrings.addNewsletter}
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Render UpsellSection in pending and confirmed phases**

In the **pending phase** (`if (phase === 'pending')` block), add the `<UpsellSection>` just before the closing `</div>` of the outer container (inside `aria-live="polite"` div, after the actions div):

```tsx
          {suggestions && suggestions.length > 0 && suggestionStrings && (
            <UpsellSection
              suggestions={suggestions}
              suggestionStrings={suggestionStrings}
              locale={locale}
              addedIds={addedIds}
              addingId={addingId}
              onAdd={handleAddSuggestion}
            />
          )}
```

In the **confirmed phase** (`if (phase === 'confirmed')` block), add the same `<UpsellSection>` after the "Subscribe another email" button:

```tsx
          {suggestions && suggestions.length > 0 && suggestionStrings && (
            <UpsellSection
              suggestions={suggestions}
              suggestionStrings={suggestionStrings}
              locale={locale}
              addedIds={addedIds}
              addingId={addingId}
              onAdd={handleAddSuggestion}
            />
          )}
```

- [ ] **Step 4: Commit**

```
feat(newsletter): add Position C upsell section in subscribe form after success
```

---

### Task 8: Cache Invalidation Wiring

**Files:**
- Modify: `apps/web/lib/newsletter/cache-invalidation.ts`
- Modify: `apps/web/src/app/api/webhooks/ses/route.ts`
- Modify: `apps/web/src/app/api/cron/send-scheduled-newsletters/route.ts`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`

- [ ] **Step 1: Add `revalidateNewsletterSuggestions` to cache-invalidation.ts**

```typescript
// Add to apps/web/lib/newsletter/cache-invalidation.ts

export function revalidateNewsletterSuggestions(): void {
  revalidateTag('newsletter-suggestions')
}
```

Also update `revalidateNewsletterType` to include suggestion invalidation:

```typescript
export function revalidateNewsletterType(
  siteId: string,
  slug: string,
): void {
  revalidateTag(`newsletter:type:${slug}`)
  revalidateTag(`og:newsletter:${slug}`)
  revalidateTag(`sitemap:${siteId}`)
  revalidateTag('newsletter:types:count')
  revalidateTag('newsletter-suggestions')
  revalidatePath(`/newsletters/${slug}`)
  revalidatePath('/newsletters')
}
```

- [ ] **Step 2: Add tag invalidation to webhook handler**

In `apps/web/src/app/api/webhooks/ses/route.ts`, import `revalidateTag` and call it when a subscriber is confirmed. Find the section that processes `Delivery` or subscriber confirmation events and add:

```typescript
import { revalidateTag } from 'next/cache'

// After successful subscriber confirmation processing:
revalidateTag('newsletter-suggestions')
```

Note: The exact location depends on the webhook handler structure. Look for where subscriber status changes to `confirmed` and add the revalidation there.

- [ ] **Step 3: Add tag invalidation to send cron**

In `apps/web/src/app/api/cron/send-scheduled-newsletters/route.ts`, import and call after successful edition sends:

```typescript
import { revalidateTag } from 'next/cache'

// After the for loop that sends editions (around line 50, after totalSent is computed):
if (totalSent > 0) {
  revalidateTag('newsletter-suggestions')
}
```

- [ ] **Step 4: Add tag invalidation to CMS newsletter actions**

In `apps/web/src/app/cms/(authed)/newsletters/actions.ts`, find the newsletter type create/update/delete actions and add `revalidateTag('newsletter-suggestions')` calls. The existing `revalidateNewsletterType` function will now handle this since we updated it in Step 1, but verify:

- `createNewsletterType` action: already calls `revalidateNewsletterType` or equivalent -- verify and add `revalidateTag('newsletter-suggestions')` if not covered.
- `updateNewsletterType` action: same check.
- `deleteNewsletterType` action: same check.

- [ ] **Step 5: Commit**

```
feat(newsletter): wire cache invalidation for suggestions tag
```

---

### Task 9: Post-Subscribe Filtering Server Action

**Files:**
- Modify: `apps/web/src/app/(public)/actions/subscribe-newsletters.ts`

The `subscribeToNewsletters` action already returns `subscribedIds` which the form uses. The `getFilteredSuggestionsForSubscriber` function added in Task 2 handles filtering. However, the current subscribe form already knows the email and can filter client-side based on `addedIds` state. The suggestions passed as props are pre-filtered by locale and exclude the current type. The only additional filtering needed is for types the subscriber already has (before they arrived at this page).

- [ ] **Step 1: Create a server action to fetch filtered suggestions**

Add a new server action file or add to existing actions. Since the subscribe form is a client component and needs to call server-side filtering, create a lightweight wrapper:

Add to `apps/web/src/app/(public)/actions/subscribe-newsletters.ts` (this file already has `'use server'` at the top, so the new export automatically becomes a server action callable from client components):

```typescript
import { getFilteredSuggestionsForSubscriber } from '@/lib/newsletter/suggestions'
import type { ScoredSuggestion } from '@/lib/newsletter/suggestions'

export async function getPostSubscribeSuggestions(
  currentSlug: string,
  locale: 'en' | 'pt-BR',
  email: string,
): Promise<ScoredSuggestion[]> {
  try {
    return await getFilteredSuggestionsForSubscriber(currentSlug, locale, email)
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Update subscribe-form.tsx to use filtered suggestions**

In the `SubscribeForm` component, add a prop for the slug and the post-subscribe filter action. After successful subscription, call the filter to update the suggestions list:

Add to `SubscribeFormProps`:

```typescript
  currentSlug?: string
  onGetFilteredSuggestions?: (
    currentSlug: string,
    locale: 'en' | 'pt-BR',
    email: string,
  ) => Promise<ScoredSuggestion[]>
```

Add state for filtered suggestions:

```typescript
  const [filteredSuggestions, setFilteredSuggestions] = useState<ScoredSuggestion[] | null>(null)
```

In `handleSubmit`, after `setPhase('pending')`, fetch filtered suggestions:

```typescript
      if (result.success) {
        setPhase('pending')
        // Fetch suggestions filtered by subscriber's existing subscriptions
        if (suggestions && suggestions.length > 0 && onGetFilteredSuggestions && currentSlug) {
          onGetFilteredSuggestions(currentSlug, locale, email).then((filtered) => {
            setFilteredSuggestions(filtered)
          }).catch(() => {
            // Fall back to unfiltered suggestions
            setFilteredSuggestions(suggestions ?? [])
          })
        }
        requestAnimationFrame(() => {
          pendingHeadingRef.current?.focus()
        })
      }
```

Use `filteredSuggestions ?? suggestions` in the UpsellSection render:

```tsx
          {(filteredSuggestions ?? suggestions) && (filteredSuggestions ?? suggestions)!.length > 0 && suggestionStrings && (
            <UpsellSection
              suggestions={filteredSuggestions ?? suggestions ?? []}
              ...
            />
          )}
```

Pass the new props from `page.tsx`:

```tsx
                  <SubscribeForm
                    ...
                    currentSlug={slug}
                    onGetFilteredSuggestions={getPostSubscribeSuggestions}
                  />
```

And add the import in `page.tsx`:

```typescript
import { getPostSubscribeSuggestions } from '@/app/(public)/actions/subscribe-newsletters'
```

- [ ] **Step 3: Commit**

```
feat(newsletter): add post-subscribe suggestion filtering via server action
```

---

### Task 10: Edge Cases, UpsellSection Component Tests, Final Verification

**Files:**
- Modify: `apps/web/test/unit/newsletter/suggestions.test.ts`
- Create: `apps/web/test/unit/newsletter/upsell-section.test.tsx`

- [ ] **Step 1: Add edge case tests for scoring functions**

Append to `apps/web/test/unit/newsletter/suggestions.test.ts`:

```typescript
// ── Edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('filterByLocale: all types same locale as visitor returns all', () => {
    const types = [
      makeCandidate({ id: '1', locale: 'en' }),
      makeCandidate({ id: '2', locale: 'en' }),
    ]
    expect(filterByLocale(types, 'en')).toHaveLength(2)
  })

  it('filterByLocale: PT-BR visitor with only EN types gets them', () => {
    const types = [
      makeCandidate({ id: '1', locale: 'en' }),
    ]
    expect(filterByLocale(types, 'pt-BR')).toHaveLength(1)
  })

  it('rankSuggestions: single candidate with score 0 is still returned', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: null,
      created_at: '2024-01-01T00:00:00Z',
    })
    const result = rankSuggestions([candidate], 3, NOW)
    expect(result).toHaveLength(1)
    expect(result[0]!.score).toBe(0)
  })

  it('computeSuggestionScore: future created_at gives newness bonus', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: null,
      created_at: new Date(NOW + 1000).toISOString(),
    })
    // created_at is in the future, daysSinceCreated is negative => <= 30 days
    expect(computeSuggestionScore(candidate, 0, NOW)).toBeCloseTo(0.1)
  })

  it('rankSuggestions: tiebreaking is stable (deterministic order)', () => {
    const a = makeCandidate({ id: 'a', subscriber_count: 50 })
    const b = makeCandidate({ id: 'b', subscriber_count: 50 })
    const result1 = rankSuggestions([a, b], 3, NOW)
    const result2 = rankSuggestions([a, b], 3, NOW)
    expect(result1.map((r) => r.id)).toEqual(result2.map((r) => r.id))
  })
})
```

- [ ] **Step 2: Add UpsellSection component tests**

Create `apps/web/test/unit/newsletter/upsell-section.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ScoredSuggestion } from '@/lib/newsletter/suggestions'

// The UpsellSection is defined inside subscribe-form.tsx as an internal component.
// To test it in isolation, we test the SubscribeForm behavior in pending/confirmed phase
// with suggestions props. Import the SubscribeForm directly.
import { SubscribeForm, type SubscribeFormStrings } from '@/app/(public)/newsletters/[slug]/subscribe-form'
import type { SuggestionStrings } from '@/app/(public)/newsletters/[slug]/newsletter-suggestions'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSuggestion(overrides: Partial<ScoredSuggestion> = {}): ScoredSuggestion {
  return {
    id: 'type-1',
    slug: 'test-newsletter',
    name: 'Test Newsletter',
    tagline: 'A test tagline',
    cadence_label: 'Weekly',
    cadence_days: 7,
    cadence_start_date: null,
    color: '#C14513',
    color_dark: null,
    locale: 'en',
    created_at: '2025-01-01T00:00:00Z',
    subscriber_count: 100,
    last_sent_at: null,
    score: 0.6,
    ...overrides,
  }
}

const formStrings: SubscribeFormStrings = {
  stepLabel: 'Step {current}/{total}',
  formTitle: 'Subscribe',
  formSubtitle: 'Join the newsletter',
  emailLabel: 'Email',
  emailPlaceholder: 'your@email.com',
  consentPrefix: 'I agree to receive ',
  consentSuffix: ' emails. See our ',
  privacy: 'privacy policy',
  submit: 'Subscribe',
  submitting: 'Subscribing...',
  noSpam: 'No spam',
  noPitch: 'No pitch',
  oneClickLeave: 'One-click leave',
  pendingTitle: 'Check your inbox',
  pendingBody: 'We sent a confirmation to {email}',
  pendingStep1: 'Subscribe',
  pendingStep2: 'Confirm email',
  pendingStep3: 'Done!',
  pendingTip: 'Check spam if you don\'t see it',
  pendingResend: 'Resend email',
  pendingResent: 'Sent!',
  pendingChangeEmail: 'Change email',
  confirmedTitle: 'You\'re in!',
  confirmedBody: 'Welcome aboard',
  confirmedExclamation: 'Awesome!',
  successAgain: 'Subscribe another email',
  errorRateLimit: 'Too many attempts',
  errorAlreadySubscribed: 'Already subscribed',
  errorInvalid: 'Invalid email',
  errorServer: 'Server error',
}

const suggestionStrings: SuggestionStrings = {
  moreNewsletters: 'More newsletters',
  anotherNewsletter: 'Another newsletter',
  youMightAlsoLike: 'You might also like',
  addNewsletter: '+ add',
  addedNewsletter: 'added',
  subscribedToAll: "You're subscribed to everything!",
  upsellTitle: 'You might also like...',
  allNewsletters: 'All newsletters',
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UpsellSection (via SubscribeForm)', () => {
  it('renders suggestion cards in pending phase', async () => {
    const suggestions = [
      makeSuggestion({ id: 's1', name: 'Alpha Newsletter' }),
      makeSuggestion({ id: 's2', name: 'Beta Newsletter' }),
    ]

    const onSubscribe = vi.fn().mockResolvedValue({ success: true })

    render(
      <SubscribeForm
        newsletterId="primary"
        locale="en"
        accentColor="#C14513"
        newsletterName="Primary"
        strings={formStrings}
        privacyHref="/privacy"
        onSubscribe={onSubscribe}
        suggestions={suggestions}
        suggestionStrings={suggestionStrings}
      />,
    )

    // Fill form and submit to reach pending phase
    const emailInput = screen.getByLabelText(formStrings.emailLabel)
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    const submitButton = screen.getByRole('button', { name: formStrings.submit })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Alpha Newsletter')).toBeDefined()
      expect(screen.getByText('Beta Newsletter')).toBeDefined()
    })
  })

  it('shows "added" state after clicking + add', async () => {
    const suggestions = [
      makeSuggestion({ id: 's1', name: 'Alpha Newsletter' }),
    ]

    const onSubscribe = vi.fn()
      .mockResolvedValueOnce({ success: true }) // primary subscribe
      .mockResolvedValueOnce({ success: true, subscribedIds: ['s1'] }) // upsell add

    render(
      <SubscribeForm
        newsletterId="primary"
        locale="en"
        accentColor="#C14513"
        newsletterName="Primary"
        strings={formStrings}
        privacyHref="/privacy"
        onSubscribe={onSubscribe}
        suggestions={suggestions}
        suggestionStrings={suggestionStrings}
      />,
    )

    // Fill and submit
    fireEvent.change(screen.getByLabelText(formStrings.emailLabel), {
      target: { value: 'test@example.com' },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: formStrings.submit }))

    // Wait for pending phase with upsell
    await waitFor(() => {
      expect(screen.getByText('+ add')).toBeDefined()
    })

    // Click "+ add" button
    fireEvent.click(screen.getByText('+ add'))

    await waitFor(() => {
      expect(screen.getByText('added')).toBeDefined()
    })
  })

  it('shows "subscribed to everything" when all suggestions added', async () => {
    const suggestions = [
      makeSuggestion({ id: 's1', name: 'Only Newsletter' }),
    ]

    const onSubscribe = vi.fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true, subscribedIds: ['s1'] })

    render(
      <SubscribeForm
        newsletterId="primary"
        locale="en"
        accentColor="#C14513"
        newsletterName="Primary"
        strings={formStrings}
        privacyHref="/privacy"
        onSubscribe={onSubscribe}
        suggestions={suggestions}
        suggestionStrings={suggestionStrings}
      />,
    )

    fireEvent.change(screen.getByLabelText(formStrings.emailLabel), {
      target: { value: 'test@example.com' },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: formStrings.submit }))

    await waitFor(() => {
      expect(screen.getByText('+ add')).toBeDefined()
    })

    fireEvent.click(screen.getByText('+ add'))

    await waitFor(() => {
      expect(screen.getByText("You're subscribed to everything!")).toBeDefined()
    })
  })

  it('hides upsell section when no suggestions provided', async () => {
    const onSubscribe = vi.fn().mockResolvedValue({ success: true })

    render(
      <SubscribeForm
        newsletterId="primary"
        locale="en"
        accentColor="#C14513"
        newsletterName="Primary"
        strings={formStrings}
        privacyHref="/privacy"
        onSubscribe={onSubscribe}
        suggestions={[]}
        suggestionStrings={suggestionStrings}
      />,
    )

    fireEvent.change(screen.getByLabelText(formStrings.emailLabel), {
      target: { value: 'test@example.com' },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: formStrings.submit }))

    await waitFor(() => {
      expect(screen.getByText(formStrings.pendingTitle)).toBeDefined()
    })

    // Upsell title should NOT be present
    expect(screen.queryByText(suggestionStrings.upsellTitle)).toBeNull()
  })
})
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web
```

- [ ] **Step 4: Fix any test failures**

If any tests fail, debug and fix before proceeding.

- [ ] **Step 5: Final commit**

```
test(newsletter): add edge case and UpsellSection component tests for cross-promotion
```

---

## Self-Review Checklist

| Spec Requirement | Task |
|---|---|
| Relevance algorithm (subscriber 60% + recency 30% + newness 10%) | Task 1 |
| Locale filter (EN -> EN only; PT-BR -> PT-BR + EN) | Task 1 |
| Single query joining types + subscriptions + editions | Task 2 |
| `unstable_cache` with 1-hour TTL + tag invalidation | Task 2 |
| Position A after author section, before FAQ | Task 6 |
| Mini card: accent bar, name, tagline, cadence, subscriber count | Task 4 |
| Responsive grid (3 col / 2 col / 1 col) | Task 5 |
| Edge case: 0 suggestions -> no render | Task 4 (conditional return null) |
| Edge case: 1 suggestion -> "Another newsletter" title | Task 4 (conditional title) |
| Position C after subscribe success | Task 7 |
| "+ add" inline subscribe buttons | Task 7 |
| Button transitions to "added" on success | Task 7 |
| "Subscribed to everything" with hub link | Task 7 |
| Post-subscribe exclusion of already-subscribed types | Task 9 |
| Cache invalidation on webhook / cron / CMS action | Task 8 |
| 7 i18n strings (EN + PT-BR) | Task 3 |
| Unit tests for scoring + locale filter | Task 1 |
| Edge case tests (scoring + locale) | Task 10 |
| UpsellSection component tests (render, add, subscribed-to-all, empty) | Task 10 |
| All code uses strict TypeScript (no `any`) | All tasks |
| Files use kebab-case naming | All tasks |
| Vitest (not Jest) | All tasks |
