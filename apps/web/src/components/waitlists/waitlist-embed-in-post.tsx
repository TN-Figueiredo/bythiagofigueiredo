'use client'

import { WaitlistSignupForm } from './waitlist-signup-form'
import type { WaitlistLocale } from './form-strings'

// Surface 3 lead-in copy (design handoff: handwritten "curtiu? entra na lista.").
const LEAD_IN: Record<WaitlistLocale, string> = {
  'pt-BR': 'curtiu? entra na lista.',
  en: 'liked it? join the list.',
}

export function normalizeWaitlistLocale(value: unknown): WaitlistLocale {
  return typeof value === 'string' && value.toLowerCase().startsWith('en') ? 'en' : 'pt-BR'
}

// All-optional/unknown on purpose: MDX attributes arrive untyped from compiled
// content, so the component validates at runtime and renders nothing when invalid.
interface Props {
  slug?: unknown
  locale?: unknown
}

/**
 * Inline waitlist block inside a blog post (design handoff "Surface 3").
 *
 * Reached from two render paths:
 * 1. MDX (`content_mdx` → compileMdx → MdxRunner): registered in `blogRegistry` as
 *    `WaitlistForm` (canonical, hand-authored) and `waitlistform` (the TipTap
 *    editor's DOM-serialized form) — MDX attrs arrive untyped, hence `unknown` props.
 * 2. TipTap JSON (`content_json` → compileJsonContent → `.pb-waitlist` placeholder):
 *    portal-mounted by <BlogArticleHtml> with the article locale.
 *
 * The `inline` variant of <WaitlistSignupForm> resolves the waitlist state itself
 * via a mount-GET on /api/waitlists/{slug} (never render-then-yank), so this wrapper
 * needs no server data — it stays client-safe for both paths.
 */
export function WaitlistEmbedInPost({ slug, locale }: Props) {
  const safeSlug = typeof slug === 'string' ? slug.trim() : ''
  if (!safeSlug) return null
  const loc = normalizeWaitlistLocale(locale)

  return (
    <aside
      className="pb-waitlist-inline my-8 rounded-xl border border-pb-line border-l-4 border-l-pb-accent bg-pb-paper"
      aria-label={LEAD_IN[loc]}
      data-waitlist-slug={safeSlug}
    >
      <p className="px-6 pt-5 font-serif text-lg italic text-pb-ink">{LEAD_IN[loc]}</p>
      <WaitlistSignupForm slug={safeSlug} locale={loc} name="" variant="inline" />
    </aside>
  )
}
