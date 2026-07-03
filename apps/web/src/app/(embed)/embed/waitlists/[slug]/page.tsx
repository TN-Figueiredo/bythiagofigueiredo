import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getLogger } from '../../../../../../lib/logger'
import { redactMessage } from '../../../../../../lib/waitlists/scrub'
import { isPublicWaitlistStatus } from '../../../../../../lib/waitlists/status'
import { parseEmbedAccent } from '../../../../../../lib/waitlists/embed'
import { WaitlistSignupForm } from '@/components/waitlists/waitlist-signup-form'
import { WaitlistEmbedFrame } from '@/components/waitlists/embed-frame'
import type { WaitlistLocale } from '@/components/waitlists/form-strings'

// Same rationale as the hosted landing (Surface 1): the page reads request headers
// (getSiteContext → x-site-id) and slugs are unknown at build time — force dynamic.
export const dynamic = 'force-dynamic'

const EYEBROW: Record<WaitlistLocale, string> = {
  'pt-BR': 'lista de espera',
  en: 'waitlist',
}

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ accent?: string | string[]; lang?: string | string[] }>
}

/**
 * Surface 2 — embeddable block (`/embed/waitlists/{slug}?accent=RRGGBB&lang=en`).
 *
 * Renders ONLY the ~480px signup card (no site shell — see the (embed) layout).
 * Query params:
 * - `accent`: 6-hex-digit override for `--pb-accent` on the card; invalid values
 *   are silently ignored (theme default wins) — see parseEmbedAccent.
 * - `lang`: `pt-BR` (default) | `en`. Unlike the hosted landing (which follows the
 *   site's default locale), the embedder picks the language of THEIR page.
 *
 * Frameability: /embed/waitlists/* is the only path exempted from the global
 * X-Frame-Options: DENY + `frame-ancestors 'none'` (see next.config.ts headers()).
 * Auto-height for the host iframe comes from <WaitlistEmbedFrame> (postMessage).
 */
export default async function WaitlistEmbedPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  // Same resolution mechanism as the hosted landing: middleware-set x-site-id read
  // via getSiteContext, then a slug lookup scoped to that site.
  const { siteId } = await getSiteContext()

  const rawLang = Array.isArray(sp.lang) ? sp.lang[0] : sp.lang
  const locale: WaitlistLocale = rawLang === 'en' ? 'en' : 'pt-BR'
  const accent = parseEmbedAccent(sp.accent)

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('waitlists')
    .select('id, status, name')
    .eq('site_id', siteId)
    .eq('slug', slug)
    .maybeSingle()

  // Observe real DB/network faults before the no-oracle 404 — mirrors the landing page.
  if (error) {
    getLogger().error('[waitlist_embed_page]', { code: error.code })
    Sentry.captureException(
      new Error(`waitlist_embed_page ${error.code}: ${redactMessage(error.message ?? '')}`),
      { tags: { component: 'waitlist' } },
    )
    notFound()
  }
  if (!data || !isPublicWaitlistStatus(data.status)) {
    notFound()
  }

  // The validated accent lands as an inline CSS var so every `--pb-accent` consumer
  // inside the card (button bg, checkbox accent, focus ring, eyebrow) picks it up.
  const accentStyle = accent ? ({ '--pb-accent': accent } as CSSProperties) : undefined

  return (
    <WaitlistEmbedFrame>
      <main className="p-3" style={accentStyle}>
        <div className="mx-auto w-full max-w-[480px] rounded-xl border border-pb-line bg-pb-paper shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          <div className="px-6 pt-5">
            <span className="mb-1 inline-block font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-pb-accent">
              ✦ {EYEBROW[locale]}
            </span>
            <p className="font-serif text-xl font-medium leading-tight text-pb-ink">{data.name}</p>
          </div>
          {/* initialStatus is server-resolved above, so the form skips its mount-GET
              (no loading flash inside the host iframe). variant="embed" tags the
              signup with source_surface='embed'. */}
          <WaitlistSignupForm
            slug={slug}
            locale={locale}
            name={data.name}
            variant="embed"
            initialStatus={data.status}
          />
        </div>
      </main>
    </WaitlistEmbedFrame>
  )
}
