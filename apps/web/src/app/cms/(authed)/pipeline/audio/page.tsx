import { Suspense } from 'react'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'
import { AudioLibrary } from './_components/audio-library'
import { AudioErrorBoundary } from './_components/audio-error-boundary'
import { AudioGridSkeleton } from './_components/audio-skeleton'

export const dynamic = 'force-dynamic'

export default async function AudioPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const PAGE_SIZE = 50
  const [assetsRes, totalRes, musicRes, sfxRes, downloadedRes, pendingRes, retiredRes, tagsRes] = await Promise.all([
    supabase
      .from('audio_assets')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('type', 'music'),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('type', 'sfx'),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'downloaded'),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'pending'),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'retired'),
    supabase.from('audio_assets').select('tags').eq('site_id', siteId).neq('status', 'retired'),
  ])

  if (assetsRes.error) console.error('[audio] assets query:', assetsRes.error.message)
  if (tagsRes.error) console.error('[audio] tags query:', tagsRes.error.message)

  const rawAssets = (assetsRes.data ?? []) as AudioAssetRow[]
  const initialHasNext = rawAssets.length > PAGE_SIZE
  const assets = initialHasNext ? rawAssets.slice(0, PAGE_SIZE) : rawAssets
  const initialNextCursor = initialHasNext ? assets[assets.length - 1]?.id ?? null : null

  const allTagsSet = new Set<string>()
  for (const row of tagsRes.data ?? []) {
    for (const t of (row.tags as string[]) ?? []) allTagsSet.add(t)
  }
  const allTags = Array.from(allTagsSet).sort()

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
        <AudioErrorBoundary>
          <Suspense fallback={<div style={{ padding: 24 }}><AudioGridSkeleton /></div>}>
            <AudioLibrary initialAssets={assets} stats={stats} initialHasNext={initialHasNext} initialNextCursor={initialNextCursor} allTags={allTags} />
          </Suspense>
        </AudioErrorBoundary>
      </div>
    </>
  )
}
