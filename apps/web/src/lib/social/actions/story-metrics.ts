'use server'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireEditAccess } from './_shared'
import type { StoryInsights, SlideMetrics } from '../story-types'

export async function getStoryInsights(siteId: string, postId: string): Promise<StoryInsights | null> {
  const { siteId: authorizedSiteId } = await requireEditAccess()
  if (siteId !== authorizedSiteId) throw new Error('forbidden')

  const supabase = getSupabaseServiceClient()

  const { data: metrics, error } = await supabase
    .from('post_metrics')
    .select('slide_index, impressions, reach, likes, comments, shares, link_clicks')
    .eq('post_id', postId)
    .order('slide_index', { ascending: true, nullsFirst: true })

  if (error || !metrics || metrics.length === 0) return null

  const aggregate = metrics.find((m) => m.slide_index === null)
  const perSlide: SlideMetrics[] = metrics
    .filter((m) => m.slide_index !== null)
    .map((m) => ({
      slide_index: m.slide_index as number,
      impressions: m.impressions ?? 0,
      reach: m.reach ?? 0,
      replies: m.comments ?? 0,
    }))

  const dropOff = perSlide.slice(1).map((slide, i) => {
    const prev = perSlide[i]
    const reachDrop = prev.reach - slide.reach
    return {
      from_slide: prev.slide_index,
      to_slide: slide.slide_index,
      reach_drop: reachDrop,
      drop_percentage: prev.reach > 0 ? (reachDrop / prev.reach) * 100 : 0,
    }
  })

  return {
    post_id: postId,
    aggregate: {
      impressions: aggregate?.impressions ?? 0,
      reach: aggregate?.reach ?? 0,
      replies: aggregate?.comments ?? 0,
      link_clicks: aggregate?.link_clicks ?? 0,
    },
    per_slide: perSlide,
    drop_off: dropOff,
  }
}
