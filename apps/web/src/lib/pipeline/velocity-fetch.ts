import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildVelocityMap } from './velocity'
import type { VelocityMap, VelocityTransitionRow } from './up-next-types'

export const fetchVelocityMap = unstable_cache(
  async (siteId: string): Promise<VelocityMap> => {
    const supabase = getSupabaseServiceClient()
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('content_pipeline_history')
      .select(`
        pipeline_id,
        from_value,
        to_value,
        changed_at,
        content_pipeline!inner(format, site_id)
      `)
      .eq('content_pipeline.site_id', siteId)
      .eq('event_type', 'stage_change')
      .gte('changed_at', ninetyDaysAgo)
      .order('changed_at', { ascending: true })
      .limit(5000)

    if (error) {
      console.error('[velocity] fetch error:', error.message)
      return {}
    }

    const rows: VelocityTransitionRow[] = (data ?? []).map((row: Record<string, unknown>) => {
      const cp = row.content_pipeline as Record<string, unknown>
      return {
        pipeline_id: row.pipeline_id as string,
        from_value: row.from_value as string,
        to_value: row.to_value as string,
        changed_at: row.changed_at as string,
        format: cp.format as string,
      }
    })

    return buildVelocityMap(rows)
  },
  ['pipeline-velocity-map'],
  { revalidate: 300 },
)
