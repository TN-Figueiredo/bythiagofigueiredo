import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function processUnsnooze() {
  const supabase = getSupabaseServiceClient()
  const { count } = await supabase
    .from('notifications')
    .update({ snoozed_until: null })
    .not('snoozed_until', 'is', null)
    .lte('snoozed_until', new Date().toISOString())
    .select('id', { count: 'exact', head: true })
  return { unsnoozed: count ?? 0 }
}
