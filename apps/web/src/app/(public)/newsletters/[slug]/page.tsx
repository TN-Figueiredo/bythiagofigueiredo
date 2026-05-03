import Image from 'next/image'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'

import {
  getNewsletterTypeBySlug,
  getNewsletterStats,
  getRecentEditions,
  getActiveTypeCount,
} from '@/lib/newsletter/queries'
import {
  formatSubscriberCount,
  formatDaysAgo,
  resolveAccentTextColor,
  deriveCadenceLabel,
} from '@/lib/newsletter/format'
import { IDENTITY_PROFILES } from '@/lib/seo/identity-profiles'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateNewsletterLandingMetadata } from '@/lib/seo/page-metadata'
import { buildBreadcrumbNode, buildFaqNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { localePath } from '@/lib/i18n/locale-path'
import { Paper, Tape } from '@/components/pinboard'
import { getNewsletterSuggestions } from '@/lib/newsletter/suggestions'
import { NewsletterDiscoverySection } from './newsletter-suggestions'
import type { SuggestionStrings } from './newsletter-suggestions'
import { SubscribeForm } from './subscribe-form'
import { FaqAccordion } from './faq-accordion'
import { MobileStickyCTA } from './mobile-sticky-cta'
import { subscribeToNewsletters, getPostSubscribeSuggestions } from '@/app/(public)/actions/subscribe-newsletters'

import './newsletter-landing.css'

import enStrings from '@/locales/en.json'
import ptBrStrings from '@/locales/pt-BR.json'

export const dynamicParams = true
export const revalidate = 3600

interface PageProps {
  params: Promise<{ slug: string }>
}

// ── generateStaticParams ───────────────────────────────────────────────────

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data } = await supabase
      .from('newsletter_types')
      .select('slug')
      .eq('active', true)
    return (data ?? []).map((row: { slug: string }) => ({ slug: row.slug }))
  } catch {
    return []
  }
}

// ── generateMetadata ──────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const h = await headers()
  const host = h.get('host') ?? ''

  try {
    const type = await getNewsletterTypeBySlug(slug)
    if (!type) return { title: 'Newsletter' }

    const site = await resolveSiteByHost(host.split(':')[0] ?? '')
    if (!site) return { title: type.name }

    const config = await getSiteSeoConfig(site.id, host)
    return generateNewsletterLandingMetadata(config, type)
  } catch {
    return { title: 'Newsletter' }
  }
}

// ── Page component ────────────────────────────────────────────────────────

