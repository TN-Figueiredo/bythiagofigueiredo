import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateYoutubeMetadata } from '@/lib/seo/page-metadata'
import { buildBreadcrumbNode, buildVideoNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getYouTubePageData } from '@/lib/youtube/queries'
import { getPageContent } from '@/lib/content/fetch'
import type { YouTubeStrings } from '@/lib/content/types'
import { YOUTUBE_EN } from '@/lib/content/defaults/youtube-en'
import { YOUTUBE_PT } from '@/lib/content/defaults/youtube-pt'
import { YouTubePageClient } from './youtube-page-client'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await tryGetSiteContext()
  if (!ctx) return {}
  const h = await headers()
  const host = h.get('host') ?? ''
  const config = await getSiteSeoConfig(ctx.siteId, host)
  const locale = (h.get('x-locale') ?? 'en') === 'pt-BR' ? 'pt' : 'en'
  return generateYoutubeMetadata(config, locale)
}

export default async function YouTubePage() {
  const ctx = await tryGetSiteContext()
  if (!ctx) return null
  const h = await headers()
  const host = h.get('host') ?? ''
  const config = await getSiteSeoConfig(ctx.siteId, host)
  const data = await getYouTubePageData(ctx.siteId)
  const rawLocale = (h.get('x-locale') ?? 'en') as string
  const locale = rawLocale === 'pt-BR' ? 'pt' : 'en'
  const isEn = locale === 'en'

  const strings = await getPageContent<YouTubeStrings>(
    ctx.siteId, 'youtube', rawLocale === 'pt-BR' ? 'pt-BR' : 'en',
    { en: YOUTUBE_EN, pt: YOUTUBE_PT },
  )

  // JSON-LD: BreadcrumbList + VideoObject nodes
  const breadcrumb = buildBreadcrumbNode([
    { name: isEn ? 'Home' : 'Início', url: config.siteUrl },
    { name: isEn ? 'Videos' : 'Vídeos', url: `${config.siteUrl}/youtube` },
  ])

  const videoNodes = data.videos.slice(0, 30).map((v) => {
    const isoSeconds = v.durationSeconds
    const hours = Math.floor(isoSeconds / 3600)
    const mins = Math.floor((isoSeconds % 3600) / 60)
    const secs = isoSeconds % 60
    const isoDuration = `PT${hours > 0 ? `${hours}H` : ''}${mins}M${secs}S`

    return buildVideoNode({
      name: v.title,
      description: v.description ?? v.title,
      thumbnailUrl: v.thumbnailHqUrl ?? v.thumbnailUrl ?? `${config.siteUrl}/og-default.png`,
      uploadDate: v.publishedAt,
      duration: isoDuration,
      embedUrl: `https://www.youtube.com/embed/${v.youtubeVideoId}`,
    })
  })

  const graph = composeGraph([breadcrumb, ...videoNodes])

  return (
    <>
      <JsonLdScript graph={graph} />
      <YouTubePageClient data={data} locale={locale} strings={strings} />
    </>
  )
}
