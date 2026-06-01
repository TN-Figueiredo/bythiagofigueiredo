import { redirect } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { SettingsConnected } from './settings-connected'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ section?: string }>
}

export default async function SettingsPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const editRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const readOnly = !editRes.ok

  const supabase = getSupabaseServiceClient()
  const [siteRes, typesRes, cadenceRes, igAccountsRes, contactSettingsRes, contactVisRes, defaultAuthorRes] = await Promise.all([
    supabase.from('sites').select('*').eq('id', siteId).single(),
    supabase
      .from('newsletter_types')
      .select('*')
      .eq('site_id', siteId)
      .order('sort_order'),
    supabase
      .from('blog_cadence')
      .select('*')
      .eq('site_id', siteId)
      .order('locale'),
    supabase.from('instagram_accounts')
      .select('id, locale, handle, sync_enabled, display_slots, layout_type, section_title_pt, section_title_en, section_subtitle_pt, section_subtitle_en, last_synced_at, token_expires_at')
      .eq('site_id', siteId)
      .order('locale'),
    supabase
      .from('contact_page_settings')
      .select('*')
      .eq('site_id', siteId),
    supabase
      .from('contact_page_visibility')
      .select('*')
      .eq('site_id', siteId)
      .maybeSingle(),
    supabase
      .from('authors')
      .select('id, name, avatar_url, social_links, author_about_translations(locale, headline)')
      .eq('site_id', siteId)
      .eq('is_default', true)
      .maybeSingle(),
  ])

  const instagramData = await Promise.all(
    (igAccountsRes.data ?? []).map(async (acc) => {
      const [postsRes, slotsRes, logsRes] = await Promise.all([
        supabase.from('instagram_posts')
          .select('id, cached_image_url, caption')
          .eq('account_id', acc.id)
          .order('ig_timestamp', { ascending: false })
          .limit(50),
        supabase.from('instagram_feed_slots')
          .select('id, position, post_id')
          .eq('account_id', acc.id)
          .order('position'),
        supabase.from('instagram_sync_log')
          .select('mode, status, posts_found, posts_inserted, posts_updated, created_at, error_message')
          .eq('account_id', acc.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      const posts = postsRes.data ?? []
      const rawSlots = slotsRes.data ?? []
      const postMap = new Map(posts.map(p => [p.id, p]))

      return {
        ...acc,
        posts,
        sync_logs: logsRes.data ?? [],
        slots: rawSlots.map(s => ({
          ...s,
          thumbnail_url: s.post_id ? postMap.get(s.post_id)?.cached_image_url ?? null : null,
          caption: s.post_id ? postMap.get(s.post_id)?.caption ?? null : null,
        })),
      }
    }),
  )

  const seoFlags = {
    aiCrawlersBlocked: process.env.SEO_AI_CRAWLERS_BLOCKED === 'true',
  }

  return (
    <div>
      <CmsTopbar title="Settings" />
      <SettingsConnected
        site={siteRes.data}
        newsletterTypes={typesRes.data ?? []}
        blogCadence={cadenceRes.data ?? []}
        instagramAccounts={instagramData}
        contactSettings={contactSettingsRes.data ?? []}
        contactVisibility={contactVisRes.data ?? null}
        defaultAuthor={defaultAuthorRes.data ?? null}
        initialSection={params.section ?? 'branding'}
        seoFlags={seoFlags}
        readOnly={readOnly}
      />
    </div>
  )
}
