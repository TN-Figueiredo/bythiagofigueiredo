import { cookies, headers } from 'next/headers'
import { LegalShell } from '@/components/legal/legal-shell'
import type { Metadata } from 'next'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateLegalMetadata } from '@/lib/seo/page-metadata'
import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'

function negotiateLocale(acceptLang: string | null, cookieLocale: string | null) {
  if (cookieLocale && ['pt-BR', 'en'].includes(cookieLocale)) return cookieLocale as 'pt-BR' | 'en'
  if (!acceptLang) return 'pt-BR' as const
  const lang = acceptLang.split(',')[0]?.split('-')[0]?.toLowerCase()
  return lang === 'en' ? ('en' as const) : ('pt-BR' as const)
}

// Sprint 5b PR-C C.3 — replace the artisan generateMetadata with
// generateLegalMetadata(config, 'privacy', locale) so the site name,
// Twitter handle, metadataBase, and canonical path are driven by the
// per-site SEO config. Locale is negotiated server-side to match the
// MDX import below.
export async function generateMetadata(): Promise<Metadata> {
  const locale = negotiateLocale(
    (await headers()).get('accept-language'),
    (await cookies()).get('preferred_locale')?.value ?? null,
  )
  const ctx = await tryGetSiteContext()
  if (!ctx) {
    return {
      title: locale === 'en' ? 'Privacy Policy' : 'Política de Privacidade',
      alternates: { canonical: '/privacy' },
      robots: { index: true, follow: true },
    }
  }
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    return generateLegalMetadata(config, 'privacy', locale)
  } catch {
    return {
      title: locale === 'en' ? 'Privacy Policy' : 'Política de Privacidade',
      alternates: { canonical: '/privacy' },
      robots: { index: true, follow: true },
    }
  }
}

export default async function PrivacyPage() {
  const locale = negotiateLocale(
    (await headers()).get('accept-language'),
    (await cookies()).get('preferred_locale')?.value ?? null
  )
  const { default: MDXContent } =
    locale === 'en'
      ? await import('@/content/legal/privacy.en.mdx')
      : await import('@/content/legal/privacy.pt-BR.mdx')

  // Breadcrumb JSON-LD — Home -> Privacy. URLs are absolute (built from the
  // resolved site URL) so Google validates the breadcrumb with canonical hosts.
  const ctx = await tryGetSiteContext()
  const host = (await headers()).get('host') ?? ctx?.primaryDomain ?? ''
  const config = ctx
    ? await getSiteSeoConfig(ctx.siteId, host).catch(() => null)
    : null
  const breadcrumbGraph = config
    ? composeGraph([
        buildBreadcrumbNode([
          { name: 'Home', url: config.siteUrl },
          {
            name: locale === 'en' ? 'Privacy Policy' : 'Política de Privacidade',
            url: `${config.siteUrl}/privacy`,
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
