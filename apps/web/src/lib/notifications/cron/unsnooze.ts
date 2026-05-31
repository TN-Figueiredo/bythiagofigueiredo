import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function processUnsnooze() {
  const supabase = getSupabaseServiceClient()
  const { count } = await supabase
    .from('notifications')
    .update({ snoozed_until: null }, { count: 'exact' })
    .not('snoozed_until', 'is', null)
    .lte('snoozed_until', new Date().toISOString())
  return { unsnoozed: count ?? 0 }
}
