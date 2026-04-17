import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Header from './components/Header'
import Hero from './components/Hero'
import SocialLinks from './components/SocialLinks'
import Footer from './components/Footer'
import en from '@/locales/en.json'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateRootMetadata } from '@/lib/seo/page-metadata'

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
  if (!ctx) return { title: (en as Record<string, string>)['meta.title'] }
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    return generateRootMetadata(config)
  } catch {
    return { title: (en as Record<string, string>)['meta.title'] }
  }
}

const links = [
  { platform: 'instagram', url: 'https://www.instagram.com/thiagonfigueiredo', label: 'Instagram' },
  { platform: 'youtube_en', url: 'https://www.youtube.com/@bythiagofigueiredo', label: 'YouTube (EN)' },
  { platform: 'youtube_pt', url: 'https://www.youtube.com/@thiagonfigueiredo', label: 'YouTube (PT)' },
]

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Home({ searchParams }: HomeProps) {
  const t = en as Record<string, string>
  // requireArea redirects here with ?error=insufficient_access when a user
  // lacks access to the admin/cms area they tried to reach. Render a
  // dismissible-feel banner (reload clears the URL param) so the user gets
  // a clear reason instead of a silent bounce.
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
      <Header />
      <Hero headline={t['hero.headline']!} subheadline={t['hero.subheadline']!} />
      <section className="text-center p-[var(--spacing-lg)]">
        <h2>{t['social.title']}</h2>
        <SocialLinks links={links} />
      </section>
      <Footer note={t['footer.note']!} />
    </>
  )
}
