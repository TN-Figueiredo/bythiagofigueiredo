'use server'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { createServerClient } from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import { getSiteContext } from '@/lib/cms/site-context'
import type { ChannelKey, FrequencyPreset, NotificationDomain } from './types'

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

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
  const user = await getAuthenticatedUser()
  if (!user) return

  const supabase = getSupabaseServiceClient()
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
}

export async function markUnread(id: string) {
  const user = await getAuthenticatedUser()
  if (!user) return

  const supabase = getSupabaseServiceClient()
  await supabase.from('notifications').update({ read_at: null }).eq('id', id).eq('user_id', user.id)
}

export async function dismiss(id: string) {
  const user = await getAuthenticatedUser()
  if (!user) return

  const supabase = getSupabaseServiceClient()
  await supabase.from('notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
}

export async function markAllRead(siteId: string) {
  const user = await getAuthenticatedUser()
  if (!user) return

  const supabase = getSupabaseServiceClient()
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null).eq('site_id', siteId).eq('user_id', user.id)
}

export async function bulkDismiss(ids: string[]) {
  const user = await getAuthenticatedUser()
  if (!user) return

  const supabase = getSupabaseServiceClient()
  await supabase.from('notifications').update({ dismissed_at: new Date().toISOString() }).in('id', ids).eq('user_id', user.id)
}

export async function snooze(id: string, until: string) {
  const user = await getAuthenticatedUser()
  if (!user) return

  const supabase = getSupabaseServiceClient()
  await supabase.from('notifications').update({ snoozed_until: until }).eq('id', id).eq('user_id', user.id)
}
