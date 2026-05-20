import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { LinktreeConfigSchema } from '@/app/go/linktree/_lib/types'
import type { LinktreePageData } from '@/app/go/linktree/_lib/types'
import {
  getSiteInfo,
  getDefaultAuthor,
  getLatestPost,
  getLatestVideo,
  getSocialProfiles,
  getNewsletterTypes,
  getYouTubeChannels,
} from '@/app/go/linktree/_lib/queries'
import { buildLangSections } from '@/app/go/linktree/_lib/build-sections'
import { LinktreeEditor } from './_components/linktree-editor'

export const dynamic = 'force-dynamic'

export default async function LinktreeEditorPage() {
  const { siteId } = await getSiteContext()
  const viewRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!viewRes.ok) redirect('/cms')

  const editRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const readOnly = !editRes.ok

  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('sites')
    .select('linktree_config, short_domain, primary_domain')
    .eq('id', siteId)
    .single()

  const parsed = LinktreeConfigSchema.safeParse(data?.linktree_config ?? {})
  const config = parsed.success ? parsed.data : LinktreeConfigSchema.parse({})
  const domain = data?.short_domain ?? data?.primary_domain ?? ''

  const [site, author] = await Promise.all([
    getSiteInfo(siteId),
    getDefaultAuthor(siteId),
  ])

  const defaultLocale = site.defaultLocale
  const [latestPost, latestVideo, socials, newsletters, channels] = await Promise.all([
    getLatestPost(siteId, defaultLocale).catch(() => null),
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

  const pageData: LinktreePageData = {
    config,
    site,
    author,
    latestPost,
    latestVideo,
    socials,
    sections,
    sharedLinks: config.shared_links,
  }

  return (
    <LinktreeEditor
      initialConfig={config}
      domain={domain}
      siteId={siteId}
      readOnly={readOnly}
      pageData={pageData}
    />
  )
}
