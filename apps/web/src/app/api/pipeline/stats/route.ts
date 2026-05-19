import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead } from '@/lib/pipeline/helpers'
import { FORMATS } from '@/lib/pipeline/schemas'
import { WORKFLOWS } from '@/lib/pipeline/workflows'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const { data: items } = await supabase
    .from('content_pipeline')
    .select('format, stage, priority, is_archived, updated_at')
    .eq('site_id', auth.siteId)

  const allItems = items ?? []
  const active = allItems.filter((i) => !i.is_archived)

  const byFormat = FORMATS.reduce<Record<string, { total: number; byStage: Record<string, number> }>>((acc, format) => {
    const formatItems = active.filter((i) => i.format === format)
    const byStage: Record<string, number> = {}
    WORKFLOWS[format].forEach((s) => { byStage[s.stage] = formatItems.filter((i) => i.stage === s.stage).length })
    acc[format] = { total: formatItems.length, byStage }
    return acc
  }, {})

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const recentlyUpdated = active.filter((i) => i.updated_at > sevenDaysAgo).length

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: {
      total: active.length,
      archived: allItems.length - active.length,
      by_format: byFormat,
      recently_updated_7d: recentlyUpdated,
      by_priority: {
        critical: active.filter((i) => i.priority === 5).length,
        high: active.filter((i) => i.priority === 4).length,
        medium: active.filter((i) => i.priority === 3).length,
        low: active.filter((i) => i.priority <= 2).length,
      },
    },
  }, { headers })
}
