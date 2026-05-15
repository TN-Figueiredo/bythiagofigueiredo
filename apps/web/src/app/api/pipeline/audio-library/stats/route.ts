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
    supabase.from('audio_assets').select('id, type, status, category, track_name, created_at').eq('site_id', auth.siteId),
    supabase.from('audio_asset_usage').select('audio_asset_id').eq('site_id', auth.siteId),
  ])

  const assets = (assetsRes.data ?? []) as Array<{ id: string; type: string; status: string; category: string | null; track_name: string | null; created_at: string }>
  const usedIds = new Set((usageRes.data ?? []).map((r: Record<string, unknown>) => r.audio_asset_id))

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

  return NextResponse.json({
    data: {
      total: assets.length,
      by_type,
      by_status,
      by_category,
      recently_added,
      needs_download: by_status.pending,
      unused: assets.filter(a => !usedIds.has(a.id)).length,
    },
  }, { headers: buildRateLimitHeaders(auth) })
}
