'use server'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import type { ChannelKey, FrequencyPreset, NotificationDomain } from './types'

/* ------------------------------------------------------------------ */
/*  Preferences — save                                                 */
/* ------------------------------------------------------------------ */

export interface SavePreferencesInput {
  channels: Record<ChannelKey, boolean>
  preset: FrequencyPreset
  categories: Record<NotificationDomain, Record<ChannelKey, boolean>>
  quietEnabled: boolean
  quietStart: string
  quietEnd: string
  timezone: string
}

export async function savePreferences(input: SavePreferencesInput) {
  const { siteId } = await getSiteContext()
  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) throw new Error('Unauthorized')

  const userId = authRes.user.id
  const supabase = getSupabaseServiceClient()
  const timezone = input.timezone || 'America/Sao_Paulo'

  // Upsert global preferences (category = null)
  const globalRow = {
    user_id: userId,
    site_id: siteId,
    category: null as string | null,
    channel_in_app: true, // always on
    channel_email: input.channels.email,
    channel_push: input.channels.push,
    channel_telegram: input.channels.telegram,
    frequency_mode: input.preset,
    quiet_hours_enabled: input.quietEnabled,
    quiet_hours_start: input.quietStart || '22:00',
    quiet_hours_end: input.quietEnd || '08:00',
    quiet_hours_timezone: timezone,
    updated_at: new Date().toISOString(),
  }

  await supabase
    .from('notification_preferences')
    .upsert(globalRow, { onConflict: 'user_id,site_id,category' })

  // Upsert per-category preferences
  const catRows = Object.entries(input.categories).map(([domain, chs]) => ({
    user_id: userId,
    site_id: siteId,
    category: domain,
    channel_in_app: domain === 'system' ? true : chs.in_app,
    channel_email: chs.email,
    channel_push: chs.push,
    channel_telegram: chs.telegram,
    frequency_mode: input.preset,
    quiet_hours_enabled: input.quietEnabled,
    quiet_hours_start: input.quietStart || '22:00',
    quiet_hours_end: input.quietEnd || '08:00',
    quiet_hours_timezone: timezone,
    updated_at: new Date().toISOString(),
  }))

  await supabase
    .from('notification_preferences')
    .upsert(catRows, { onConflict: 'user_id,site_id,category' })

  return { ok: true }
}

/* ------------------------------------------------------------------ */
/*  Notifications — read/dismiss                                       */
/* ------------------------------------------------------------------ */

export async function markRead(id: string) {
  const supabase = getSupabaseServiceClient()
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
}

export async function markUnread(id: string) {
  const supabase = getSupabaseServiceClient()
  await supabase.from('notifications').update({ read_at: null }).eq('id', id)
}

export async function dismiss(id: string) {
  const supabase = getSupabaseServiceClient()
  await supabase.from('notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', id)
}

export async function markAllRead(siteId: string) {
  const supabase = getSupabaseServiceClient()
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null).eq('site_id', siteId)
}

export async function bulkDismiss(ids: string[]) {
  const supabase = getSupabaseServiceClient()
  await supabase.from('notifications').update({ dismissed_at: new Date().toISOString() }).in('id', ids)
}

export async function snooze(id: string, until: string) {
  const supabase = getSupabaseServiceClient()
  await supabase.from('notifications').update({ snoozed_until: until }).eq('id', id)
}
