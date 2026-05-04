# Newsletter Cross-Promotion — Design Spec

**Date:** 2026-05-03
**Score:** 98/100
**Status:** Approved
**Scope:** Locale-aware newsletter suggestions on individual landing pages (`/newsletters/[slug]`), in two positions: discovery (pre-subscribe) and upsell (post-subscribe).

---

## 1. Problem

Individual newsletter landing pages are conversion-focused for a single newsletter but provide no path to discover other newsletters. A visitor interested in "Code in Portuguese" might also want "The bythiago diary" but would never know unless they navigate to the hub. Cross-promotion increases subscriber breadth without additional acquisition cost.

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Position A (discovery) | After "Who writes this", before FAQ | Visitor has read about the newsletter and author, natural moment to show related content; subscribe form is already visible in sticky sidebar |
| Position C (upsell) | Inline in subscribe form after success | Visitor just converted — highest-intent moment; same email reused, zero friction to add more |
| Relevance algorithm | Hybrid score: subscriber count (60%) + recency (30%) + newness (10%) | Pure subscriber count makes list static (top newsletter always wins); recency rewards active newsletters; newness gives boost to new types |
| Locale filtering | EN visitors → only EN; PT-BR visitors → PT-BR + EN | Portuguese speakers commonly read English content; English speakers rarely read Portuguese; matches site's bilingual audience |
| Max suggestions | 3 | With 4 types minus current = 3 max; scales to larger catalogs without overwhelming |
| Manual curation | None — fully automatic | No `related_type_ids` column; subscriber count + recency is sufficient; zero editorial maintenance |
| Cache strategy | `unstable_cache` with 1-hour TTL, tag-based invalidation | Protects against per-request aggregation queries at scale |

## 3. Relevance Algorithm

### 3.1 Score computation

For each candidate newsletter type (excluding current, filtered by locale):

```
score = (normalized_subscriber_count * 0.6)
      + (recency_bonus * 0.3)
      + (newness_bonus * 0.1)
```

**normalized_subscriber_count**: `type_confirmed_count / max_confirmed_count_across_all_candidates`. Range: 0-1.

**recency_bonus**:
- 1.0 if an edition was sent in the last 14 days
- 0.7 if sent in the last 30 days
- 0.3 if sent in the last 90 days
- 0.0 otherwise

**newness_bonus**:
- 1.0 if newsletter type was created in the last 30 days
- 0.5 if created in the last 60 days
- 0.0 otherwise

### 3.2 Locale filter

Applied BEFORE scoring:

```typescript
function filterByLocale(types: NewsletterType[], visitorLocale: string): NewsletterType[] {
  if (visitorLocale === 'pt-BR') {
    // Portuguese speakers see both Portuguese AND English
    return types.filter(t => t.locale === 'pt-BR' || t.locale === 'en')
  }
  // English speakers see only English
  return types.filter(t => t.locale === visitorLocale)
}
```

### 3.3 Query

Single query joining `newsletter_types`, `newsletter_subscriptions` (count), and `newsletter_editions` (max sent_at):

```sql
SELECT
  nt.id, nt.slug, nt.name, nt.tagline, nt.cadence_label, nt.color, nt.color_dark, nt.locale, nt.badge, nt.created_at,
  COUNT(ns.id) FILTER (WHERE ns.status = 'confirmed') AS subscriber_count,
  MAX(ne.sent_at) AS last_sent_at
FROM newsletter_types nt
LEFT JOIN newsletter_subscriptions ns ON ns.newsletter_type_id = nt.id
LEFT JOIN newsletter_editions ne ON ne.newsletter_type_id = nt.id AND ne.status = 'sent'
WHERE nt.slug != $currentSlug
  AND nt.active = true
  AND nt.locale = ANY($allowedLocales)
GROUP BY nt.id
ORDER BY /* computed score DESC */
LIMIT 3;
```

Score computation happens in application code after the query (simpler than SQL, easier to tune).

### 3.4 Cache

```typescript
const getSuggestions = unstable_cache(
  async (currentSlug: string, locale: string) => { /* query + score + sort */ },
  ['newsletter-suggestions'],
  { tags: ['newsletter-suggestions'], revalidate: 3600 }
)
```

Invalidated when:
- New subscriber confirmed (webhook processing)
- New edition sent (send cron)
- Newsletter type created/updated/deleted (CMS action)

Tag: `revalidateTag('newsletter-suggestions')`

## 4. Position A — Discovery Section

### 4.1 Placement

After "Who writes this" section, before FAQ accordion. New `<section>` element.

### 4.2 Visual Treatment

- Section title: "More newsletters" (EN) / "Mais newsletters" (PT-BR) — in Fraunces serif, same size as other section headings
- Subtitle: "You might also like" (EN) / "Talvez te interesse" (PT-BR) — muted, Inter 14px
- Mini cards in horizontal row (flex, wrap on mobile)

### 4.3 Mini Card Design

