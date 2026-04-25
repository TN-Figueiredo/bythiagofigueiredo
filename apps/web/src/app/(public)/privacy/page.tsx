import { headers } from 'next/headers'
import { LegalShell } from '@/components/legal/legal-shell'
import type { Metadata } from 'next'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateLegalMetadata } from '@/lib/seo/page-metadata'
import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { localePath } from '@/lib/i18n/locale-path'

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const ctx = await tryGetSiteContext()
  if (!ctx) {
    return {
      title: locale === 'en' ? 'Privacy Policy' : 'Política de Privacidade',
      alternates: { canonical: localePath('/privacy', locale) },
      robots: { index: true, follow: true },
    }
  }
  const host = h.get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    return generateLegalMetadata(config, 'privacy', locale)
  } catch {
    return {
      title: locale === 'en' ? 'Privacy Policy' : 'Política de Privacidade',
      alternates: { canonical: localePath('/privacy', locale) },
      robots: { index: true, follow: true },
    }
  }
}

export default async function PrivacyPage() {
  const h = await headers()
  const locale = (h.get('x-locale') ?? 'en') as 'pt-BR' | 'en'
  const { default: MDXContent } =
    locale === 'en'
      ? await import('@/content/legal/privacy.en.mdx')
      : await import('@/content/legal/privacy.pt-BR.mdx')

  // Breadcrumb JSON-LD — Home -> Privacy. URLs are absolute (built from the
  // resolved site URL) so Google validates the breadcrumb with canonical hosts.
  const ctx = await tryGetSiteContext()
  const host = h.get('host') ?? ctx?.primaryDomain ?? ''
  const config = ctx
    ? await getSiteSeoConfig(ctx.siteId, host).catch(() => null)
    : null
  const breadcrumbGraph = config
    ? composeGraph([
        buildBreadcrumbNode([
          { name: 'Home', url: config.siteUrl },
          {
            name: locale === 'en' ? 'Privacy Policy' : 'Política de Privacidade',
            url: `${config.siteUrl}${localePath('/privacy', locale)}`,
          },
        ]),
      ])
    : null

  return (
    <>
      {breadcrumbGraph && <JsonLdScript graph={breadcrumbGraph} />}
      <LegalShell locale={locale} lastUpdated="2026-04-16">
        <MDXContent />
      </LegalShell>
    </>
  )
}
