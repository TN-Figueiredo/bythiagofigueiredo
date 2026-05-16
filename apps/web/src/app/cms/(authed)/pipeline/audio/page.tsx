import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'
import { AudioLibrary } from './_components/audio-library'

export const dynamic = 'force-dynamic'

export default async function AudioPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [assetsRes, totalRes, musicRes, sfxRes, downloadedRes, pendingRes, retiredRes] = await Promise.all([
    supabase
      .from('audio_assets')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('type', 'music'),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('type', 'sfx'),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'downloaded'),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'pending'),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'retired'),
  ])

  if (assetsRes.error) console.error('[audio] assets query:', assetsRes.error.message)

  const assets = (assetsRes.data ?? []) as AudioAssetRow[]
  const stats = {
    total: totalRes.count ?? 0,
    music: musicRes.count ?? 0,
    sfx: sfxRes.count ?? 0,
    downloaded: downloadedRes.count ?? 0,
    pending: pendingRes.count ?? 0,
    retired: retiredRes.count ?? 0,
  }

  return (
    <>
      <CmsTopbar title="Pipeline — Audio Library" />
      <div className="p-4 gem-pipeline-theme" style={{ height: 'calc(100vh - 6rem)', ...GEM_CSS_VARS } as React.CSSProperties}>
        <AudioLibrary initialAssets={assets} stats={stats} />
      </div>
    </>
  )
}
