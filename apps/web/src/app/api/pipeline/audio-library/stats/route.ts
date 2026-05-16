import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const [assetsRes, usageRes] = await Promise.all([
    supabase.from('audio_assets').select('id, asset_id, track_name, type, status, category, created_at').eq('site_id', auth.siteId),
    supabase.from('audio_asset_usage').select('audio_asset_id').eq('site_id', auth.siteId),
  ])

  const assets = (assetsRes.data ?? []) as Array<{ id: string; asset_id: string; track_name: string | null; type: string; status: string; category: string | null; created_at: string }>
  const usageList = (usageRes.data ?? []).map(r => r.audio_asset_id)
  const usedIds = new Set(usageList)

  const by_type = { music: 0, sfx: 0 }
  const by_status = { downloaded: 0, pending: 0, retired: 0 }
  const by_category: Record<string, number> = {}
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString()
  let recently_added = 0

  for (const a of assets) {
    if (a.type === 'music') by_type.music++
    else by_type.sfx++
    by_status[a.status as keyof typeof by_status]++
    if (a.category) by_category[a.category] = (by_category[a.category] ?? 0) + 1
    if (a.created_at > cutoff) recently_added++
  }

  const usageCount: Record<string, number> = {}
  for (const uid of usageList) usageCount[uid] = (usageCount[uid] ?? 0) + 1
  const most_used = Object.entries(usageCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => {
      const a = assets.find(asset => asset.id === id)
      return { asset_id: a?.asset_id ?? id, track_name: a?.track_name ?? null, usage_count: count }
    })

  return NextResponse.json({
    data: {
      total: assets.length,
      by_type,
      by_status,
      by_category,
      most_used,
      recently_added,
      needs_download: by_status.pending,
      unused: assets.filter(a => !usedIds.has(a.id)).length,
    },
  }, { headers: buildRateLimitHeaders(auth) })
}
