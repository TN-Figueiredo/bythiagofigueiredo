import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { INSTAGRAM_STATE_LABEL, deriveHmacKey, verifyState } from '@/lib/oauth/state'
import { getVaultKeyOrNull } from '@/lib/instagram/token'
import { SettingsConnected } from './settings-connected'

export const dynamic = 'force-dynamic'
// `Sync Now` (triggerInstagramSync) roda EM PROCESSO neste segmento: um feed
// grande passa da duração-padrão de função do projeto (60 s no Pro).
// A herança do segment config pela server action é a premissa medida pelo
// gate depois de A (spec §7) — precedentes: social/stories/new/page.tsx:21,
// youtube/competitors/page.tsx:27.
export const maxDuration = 120

interface Props {
  searchParams: Promise<{ section?: string }>
}

export default async function SettingsPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId, timezone } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')
  const userId = authRes.user.id

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
      .select('id, locale, handle, sync_enabled, display_slots, layout_type, section_title_pt, section_title_en, section_subtitle_pt, section_subtitle_en, last_synced_at, token_expires_at, token_error, token_error_at, token_error_mode, token_refreshed_at, token_alert_sent_at, ig_user_id, ig_user_id_source')
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

  // `connected` por linha sem trazer o token para o cliente: uma segunda query
  // cita `access_token` num filtro, nunca numa projeção (ratchet em
  // test/cms/settings/page-no-token-leak.test.ts).
  const { data: connectedRows } = await supabase
    .from('instagram_accounts')
    .select('id')
    .eq('site_id', siteId)
    .not('access_token', 'is', null)
  const connectedIds = new Set((connectedRows ?? []).map((r) => r.id))

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
        connected: connectedIds.has(acc.id),
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

  const missingInstagramEnv = (['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'] as const)
    .filter((k) => !process.env[k])
  if (getVaultKeyOrNull() === null) missingInstagramEnv.push('SOCIAL_MASTER_KEY' as never)
  const instagramOAuthConfigured = missingInstagramEnv.length === 0
  const isPreview = process.env.VERCEL_ENV === 'preview'

  // Banner de mismatch: só quando o cookie assinado casa site, usuário E linha.
  let instagramHandleMismatch: { accountId: string; authorizedHandle: string } | null = null
  const masterKey = process.env.SOCIAL_MASTER_KEY
  if (masterKey) {
    const jar = await cookies()
    const rawMismatch =
      jar.get('__Secure-ig_handle_mismatch')?.value ?? jar.get('ig_handle_mismatch')?.value ?? null
    if (rawMismatch) {
      const p = verifyState(rawMismatch, deriveHmacKey(masterKey, INSTAGRAM_STATE_LABEL), {
        typ: 'mismatch', requireExp: true,
      })
      if (p?.siteId === siteId && p.userId === userId && p.accountId && p.authorizedHandle) {
        instagramHandleMismatch = { accountId: p.accountId, authorizedHandle: p.authorizedHandle }
      }
    }
  }

  return (
    <div>
      <CmsTopbar title="Settings" />
      <SettingsConnected
        site={siteRes.data}
        newsletterTypes={typesRes.data ?? []}
        blogCadence={cadenceRes.data ?? []}
        instagramAccounts={instagramData}
        instagramOAuthConfigured={instagramOAuthConfigured}
        missingInstagramEnv={missingInstagramEnv}
        isPreview={isPreview}
        instagramHandleMismatch={instagramHandleMismatch}
        siteTimezone={timezone}
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
