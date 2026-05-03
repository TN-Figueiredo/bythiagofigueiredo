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
