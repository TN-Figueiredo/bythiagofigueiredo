import { headers, cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { LinktreeClient } from './_components/linktree-client'
import {
  getLinktreeConfig,
  getSiteInfo,
  getDefaultAuthor,
  getLatestPost,
  getLatestVideo,
  getSocialProfiles,
  getNewsletterTypes,
  getYouTubeChannels,
} from './_lib/queries'
import { buildLangSections } from './_lib/build-sections'

export const revalidate = 3600

export default async function LinktreePage() {
  const hdrs = await headers()
  const ckies = await cookies()
  const siteId = hdrs.get('x-site-id')
  const locale = hdrs.get('x-locale') || 'pt-BR'

  if (!siteId) notFound()

  const [config, site, author] = await Promise.all([
    getLinktreeConfig(siteId),
    getSiteInfo(siteId),
    getDefaultAuthor(siteId),
  ])

  const [latestPost, latestVideo, socials, newsletters, channels] = await Promise.all([
    getLatestPost(siteId, locale).catch(() => null),
    getLatestVideo(siteId).catch(() => null),
    getSocialProfiles(siteId).catch(() => []),
    getNewsletterTypes(siteId).catch(() => []),
    getYouTubeChannels(siteId).catch(() => []),
  ])

  const sections = buildLangSections(
    site.supportedLocales,
    newsletters,
    channels,
    config,
    site.primaryDomain,
  )

  return (
    <LinktreeClient
      initialLocale={locale}
      initialTheme={ckies.get('btf_theme')?.value || 'system'}
      config={config}
      site={site}
      author={author}
      latestPost={latestPost}
      latestVideo={latestVideo}
      socials={socials}
      sections={sections}
      sharedLinks={config.shared_links}
    />
  )
}
