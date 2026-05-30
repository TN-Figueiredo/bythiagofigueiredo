'use server'

import { getSupabaseServiceClient } from '@/lib/supabase/service'

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