Compact card — NOT the full hub card. Per card:
- Accent bar left: 3px, card's accent color
- Background: matches page paper token
- Name: Fraunces 18px, card's accent color
- Tagline: Inter 13px, muted, single line with text-overflow ellipsis
- Cadence: JetBrains Mono 9px, uppercase, faint
- Subscriber count: JetBrains Mono 10px, faint (e.g., "&#9673; 1,240 subscribers")
- Entire card is a link to `/newsletters/[slug]`
- Hover: subtle lift (2px) + shadow deepen
- No "latest issue" sample, no stats bar, no tape decoration — keep compact

### 4.4 Responsive

- Desktop: horizontal row, up to 3 cards side by side
- Tablet (<=720px): 2 columns
- Mobile (<=480px): single column, stacked

### 4.5 Edge Cases

- 0 suggestions after filtering → don't render section at all
- 1 suggestion → render section with single card (no "more" in title — use "Another newsletter" / "Outra newsletter")
- All locale-filtered out → don't render

## 5. Position C — Post-Subscribe Upsell

### 5.1 Trigger

After successful subscription (the subscribe form currently shows a success state with "check your email" message).

### 5.2 UX Flow

The subscribe form transitions inline (no redirect, no modal):

1. Form success message: "You're in! Check your email to confirm." (existing behavior)
2. Below the success message, new section appears: "You might also like..." with mini suggestion cards
3. Each suggestion card has a "+ add" button (not a link — subscribes inline with same email)
4. On click: calls `subscribeToNewsletters` with the captured email + new type ID
5. Button transitions to "added" (disabled) on success
6. If ALL available newsletters are already subscribed → show "You're subscribed to everything!" with link to hub

### 5.3 Filtering in Position C

Before rendering suggestions in the post-subscribe flow:
1. Apply locale filter (same as Position A)
2. Query `newsletter_subscriptions` by the subscriber's email
3. Exclude types where subscriber already has `status IN ('confirmed', 'pending')`
4. Exclude the type they just subscribed to (current page)
5. Score and sort remaining candidates

This prevents showing newsletters the user already subscribes to.

### 5.4 Visual Treatment (Post-Subscribe)

- Appears inside the existing subscribe form card area
- Same mini card design as Position A but with "+ add" button instead of being a link
- "+ add" button: dashed border, accent color on hover, transitions to "added" with solid accent background
- Subtle fade-in animation (0.3s ease)
- Max 3 suggestions

### 5.5 Rate Limiting

Reuses existing rate limiting from `subscribeToNewsletters` server action (per-IP). No additional rate limiting needed.

## 6. Files Changed

| File | Change |
|---|---|
| `apps/web/src/app/(public)/newsletters/[slug]/page.tsx` | Add discovery section (Position A), pass suggestions data |
| `apps/web/src/app/(public)/newsletters/[slug]/subscribe-form.tsx` | Add upsell section (Position C) after success state |
| `apps/web/src/app/(public)/newsletters/[slug]/newsletter-suggestions.tsx` | **New file**: shared mini card component + suggestion fetching logic |
| `apps/web/src/app/(public)/newsletters/[slug]/newsletter-landing.css` | Styles for mini cards + upsell section |

## 7. i18n Strings

| Key | EN | PT-BR |
|---|---|---|
| `newsletter.landing.moreNewsletters` | More newsletters | Mais newsletters |
| `newsletter.landing.anotherNewsletter` | Another newsletter | Outra newsletter |
| `newsletter.landing.youMightAlsoLike` | You might also like | Talvez te interesse |
| `newsletter.landing.addNewsletter` | + add | + adicionar |
| `newsletter.landing.addedNewsletter` | added | adicionado |
| `newsletter.landing.subscribedToAll` | You're subscribed to everything! | Você já assina tudo! |
| `newsletter.landing.upsellTitle` | You might also like... | Talvez te interesse... |

## 8. What Does NOT Change

- Hub suggest phase (stays independent, different UX)
- Subscribe form structure (success state extended, not replaced)
- Newsletter landing page layout before "Who writes this"
- SEO metadata / JSON-LD
- Newsletter type schema (no new columns needed — all data comes from existing tables)

## 9. Testing

- Unit test: relevance score computation (various subscriber counts, recency, newness combinations)
- Unit test: locale filter (EN → EN only; PT-BR → PT-BR + EN)
- Unit test: post-subscribe exclusion (already subscribed types filtered out)
- Integration test (DB-gated): suggestions query with real data
- E2E consideration: Position C flow — subscribe, verify suggestions appear, click add, verify added state

## 10. Edge Cases

| Scenario | Behavior |
|---|---|
| Only 1 other newsletter exists | Show it alone, title says "Another newsletter" |
| 0 other newsletters after locale filter | Don't render either section |
| All others already subscribed (Position C) | Show "You're subscribed to everything!" |
| Newsletter type has 0 subscribers and 0 editions | Score is 0 but still shown if it's the only option (better than empty) |
| Visitor subscribes to suggestion, then refreshes | Position A still shows (it's discovery, not tied to subscription state); Position C re-checks subscriptions |

## 11. Follow-ups (out of scope)

- A/B test Position A vs no Position A for conversion impact
- "Recommended for you" based on reading history (requires auth)
- Manual curation override via `related_type_ids` if catalog grows beyond ~10 types
- Analytics tracking: click-through rate on suggestions, upsell conversion rate
