import { headers } from 'next/headers'
import type { Metadata } from 'next'
import en from '@/locales/en.json'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateRootMetadata } from '@/lib/seo/page-metadata'
import { PinboardHome } from './components/PinboardHome'

// Sprint 5b PR-C C.3 — home metadata now flows through the SEO factory so
// that site name / twitter handle / metadataBase stay in sync with the
// per-site config. The public layout also emits root metadata; keeping a
// page-level generateMetadata lets the home title override the root
// template default when we want (currently identical — title comes from
// the site name default, but the locale JSON hero headline remains in
// page content). Structured data for the root (WebSite + Person/Org) is
// emitted by the public layout and dedup'd via composeGraph(@id), so we
// intentionally do NOT mount an additional <JsonLdScript> here.
export async function generateMetadata(): Promise<Metadata> {
  const ctx = await tryGetSiteContext()
  if (!ctx) return { title: (en as unknown as Record<string, string>)['meta.title'] }
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    return generateRootMetadata(config)
  } catch {
    return { title: (en as unknown as Record<string, string>)['meta.title'] }
  }
}

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Home({ searchParams }: HomeProps) {
  const h = await headers()
  const locale = (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'
  const sp = await searchParams
  const showInsufficientAccess = sp.error === 'insufficient_access'
  return (
    <>
      {showInsufficientAccess && (
        <div
          role="alert"
          aria-live="polite"
          data-testid="insufficient-access-banner"
          style={{
            background: '#fef3c7',
            color: '#92400e',
            padding: '12px 16px',
            borderBottom: '1px solid #f59e0b',
            textAlign: 'center',
          }}
        >
          Você não tem acesso a essa área.
        </div>
      )}
      <PinboardHome locale={locale} />
    </>
  )
}
