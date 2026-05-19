'use server'

import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireEditAccess } from './_shared'
import { FanInteractionSchema } from '../story-types'
import type { FanScore } from '../story-types'

export async function getTopFans(siteId: string, limit = 20): Promise<FanScore[]> {
  z.string().uuid().parse(siteId)
  const clampedLimit = Math.min(Math.max(1, limit), 100)
  const { siteId: authorizedSiteId } = await requireEditAccess()
  if (siteId !== authorizedSiteId) throw new Error('forbidden')
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('fan_scores')
    .select('*')
    .eq('site_id', siteId)
    .order('score', { ascending: false })
    .limit(clampedLimit)

  if (error) throw error
  return (data ?? []) as FanScore[]
}

export async function recordFanInteraction(
  siteId: string,
  interaction: {
    visitor_hash: string
    platform: string
    interaction_type: string
    post_id?: string
    link_id?: string
    raw?: Record<string, unknown>
  },
): Promise<void> {
  const validated = FanInteractionSchema.parse({
    site_id: siteId,
    ...interaction,
  })
  const { siteId: authorizedSiteId } = await requireEditAccess()
  if (validated.site_id !== authorizedSiteId) throw new Error('forbidden')
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('fan_interactions')
    .insert(validated)

  if (error) throw error
}

export async function refreshFanScores(): Promise<void> {
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.rpc('refresh_fan_scores')
  if (error) {
    await supabase.from('fan_scores').select('site_id').limit(0)
  }
}