export default async function NewsletterLandingPage({ params }: PageProps) {
  const { slug } = await params
  const h = await headers()
  const locale = (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'
  const host = (h.get('host') ?? '').split(':')[0] ?? ''

  const dict = (locale === 'pt-BR' ? ptBrStrings : enStrings) as unknown as Record<string, unknown>
  const t = (key: string) => (dict[key] as string) ?? key
  const faqItems = dict['newsletter.landing.faq'] as Array<{ q: string; a: string }>

  try {
    const type = await getNewsletterTypeBySlug(slug)
    if (!type) notFound()

    const siteId = type.site_id

    const [stats, recentEditions, activeCount, config, suggestions] = await Promise.all([
      getNewsletterStats(type.id, siteId),
      getRecentEditions(type.id, siteId, 3),
      getActiveTypeCount(siteId),
      getSiteSeoConfig(siteId, host).catch(() => null),
      getNewsletterSuggestions(slug, locale),
    ])

    const accentLight = type.color
    const accentDark = type.color_dark ?? type.color
    const accentTextColor = resolveAccentTextColor(accentLight)
    const cadenceLabel = deriveCadenceLabel(type.cadence_label, type.cadence_days, locale, type.cadence_start_date)
    const subscriberCountStr = formatSubscriberCount(stats.subscriberCount)
    const profile = IDENTITY_PROFILES['bythiagofigueiredo']
    const authorName = profile?.name ?? 'Thiago Figueiredo'
    const privacyHref = localePath('/privacy', locale)

    const formStrings = {
      stepLabel: t('newsletter.landing.stepLabel'),
      formTitle: t('newsletter.landing.formTitle'),
      formSubtitle: t('newsletter.landing.formSubtitle'),
      emailLabel: t('newsletter.landing.emailLabel'),
      emailPlaceholder: t('newsletter.landing.emailPlaceholder'),
      consentPrefix: t('newsletter.landing.consentPrefix'),
      consentSuffix: t('newsletter.landing.consentSuffix'),
      privacy: t('newsletter.landing.privacy'),
      submit: t('newsletter.landing.submit'),
      submitting: t('newsletter.landing.submitting'),
      noSpam: t('newsletter.landing.noSpam'),
      noPitch: t('newsletter.landing.noPitch'),
      oneClickLeave: t('newsletter.landing.oneClickLeave'),
      pendingTitle: t('newsletter.landing.pendingTitle'),
      pendingBody: t('newsletter.landing.pendingBody'),
      pendingStep1: t('newsletter.landing.pendingStep1'),
      pendingStep2: t('newsletter.landing.pendingStep2'),
      pendingStep3: t('newsletter.landing.pendingStep3'),
      pendingTip: t('newsletter.landing.pendingTip'),
      pendingResend: t('newsletter.landing.pendingResend'),
      pendingResent: t('newsletter.landing.pendingResent'),
      pendingChangeEmail: t('newsletter.landing.pendingChangeEmail'),
      confirmedTitle: t('newsletter.landing.confirmedTitle'),
      confirmedBody: t('newsletter.landing.confirmedBody'),
      confirmedExclamation: t('newsletter.landing.confirmedExclamation'),
      successAgain: t('newsletter.landing.successAgain'),
      errorRateLimit: t('newsletter.landing.errorRateLimit'),
      errorAlreadySubscribed: t('newsletter.landing.errorAlreadySubscribed'),
      errorInvalid: t('newsletter.landing.errorInvalid'),
      errorServer: t('newsletter.landing.errorServer'),
    }

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

    // CSS custom props for accent colors
    const accentVars = {
      '--nl-accent-light': accentLight,
      '--nl-accent-dark': accentDark,
      '--nl-accent-text': accentTextColor,
    } as React.CSSProperties

    // JSON-LD structured data
    const jsonLdNodes = config
      ? [
          buildBreadcrumbNode([
            { name: t('newsletter.landing.crumbHome'), url: config.siteUrl },
            { name: t('newsletter.landing.crumbHub'), url: `${config.siteUrl}/newsletters` },
            { name: type.name, url: `${config.siteUrl}/newsletters/${slug}` },
          ]),
          ...(faqItems?.length ? [buildFaqNode(faqItems)] : []),
        ]
      : null

    return (
      <div
        className="nl-landing"
        lang={locale}
        style={{
          ...accentVars,
          minHeight: '100vh',
        }}
      >
        {jsonLdNodes && <JsonLdScript graph={composeGraph(jsonLdNodes)} />}

        {/* Skip link */}
        <a href="#form-hero" className="nl-skip-link">
          {t('newsletter.landing.skipToForm')}
        </a>

        <main style={{ maxWidth: 980, margin: '0 auto', padding: '24px 28px 80px' }}>
          {/* Breadcrumb nav */}
          <nav aria-label="breadcrumb" style={{ marginBottom: 36 }}>
            <ol
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--font-jetbrains-var), monospace',
                fontSize: 12,
                color: 'var(--pb-muted)',
              }}
            >
              <li>
                <Link
                  href={localePath('/', locale)}
                  style={{ color: 'var(--pb-muted)', textDecoration: 'none' }}
                >
                  {t('newsletter.landing.crumbHome')}
                </Link>
              </li>
              <li aria-hidden="true" style={{ opacity: 0.5 }}>
                /
              </li>
              <li>
                <Link
                  href={localePath('/newsletters', locale)}
                  style={{ color: 'var(--pb-muted)', textDecoration: 'none' }}
                >
                  {t('newsletter.landing.crumbHub')}
                </Link>
              </li>
              <li aria-hidden="true" style={{ opacity: 0.5 }}>
                /
              </li>
              <li aria-current="page" style={{ color: 'var(--pb-ink)' }}>
                {type.name}
              </li>
            </ol>
          </nav>

          {/* ── Hero grid ─────────────────────────────────────────────── */}
          <div className="nl-hero-grid" style={{ marginBottom: 72 }}>
            {/* Left column */}
            <div>
              {/* Badge */}
              {type.badge && (
                <div style={{ marginBottom: 16 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      background: 'var(--nl-accent)',
                      color: accentTextColor,
                      fontFamily: 'var(--font-jetbrains-var), monospace',
                      fontSize: 10,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      transform: 'rotate(-1deg)',
                    }}
                  >
                    {type.badge === 'new' ? t('newsletter.landing.newBadge') : type.badge}
                  </span>
                </div>
              )}

              {/* Title */}
              <h1
                style={{
                  fontFamily: 'var(--font-fraunces-var), serif',
                  fontSize: 'clamp(36px, 5vw, 56px)',
                  fontWeight: 600,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.05,
                  color: 'var(--pb-ink)',
                  margin: '0 0 16px',
                }}
              >
                <span className="nl-marker-underline">{type.name}</span>
              </h1>

              {/* Tagline */}
              {type.tagline && (
                <p
                  style={{
                    fontFamily: 'var(--font-fraunces-var), serif',
                    fontSize: 20,
                    color: 'var(--pb-muted)',
                    lineHeight: 1.4,
                    margin: '0 0 20px',
                    fontStyle: 'italic',
                  }}
                >
                  {type.tagline}
                </p>
              )}

              {/* Description */}
              {type.description && (
                <p
                  style={{
                    fontSize: 16,
                    color: 'var(--pb-muted)',
                    lineHeight: 1.65,
                    margin: '0 0 24px',
                    maxWidth: 520,
                  }}
                >
                  {type.description}
                </p>
              )}

              {/* Stat row */}
              <div className="nl-stat-row" style={{ marginBottom: 28 }}>
                {subscriberCountStr && (
                  <div className="nl-stat-item">
                    <div
                      style={{
                        fontFamily: 'var(--font-fraunces-var), serif',
                        fontSize: 28,
                        fontWeight: 700,
                        color: 'var(--pb-ink)',
                        lineHeight: 1,
                      }}
                    >
                      {subscriberCountStr}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-jetbrains-var), monospace',
                        fontSize: 11,
                        color: 'var(--pb-muted)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {t('newsletter.landing.subsLabel')}
                    </div>
                  </div>
                )}

                {stats.editionsCount > 0 && (
                  <div className="nl-stat-item">
                    <div
                      style={{
                        fontFamily: 'var(--font-fraunces-var), serif',
                        fontSize: 28,
                        fontWeight: 700,
                        color: 'var(--pb-ink)',
                        lineHeight: 1,
                      }}
                    >
                      {stats.editionsCount}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-jetbrains-var), monospace',
                        fontSize: 11,
                        color: 'var(--pb-muted)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {t('newsletter.landing.issuesLabel')}
                    </div>
                  </div>
                )}

                {cadenceLabel && (
                  <div className="nl-stat-item">
                    <div
                      style={{
                        fontFamily: 'var(--font-fraunces-var), serif',
                        fontSize: 20,
                        fontWeight: 600,
                        color: 'var(--nl-accent)',
                        lineHeight: 1,
                      }}
                    >
                      {cadenceLabel}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-jetbrains-var), monospace',
                        fontSize: 11,
                        color: 'var(--pb-muted)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {t('newsletter.landing.cadenceLabel')}
                    </div>
                  </div>
                )}

                {stats.daysSinceLastEdition !== null && (
                  <div className="nl-stat-item">
                    <div
                      style={{
                        fontFamily: 'var(--font-fraunces-var), serif',
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'var(--pb-muted)',
                        lineHeight: 1,
                      }}
                    >
                      {formatDaysAgo(stats.daysSinceLastEdition, locale)}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-jetbrains-var), monospace',
                        fontSize: 11,
                        color: 'var(--pb-faint)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {t('newsletter.landing.sentLabel')}
                    </div>
                  </div>
                )}
              </div>

              {/* Promise list */}
              {type.landing_content?.promise && type.landing_content.promise.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-jetbrains-var), monospace',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--pb-muted)',
                      marginBottom: 12,
                    }}
                  >
                    {t('newsletter.landing.sectionWhat')}
                  </div>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {type.landing_content.promise.map((item, i) => (
                      <li
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          fontSize: 15,
                          color: 'var(--pb-ink)',
                          lineHeight: 1.4,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{ color: 'var(--nl-accent)', flexShrink: 0, marginTop: 2 }}
                        >
                          ◆
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right column: sticky form */}
            <div className="nl-form-sticky">
              <div style={{ position: 'relative', paddingTop: 20 }}>
                <Tape
                  color="var(--pb-tape)"
                  style={{
                    top: 4,
                    left: '50%',
                    transform: 'translateX(-50%) rotate(-1.5deg)',
                  }}
                />
                <Paper padding="28px">
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
                    currentSlug={slug}
                    onGetFilteredSuggestions={getPostSubscribeSuggestions}
                  />
                </Paper>
              </div>
            </div>
          </div>

          {/* ── Sample editions ──────────────────────────────────────── */}
          {recentEditions.length > 0 && (
            <section
              className="nl-section"
              style={{ marginBottom: 72 }}
              aria-labelledby="section-samples"
            >
              <h2
                id="section-samples"
                style={{
                  fontFamily: 'var(--font-fraunces-var), serif',
                  fontSize: 28,
                  fontWeight: 600,
                  color: 'var(--pb-ink)',
                  marginBottom: 24,
                }}
              >
                {t('newsletter.landing.sectionSamples')}
              </h2>

              <div className="nl-samples-grid">
                {recentEditions.map((edition, i) => {
                  const rotation = ((i * 37) % 7 - 3) * 0.4
                  const lift = ((i * 53) % 5 - 2) * 2
                  return (
                    <div key={edition.id} style={{ position: 'relative', paddingTop: 20 }}>
                      <Tape
                        color={i % 2 === 0 ? 'var(--pb-tape)' : 'var(--pb-tape2, var(--pb-tape))'}
                        style={{
                          top: 4,
                          ...(i % 2 ? { left: '20%' } : { right: '20%' }),
                          transform: `rotate(${(i * 9) % 14 - 7}deg)`,
                        }}
                      />
                      <Paper rotation={rotation} translateY={lift}>
                        <Link
                          href={`/newsletter/archive/${edition.id}`}
                          style={{ textDecoration: 'none', display: 'block' }}
                        >
                          <div
                            style={{
                              borderLeft: `3px solid var(--nl-accent)`,
                              paddingLeft: 12,
                              marginBottom: 12,
                            }}
                          >
                            <div
                              style={{
                                fontFamily: 'var(--font-fraunces-var), serif',
                                fontSize: 16,
                                fontWeight: 600,
                                color: 'var(--pb-ink)',
                                lineHeight: 1.3,
                                marginBottom: 6,
                              }}
                            >
                              {edition.subject}
                            </div>
                            {edition.preheader && (
                              <div
                                style={{
                                  fontSize: 13,
                                  color: 'var(--pb-muted)',
                                  lineHeight: 1.4,
                                }}
                              >
                                {edition.preheader}
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <time
                              dateTime={edition.sent_at}
                              style={{
                                fontFamily: 'var(--font-jetbrains-var), monospace',
                                fontSize: 11,
                                color: 'var(--pb-faint)',
                              }}
                            >
                              {new Date(edition.sent_at).toLocaleDateString(locale, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </time>
                            <span
                              style={{
                                fontFamily: 'var(--font-jetbrains-var), monospace',
                                fontSize: 11,
                                color: 'var(--nl-accent)',
                              }}
                            >
                              {t('newsletter.landing.sampleReadFull')}
                            </span>
                          </div>
                        </Link>
                      </Paper>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Author section ───────────────────────────────────────── */}
          <section
            className="nl-section"
            style={{ marginBottom: 72 }}
            aria-labelledby="section-author"
          >
            <h2
              id="section-author"
              style={{
                fontFamily: 'var(--font-fraunces-var), serif',
                fontSize: 28,
                fontWeight: 600,
                color: 'var(--pb-ink)',
                marginBottom: 24,
              }}
            >
              {t('newsletter.landing.sectionAuthor')}
            </h2>

            <div
              style={{
                display: 'flex',
                gap: 28,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              {/* Author photo */}
              <div style={{ flexShrink: 0 }}>
                <Image
                  src="/identity/thiago.jpg"
                  alt={authorName}
                  width={80}
                  height={80}
                  style={{
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--pb-line)',
                  }}
                />
              </div>

              {/* Author info */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-fraunces-var), serif',
                    fontSize: 20,
                    fontWeight: 600,
                    color: 'var(--pb-ink)',
                    marginBottom: 4,
                  }}
                >
                  {authorName}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-jetbrains-var), monospace',
                    fontSize: 12,
                    color: 'var(--pb-muted)',
                    marginBottom: 12,
                    letterSpacing: '0.04em',
                  }}
                >
                  {t('newsletter.landing.authorRole')}
                </div>
                <p
                  style={{
                    fontSize: 15,
                    color: 'var(--pb-muted)',
                    lineHeight: 1.6,
                    margin: '0 0 16px',
                    maxWidth: 520,
                  }}
                >
                  {t('newsletter.landing.authorBio')}
                </p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <Link
                    href={localePath('/about', locale)}
                    style={{
                      fontFamily: 'var(--font-jetbrains-var), monospace',
                      fontSize: 13,
                      color: 'var(--nl-accent)',
                      textDecoration: 'none',
                    }}
                  >
                    {t('newsletter.landing.authorMore')}
                  </Link>
                  <Link
                    href={localePath('/now', locale)}
                    style={{
                      fontFamily: 'var(--font-jetbrains-var), monospace',
                      fontSize: 13,
                      color: 'var(--pb-muted)',
                      textDecoration: 'none',
                    }}
                  >
                    {t('newsletter.landing.authorNow')}
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ── Suggestions section (Position A) ─────────────────────── */}
          <NewsletterDiscoverySection
            suggestions={suggestions}
            locale={locale}
            strings={suggestionStrings}
          />

          {/* ── FAQ section ──────────────────────────────────────────── */}
          {faqItems && faqItems.length > 0 && (
            <div className="nl-section" style={{ marginBottom: 72 }}>
              <FaqAccordion
                items={faqItems}
                sectionTitle={t('newsletter.landing.sectionFaq')}
                sectionId="section-faq"
              />
            </div>
          )}

          {/* ── Final CTA section ─────────────────────────────────────── */}
          <section
            className="nl-section"
            style={{
              background: 'var(--nl-accent)',
              borderRadius: 8,
              padding: '40px 36px',
              marginBottom: 40,
            }}
            aria-labelledby="section-final-cta"
          >
            <div className="nl-final-grid">
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-jetbrains-var), monospace',
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: accentTextColor,
                    opacity: 0.7,
                    marginBottom: 10,
                  }}
                >
                  {t('newsletter.landing.finalKicker')}
                </div>
                <h2
                  id="section-final-cta"
                  style={{
                    fontFamily: 'var(--font-fraunces-var), serif',
                    fontSize: 'clamp(28px, 4vw, 40px)',
                    fontWeight: 600,
                    color: accentTextColor,
                    margin: '0 0 10px',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {t('newsletter.landing.finalTitle').replace('{name}', type.name)}
                </h2>
                {cadenceLabel && (
                  <p
                    style={{
                      fontFamily: 'var(--font-jetbrains-var), monospace',
                      fontSize: 14,
                      color: accentTextColor,
                      opacity: 0.8,
                      margin: '0 0 8px',
                    }}
                  >
                    {t('newsletter.landing.finalSub').replace('{cadence}', cadenceLabel)}
                  </p>
                )}
                {subscriberCountStr && (
                  <p
                    style={{
                      fontFamily: 'var(--font-jetbrains-var), monospace',
                      fontSize: 12,
                      color: accentTextColor,
                      opacity: 0.7,
                      margin: 0,
                    }}
                  >
                    {t('newsletter.landing.finalSubscribers').replace(
                      '{count}',
                      subscriberCountStr,
                    )}
                  </p>
                )}
              </div>

              <div>
                <a
                  href="#form-hero"
                  style={{
                    display: 'inline-block',
                    padding: '14px 28px',
                    background: accentTextColor,
                    color: accentLight,
                    fontFamily: 'var(--font-jetbrains-var), monospace',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    borderRadius: 6,
                  }}
                >
                  {t('newsletter.landing.backToTopForm')}
                </a>
              </div>
            </div>
          </section>

          {/* ── Footer microcopy ─────────────────────────────────────── */}
          <footer
            style={{
              textAlign: 'center',
              borderTop: '1px dashed var(--pb-line)',
              paddingTop: 28,
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-jetbrains-var), monospace',
                fontSize: 12,
                color: 'var(--pb-muted)',
                marginBottom: 6,
              }}
            >
              {t('newsletter.landing.footerNote')}
            </p>
            <p
              style={{
                fontFamily: 'var(--font-jetbrains-var), monospace',
                fontSize: 11,
                color: 'var(--pb-faint)',
                marginBottom: 20,
              }}
            >
              {t('newsletter.landing.footerSub')}
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 24,
                flexWrap: 'wrap',
              }}
            >
              <Link
                href={localePath('/', locale)}
                style={{
                  fontFamily: 'var(--font-jetbrains-var), monospace',
                  fontSize: 12,
                  color: 'var(--pb-muted)',
                  textDecoration: 'none',
                }}
              >
                {t('newsletter.landing.backToHome')}
              </Link>

              {activeCount > 1 && (
                <Link
                  href={localePath('/newsletters', locale)}
                  style={{
                    fontFamily: 'var(--font-jetbrains-var), monospace',
                    fontSize: 12,
                    color: 'var(--nl-accent)',
                    textDecoration: 'none',
                  }}
                >
                  {t('newsletter.landing.allNewsletters')}
                </Link>
              )}
            </div>
          </footer>
        </main>

        {/* Mobile sticky CTA — client island */}
        <MobileStickyCTA
          formId="form-hero"
          label={t('newsletter.landing.submit')}
          accentColor={accentLight}
          accentTextColor={accentTextColor}
        />
      </div>
    )
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'newsletter-landing', slug },
    })
    throw err
  }
}
