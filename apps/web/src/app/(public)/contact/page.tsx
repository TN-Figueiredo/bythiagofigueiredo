import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateContactMetadata } from '@/lib/seo/page-metadata'
import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { localePath } from '@/lib/i18n/locale-path'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getDefaultSettings, DEFAULT_VISIBILITY } from '@/lib/contact/defaults'
import type { ContactPageSettings, ContactPageVisibility, ContactAuthorData } from '@/lib/contact/types'
import { HeroSection } from './_components/hero-section'
import { SocialLinksColumn } from './_components/social-links-column'
import { FaqSection } from './_components/faq-section'
import { ContactFormCard } from './_components/contact-form-card'
import { SuccessState } from './_components/success-state'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const ctx = await tryGetSiteContext()
  if (!ctx) {
    return {
      title: locale === 'en' ? 'Contact' : 'Fale comigo',
      alternates: { canonical: localePath('/contact', locale) },
      robots: { index: true, follow: true },
    }
  }
  const host = h.get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    return generateContactMetadata(config, locale)
  } catch {
    return {
      title: locale === 'en' ? 'Contact' : 'Fale comigo',
      alternates: { canonical: localePath('/contact', locale) },
      robots: { index: true, follow: true },
    }
  }
}

const errorMessages: Record<string, string> = {
  validation_error: 'Dados inválidos. Verifique os campos e tente novamente.',
  bot_check_failed: 'Verificação anti-bot falhou. Recarregue a página e tente novamente.',
  submit_failed: 'Erro ao enviar. Por favor, tente novamente.',
  rate_limited: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
}

interface Props {
  searchParams: Promise<{ notice?: string; error?: string }>
}

export default async function ContactPage({ searchParams }: Props) {
  const { notice, error } = await searchParams
  const noticeMessage = notice != null ? (notice === 'contact_received' ? notice : null) : null
  const errorMessage = error != null ? (errorMessages[error] ?? null) : null

  const ctx = await tryGetSiteContext()
  const h = await headers()
  const locale = (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'
  const host = h.get('host') ?? ctx?.primaryDomain ?? ''

  const config = ctx
    ? await getSiteSeoConfig(ctx.siteId, host).catch(() => null)
    : null
  const breadcrumbGraph = config
    ? composeGraph([
        buildBreadcrumbNode([
          { name: locale === 'pt-BR' ? 'Início' : 'Home', url: config.siteUrl },
          { name: locale === 'en' ? 'Contact' : 'Contato', url: `${config.siteUrl}${localePath('/contact', locale)}` },
        ]),
      ])
    : null

  // Fetch CMS data in parallel; fall back to defaults when no config
  const defaults = getDefaultSettings(locale)
  let settings: ContactPageSettings = { ...defaults, id: '', site_id: ctx?.siteId ?? '', locale }
  let visibility: ContactPageVisibility = { ...DEFAULT_VISIBILITY, id: '', site_id: ctx?.siteId ?? '' }
  let authorData: ContactAuthorData | null = null

  if (ctx) {
    const supabase = getSupabaseServiceClient()
    const [settingsRes, visRes, authorRes] = await Promise.all([
      supabase
        .from('contact_page_settings')
        .select('*')
        .eq('site_id', ctx.siteId)
        .eq('locale', locale)
        .maybeSingle(),
      supabase
        .from('contact_page_visibility')
        .select('*')
        .eq('site_id', ctx.siteId)
        .maybeSingle(),
      supabase
        .from('authors')
        .select('name, avatar_url, social_links, author_about_translations!inner(locale, headline)')
        .eq('site_id', ctx.siteId)
        .eq('is_default', true)
        .eq('author_about_translations.locale', locale)
        .maybeSingle(),
    ])

    if (settingsRes.data) {
      settings = settingsRes.data as unknown as ContactPageSettings
    }
    if (visRes.data) {
      visibility = visRes.data as unknown as ContactPageVisibility
    }
    if (authorRes.data) {
      authorData = {
        name: authorRes.data.name,
        avatar_url: authorRes.data.avatar_url,
        social_links: (authorRes.data.social_links as Record<string, string>) ?? {},
        headline: (authorRes.data.author_about_translations as Array<{ locale: string; headline: string | null }>)?.[0]?.headline ?? null,
        bio: (authorRes.data.author_about_translations as Array<{ locale: string; headline: string | null }>)?.[0]?.headline ?? null,
      }
    }
  }

  return (
    <>
      {breadcrumbGraph && <JsonLdScript graph={breadcrumbGraph} />}
      <main className="max-w-[920px] mx-auto px-7 py-12">
        {noticeMessage ? (
          <SuccessState locale={locale} />
        ) : (
          <>
            {errorMessage && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-6 rounded-lg px-4 py-3 text-sm bg-red-900/20 text-red-400 border border-red-800/30"
              >
                {errorMessage}
              </div>
            )}

            <HeroSection settings={settings} visibility={visibility} author={authorData} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-8">
              <SocialLinksColumn visibility={visibility} author={authorData} locale={locale} />
              <ContactFormCard settings={settings} visibility={visibility} locale={locale} />
            </div>

            {visibility.show_faq && settings.faq_items.length > 0 && (
              <FaqSection items={settings.faq_items} locale={locale} />
            )}
          </>
        )}
      </main>
    </>
  )
}
