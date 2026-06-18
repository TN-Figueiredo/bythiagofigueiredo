import { notFound } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getLogger } from '../../../../../lib/logger'
import { redactMessage } from '../../../../../lib/waitlists/scrub'
import { isPublicWaitlistStatus } from '../../../../../lib/waitlists/status'
import { Paper, Tape } from '@/components/pinboard'
import { WaitlistSignupForm } from '@/components/waitlists/waitlist-signup-form'
import type { WaitlistLocale } from '@/components/waitlists/form-strings'

// The page reads request headers (via getSiteContext → x-site-id) and slugs are not
// known at build time, so static prerender is impossible and would break multi-site
// routing. Force dynamic, matching the public status route (Task 7).
export const dynamic = 'force-dynamic'

const EYEBROW: Record<WaitlistLocale, string> = {
  'pt-BR': 'lista de espera',
  en: 'waitlist',
}

interface WaitlistTranslation {
  locale: string
  headline: string | null
  subheadline: string | null
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function WaitlistLandingPage({ params }: Props) {
  const { slug } = await params
  // Same resolution mechanism as the Task 7 status route: middleware-set x-site-id /
  // x-default-locale, read via getSiteContext — NOT resolveSiteByHost (that host-lookup
  // exists only for MetadataRoute, which strips x-site-id; ordinary (public) server
  // components receive it).
  const { siteId, defaultLocale } = await getSiteContext()
  const locale: WaitlistLocale = defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('waitlists')
    .select(
      'id, status, name, description, waitlist_translations(locale, headline, subheadline)',
    )
    .eq('site_id', siteId)
    .eq('slug', slug)
    .maybeSingle()

  // Observe real DB/network errors (M8) before the no-oracle 404 — mirror the sibling
  // status route. A genuine fault must be distinguishable from a true not-found in Sentry.
  if (error) {
    getLogger().error('[waitlist_landing_page]', { code: error.code })
    Sentry.captureException(
      new Error(`waitlist_landing_page ${error.code}: ${redactMessage(error.message ?? '')}`),
      { tags: { component: 'waitlist' } },
    )
    notFound()
  }
  if (!data || !isPublicWaitlistStatus(data.status)) {
    notFound()
  }

  const status = data.status
  const translations = (data.waitlist_translations ?? []) as WaitlistTranslation[]
  const tx = translations.find((t) => t.locale === locale) ?? translations[0] ?? null

  const headline = tx?.headline?.trim() || data.name
  const subheadline = tx?.subheadline?.trim() || data.description?.trim() || null

  return (
    <main className="mx-auto max-w-[1180px] px-7 py-16">
      <div className="grid grid-cols-1 gap-13 md:grid-cols-[1.35fr_1fr] md:items-start">
        {/* LEFT — pitch */}
        <div>
          <span className="mb-4 inline-block font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-pb-accent">
            ✦ {EYEBROW[locale]}
          </span>
          <h1 className="relative inline-block font-serif text-5xl font-medium leading-[0.98] tracking-tight text-pb-ink text-balance">
            {headline}
            <span
              aria-hidden="true"
              className="absolute -left-2 -right-2 bottom-1.5 -z-10 h-5 -skew-x-3 bg-pb-accent opacity-[0.16]"
            />
          </h1>
          {subheadline && (
            <p className="mt-6 max-w-[600px] text-lg leading-relaxed text-pb-ink text-pretty">
              {subheadline}
            </p>
          )}
        </div>

        {/* RIGHT — sticky signup card */}
        <div className="md:sticky md:top-28">
          <div className="relative pt-3">
            <Tape style={{ top: -8, right: '24%', transform: 'rotate(-4deg)', zIndex: 2 }} />
            <Paper rotation={0.3} padding="0" style={{ marginTop: 6 }}>
              <WaitlistSignupForm
                slug={slug}
                locale={locale}
                name={data.name}
                variant="landing"
                initialStatus={status}
              />
            </Paper>
            <p className="mt-4 text-center font-mono text-[11px] text-pb-ink/55">
              <a href="/waitlists/rights" className="underline underline-offset-2 hover:text-pb-ink">
                {locale === 'pt-BR' ? 'Acessar ou apagar meus dados' : 'Access or delete my data'}
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
