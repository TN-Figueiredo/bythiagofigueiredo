import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import { CookieBanner } from '@/components/lgpd/cookie-banner'
import { CookieBannerTrigger } from '@/components/lgpd/cookie-banner-trigger'
import { CookieBannerProvider } from '@/components/lgpd/cookie-banner-context'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateRootMetadata } from '@/lib/seo/page-metadata'
import {
  buildWebSiteNode,
  buildPersonNode,
  buildOrgNode,
} from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { TopStrip } from '@/components/layout/top-strip'
import { GlobalHeader } from '@/components/layout/global-header'
import { PinboardFooter } from './components/PinboardFooter'
import enStrings from '../../locales/en.json'
import ptBrStrings from '../../locales/pt-BR.json'

/**
 * Sprint 5b PR-C C.2 — resolve per-site root metadata via the SEO factory
 * instead of the previous hardcoded strings on `app/layout.tsx`. Falls back
 * to a minimal Metadata object when site context is unresolved (preview hosts
 * not bound to a site row, or dev `.localhost` without a matching site).
 * Per-page metadata (blog, campaigns, legal, contact) still overrides these
 * defaults through its own `generateMetadata` export.
 */
export async function generateMetadata(): Promise<Metadata> {
  const ctx = await tryGetSiteContext()
  if (!ctx) return {}
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    const meta = generateRootMetadata(config)
    return {
      ...meta,
      alternates: {
        ...meta.alternates,
        types: { 'application/rss+xml': '/feed.xml' },
      },
    }
  } catch {
    return {}
  }
}

/**
 * Public (unauthenticated) layout — applies to home, blog, campaigns, privacy,
 * terms, contact, etc. Intentionally NOT applied to /admin, /cms, /account.
 *
 * Sprint 5a Track E wires the LGPD cookie banner + re-open trigger gated by
 * `NEXT_PUBLIC_LGPD_BANNER_ENABLED` so they can be rolled out / rolled back
 * without a redeploy. The provider itself is always mounted (so pages like
 * `/account/settings/privacy` that invoke `useCookieConsent()` work even when
 * the banner UI is disabled); only the banner + trigger are flag-gated.
 *
 * Sprint 5b PR-C C.2 mounts a `<JsonLdScript>` with the root WebSite +
 * Person/Organization nodes on every public page. The identity node kind
 * (Person vs Organization) is driven by `sites.identity_type` via
 * `config.identityType`. Identity nodes are skipped when the matching profile
 * is absent (e.g. preview host with no identity registered) so we never emit
 * malformed structured data.
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const lgpdBannerEnabled = process.env.NEXT_PUBLIC_LGPD_BANNER_ENABLED === 'true'
  const ctx = await tryGetSiteContext()
  const host = (await headers()).get('host') ?? ctx?.primaryDomain ?? ''
  const config = ctx
    ? await getSiteSeoConfig(ctx.siteId, host).catch(() => null)
    : null

  const cookieStore = await cookies()
  const theme = cookieStore.get('btf_theme')?.value === 'light' ? 'light' : 'dark'
  const locale = (ctx?.defaultLocale ?? 'en') as 'en' | 'pt-BR'
  const t = (locale === 'pt-BR' ? ptBrStrings : enStrings) as Record<string, string>

  const rootNodes = config
    ? [
        buildWebSiteNode(config),
        ...(config.identityType === 'person' && config.personIdentity
          ? [buildPersonNode(config, config.personIdentity)]
          : []),
        ...(config.identityType === 'organization' && config.orgIdentity
          ? [buildOrgNode(config, config.orgIdentity)]
          : []),
      ]
    : []

  return (
    <CookieBannerProvider>
      <div className="min-h-screen" style={{ background: 'var(--pb-bg)', color: 'var(--pb-ink)', paddingTop: 44 }}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-pb-accent text-white px-4 py-2 rounded z-50">
          {locale === 'pt-BR' ? 'Ir para o conteúdo' : 'Skip to content'}
        </a>
        <TopStrip locale={locale} />
        <GlobalHeader
          locale={locale}
          currentTheme={theme}
          current="home"
          variant="full"
          ctas="home"
          t={t}
        />
        {rootNodes.length > 0 && <JsonLdScript graph={composeGraph(rootNodes)} />}
        {children}
        <PinboardFooter locale={locale} t={t} />
        {lgpdBannerEnabled && (
          <>
            <CookieBanner />
            <CookieBannerTrigger />
          </>
        )}
      </div>
    </CookieBannerProvider>
  )
}
