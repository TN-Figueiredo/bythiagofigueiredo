import { NextRequest } from 'next/server'
import { authenticateRead, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface TrackedLink {
  id: string
  ab_test_id: string
  variant_id: string
  link_id: string
  template_name: string
  short_code: string
  created_at: string
  link: { id: string; code: string; destination_url: string }
}

interface CycleRow {
  variant_id: string
  impressions: number | null
  clicks: number | null
}

interface ClickAggregate {
  link_id: string
  total_clicks: number | null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params
  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!test) return pipelineError('NOT_FOUND', 'Test not found', 404, auth)

  const { data: trackedLinks } = await supabase
    .from('ab_test_tracked_links')
    .select(`
      *,
      link:tracked_links!link_id(id, code, destination_url)
    `)
    .eq('ab_test_id', id)

  const { data: cycles } = await supabase
    .from('ab_test_cycles')
    .select('variant_id, impressions, clicks')
    .eq('test_id', id)
    .not('impressions', 'is', null)

  const variantImpressions: Record<string, { impressions: number; clicks: number }> = {}
  for (const c of cycles ?? []) {
    const v = variantImpressions[c.variant_id] ?? { impressions: 0, clicks: 0 }
    v.impressions += c.impressions ?? 0
    v.clicks += c.clicks ?? 0
    variantImpressions[c.variant_id] = v
  }

  const linkClicksByLinkId: Record<string, number> = {}
  if (trackedLinks?.length) {
    const linkIds = (trackedLinks as TrackedLink[]).map((tl) => tl.link_id).filter(Boolean)
    if (linkIds.length) {
      const { data: clickAggs } = await supabase
        .from('link_click_aggregates')
        .select('link_id, total_clicks')
        .in('link_id', linkIds)
      for (const agg of clickAggs ?? []) {
        linkClicksByLinkId[agg.link_id] = agg.total_clicks ?? 0
      }
    }
  }

  const perVariant = Object.entries(variantImpressions).map(([variantId, stats]) => ({
    variant_id: variantId,
    impressions: stats.impressions,
    clicks: stats.clicks,
    link_clicks: ((trackedLinks ?? []) as TrackedLink[])
      .filter((tl) => tl.variant_id === variantId)
      .reduce((sum, tl) => sum + (linkClicksByLinkId[tl.link_id] ?? 0), 0),
  }))

  const perLink = ((trackedLinks ?? []) as TrackedLink[]).map((tl) => ({
    template_name: tl.template_name,
    variant_id: tl.variant_id,
    short_code: tl.short_code,
    clicks: linkClicksByLinkId[tl.link_id] ?? 0,
  }))

  return pipelineSuccess({ per_variant: perVariant, per_link: perLink }, 200, auth)
}
