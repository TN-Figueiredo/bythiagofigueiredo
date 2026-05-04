import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getAboutData } from '@/lib/about/queries'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateAboutMetadata } from '@/lib/seo/page-metadata'
import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { AboutHero } from './components/AboutHero'
import { Polaroid } from './components/Polaroid'
import { AboutContent } from './components/AboutContent'
import { CtaBlock } from './components/CtaBlock'
import './about.css'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await tryGetSiteContext()
  if (!ctx) return {}
  const h = await headers()
  const host = h.get('host') ?? ''
  const config = await getSiteSeoConfig(ctx.siteId, host)
  const about = await getAboutData(ctx.siteId)
  if (!about) return {}
  return generateAboutMetadata(config, about.subtitle, about.about_photo_url)
}

export default async function AboutPage() {
  const ctx = await tryGetSiteContext()
  if (!ctx) notFound()

  const about = await getAboutData(ctx.siteId)
  if (!about) notFound()

  const h = await headers()
  const host = h.get('host') ?? ''
  const config = await getSiteSeoConfig(ctx.siteId, host)

  const breadcrumb = buildBreadcrumbNode([
    { name: 'Home', url: config.siteUrl },
    { name: 'About', url: `${config.siteUrl}/about` },
  ])
  const graph = composeGraph([breadcrumb])

  return (
    <div className="about-page">
      <JsonLdScript graph={graph} />

      {about.headline && <AboutHero headline={about.headline} />}

      <section className="about-grid">
        {about.about_photo_url && (
          <Polaroid
            photoUrl={about.about_photo_url}
            caption={about.photo_caption}
            location={about.photo_location}
            displayName={about.display_name}
          />
        )}

        <AboutContent
          subtitle={about.subtitle}
          aboutCompiled={about.about_compiled}
          aboutMd={about.about_md}
        />
      </section>

      {about.about_cta_links?.links?.length ? (
        <CtaBlock
          kicker={about.about_cta_links.kicker}
          signature={about.about_cta_links.signature}
          links={about.about_cta_links.links}
          socialLinks={about.social_links}
        />
      ) : null}
    </div>
  )
}
