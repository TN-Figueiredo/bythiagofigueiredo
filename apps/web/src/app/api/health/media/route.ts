import type { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { tryGetSiteContext } from '@/lib/cms/site-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<Response> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const ctx = await tryGetSiteContext()
    if (!ctx) {
      return Response.json({ ok: false, error: 'Site resolution failed' }, { status: 503 })
    }

    const supabase = getSupabaseServiceClient()

    const [totalResult, softDeletedResult, orphanResult] = await Promise.all([
      supabase
        .from('media_assets')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', ctx.siteId)
        .is('deleted_at', null),
      supabase
        .from('media_assets')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', ctx.siteId)
        .not('deleted_at', 'is', null),
      supabase.rpc('count_orphan_media_assets', { p_site_id: ctx.siteId }),
    ])

    const totalAssets = totalResult.count ?? 0
    const softDeletedCount = softDeletedResult.count ?? 0
    const orphanCount = typeof orphanResult.data === 'number' ? orphanResult.data : 0

    return Response.json({
      ok: true,
      siteId: ctx.siteId,
      totalAssets,
      orphanCount,
      softDeletedCount,
    })
  } catch {
    return Response.json({ ok: false, error: 'Site resolution failed' }, { status: 503 })
  }
}
