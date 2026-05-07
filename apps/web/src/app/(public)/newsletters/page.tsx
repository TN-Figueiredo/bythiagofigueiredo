import { cookies, headers } from 'next/headers'
import type { Metadata } from 'next'
import { localePath } from '@/lib/i18n/locale-path'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { getActiveNewsletterTypesForHub } from '@/lib/newsletter/queries'
import { NewslettersHub } from './components/NewslettersHub'

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const isPt = locale === 'pt-BR'
  const description = isPt
    ? 'Newsletters do Thiago Figueiredo — escolhe o que cabe na sua frequência.'
    : 'Thiago Figueiredo\'s newsletters — pick what fits your frequency.'
  const ctx = await tryGetSiteContext()
  const host = h.get('host') ?? ctx?.primaryDomain ?? ''
  const config = ctx ? await getSiteSeoConfig(ctx.siteId, host).catch(() => null) : null
  const siteUrl = config?.siteUrl ?? `https://${host}`
  const ogImage = config?.defaultOgImageUrl ?? `${siteUrl}/og-default.png`
  return {
    title: 'Newsletters',
    description,
    alternates: {
      canonical: localePath('/newsletters', locale),
      languages: {
        en: '/newsletters',
        pt: '/pt/newsletters',
      },
    },
    openGraph: {
      type: 'website',
      siteName: config?.siteName ?? 'By Thiago Figueiredo',
      url: `${siteUrl}${localePath('/newsletters', locale)}`,
      title: `Newsletters — ${config?.siteName ?? 'By Thiago Figueiredo'}`,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'Newsletters' }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@tnFigueiredo',
      creator: '@tnFigueiredo',
    },
  }
}

export default async function NewslettersPage() {
  const cookieStore = await cookies()
  const currentTheme = cookieStore.get('btf_theme')?.value === 'light' ? 'light' : 'dark'
  const h = await headers()
  const locale = (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'

  const ctx = await tryGetSiteContext()
  const host = h.get('host') ?? ctx?.primaryDomain ?? ''
  const config = ctx ? await getSiteSeoConfig(ctx.siteId, host).catch(() => null) : null
  const breadcrumbGraph = config
    ? composeGraph([
        buildBreadcrumbNode([
          { name: locale === 'pt-BR' ? 'Início' : 'Home', url: config.siteUrl },
          { name: 'Newsletters', url: `${config.siteUrl}${localePath('/newsletters', locale)}` },
        ]),
      ])
    : null

  const types = ctx
    ? await getActiveNewsletterTypesForHub(ctx.siteId, locale)
    : []

  return (
    <>
      {breadcrumbGraph && <JsonLdScript graph={breadcrumbGraph} />}
      <NewslettersHub locale={locale} currentTheme={currentTheme} types={types} />
    </>
  )
}
