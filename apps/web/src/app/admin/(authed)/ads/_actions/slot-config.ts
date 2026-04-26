'use server'

import { revalidateTag } from 'next/cache'
import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { captureServerActionError } from '@/lib/sentry-wrap'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface SlotConfigFormData {
  enabled?: boolean
  maxPerSession?: number
  maxPerDay?: number
  cooldownMs?: number
}

export interface SlotConfigRow {
  app_id: string
  slot_key: string
  enabled: boolean
  max_per_session: number | null
  max_per_day: number | null
  cooldown_ms: number | null
  updated_at: string
}

export async function fetchSlotConfigs(appId: string): Promise<SlotConfigRow[]> {
  await requireArea('admin')
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('ad_slot_config')
    .select('app_id, slot_key, enabled, max_per_session, max_per_day, cooldown_ms, updated_at')
    .eq('app_id', appId)
    .order('slot_key')

  if (error) {
    captureServerActionError(error, { action: 'fetch_slot_configs', app_id: appId })
    return []
  }

  return (data ?? []) as SlotConfigRow[]
}

export async function updateSlotConfig(
  appId: string,
  slotKey: string,
  data: SlotConfigFormData,
): Promise<void> {
  await requireArea('admin')
  const supabase = getSupabaseServiceClient()

  const row: Record<string, unknown> = {
    app_id: appId,
    slot_key: slotKey,
    updated_at: new Date().toISOString(),
  }
  if (data.enabled !== undefined) row.enabled = data.enabled
  if (data.maxPerSession !== undefined) row.max_per_session = data.maxPerSession
  if (data.maxPerDay !== undefined) row.max_per_day = data.maxPerDay
  if (data.cooldownMs !== undefined) row.cooldown_ms = data.cooldownMs

  const { error } = await supabase
    .from('ad_slot_config')
    .upsert(row, { onConflict: 'app_id,slot_key' })

  if (error) {
    captureServerActionError(error, {
      action: 'update_slot_config',
      app_id: appId,
      slot_key: slotKey,
    })
    throw new Error(error.message)
  }

  revalidateTag(`ad:slot-config:${appId}`)
  revalidateTag(`ad:slot:${slotKey}`)
  revalidateTag('ads')
}
