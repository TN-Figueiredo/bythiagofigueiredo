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

  const [assetsRes, statsRes] = await Promise.all([
    supabase
      .from('audio_assets')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('audio_assets')
      .select('type, status')
      .eq('site_id', siteId),
  ])

  if (assetsRes.error) console.error('[audio] assets query:', assetsRes.error.message)
  if (statsRes.error) console.error('[audio] stats query:', statsRes.error.message)

  const assets = (assetsRes.data ?? []) as AudioAssetRow[]
  const statsRows = (statsRes.data ?? []) as Array<{ type: string; status: string }>

  const stats = { total: 0, music: 0, sfx: 0, downloaded: 0, pending: 0, retired: 0 }
  for (const row of statsRows) {
    stats.total++
    if (row.type === 'music') stats.music++
    else stats.sfx++
    if (row.status === 'downloaded') stats.downloaded++
    else if (row.status === 'pending') stats.pending++
    else if (row.status === 'retired') stats.retired++
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
