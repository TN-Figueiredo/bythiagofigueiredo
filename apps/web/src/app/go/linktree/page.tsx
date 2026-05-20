import { headers, cookies } from 'next/headers'
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

export const revalidate = 300

export default async function LinktreePage() {
  const hdrs = await headers()
  const ckies = await cookies()
  const siteId = hdrs.get('x-site-id')
  const locale = hdrs.get('x-locale') || 'pt-BR'

  if (!siteId) {
    return (
      <div className="min-h-dvh bg-[#14110B] flex items-center justify-center text-[#F0E8D6]">
        <p>Site not found</p>
      </div>
    )
  }

  const [config, site, author, latestPost, latestVideo, socials, newsletters, channels] =
    await Promise.all([
      getLinktreeConfig(siteId),
      getSiteInfo(siteId),
      getDefaultAuthor(siteId),
      getLatestPost(siteId, locale),
      getLatestVideo(siteId),
      getSocialProfiles(siteId),
      getNewsletterTypes(siteId),
      getYouTubeChannels(siteId),
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
