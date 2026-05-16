import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [totalRes, musicRes, sfxRes, downloadedRes, pendingRes, retiredRes, recentRes, usageRes] = await Promise.all([
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', auth.siteId),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', auth.siteId).eq('type', 'music'),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', auth.siteId).eq('type', 'sfx'),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', auth.siteId).eq('status', 'downloaded'),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', auth.siteId).eq('status', 'pending'),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', auth.siteId).eq('status', 'retired'),
    supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', auth.siteId).gte('created_at', thirtyDaysAgo),
    supabase.from('audio_asset_usage').select('audio_asset_id').eq('site_id', auth.siteId).limit(10000),
  ])

  // For most_used, we still need usage data but just the top 10
  const usageList = (usageRes.data ?? []).map(r => r.audio_asset_id as string)
  const usageCount: Record<string, number> = {}
  for (const uid of usageList) usageCount[uid] = (usageCount[uid] ?? 0) + 1
  const topUsedIds = Object.entries(usageCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  let most_used: Array<{ asset_id: string; track_name: string | null; usage_count: number }> = []
  if (topUsedIds.length > 0) {
    const ids = topUsedIds.map(([id]) => id)
    const { data: topAssets } = await supabase
      .from('audio_assets')
      .select('id, asset_id, track_name')
      .eq('site_id', auth.siteId)
      .in('id', ids)
    const assetMap = new Map((topAssets ?? []).map(a => [a.id, a]))
    most_used = topUsedIds.map(([id, count]) => {
      const a = assetMap.get(id)
      return { asset_id: a?.asset_id ?? id, track_name: a?.track_name ?? null, usage_count: count }
    })
  }

  const total = totalRes.count ?? 0
  const by_status = {
    downloaded: downloadedRes.count ?? 0,
    pending: pendingRes.count ?? 0,
    retired: retiredRes.count ?? 0,
  }

  return NextResponse.json({
    data: {
      total,
      by_type: { music: musicRes.count ?? 0, sfx: sfxRes.count ?? 0 },
      by_status,
      most_used,
      recently_added: recentRes.count ?? 0,
      needs_download: by_status.pending,
      unused: total - new Set(usageList).size,
    },
  }, { headers: buildRateLimitHeaders(auth) })
}
