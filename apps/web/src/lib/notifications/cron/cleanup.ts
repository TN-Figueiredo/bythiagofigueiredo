import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function processCleanup() {
  const supabase = getSupabaseServiceClient()
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // Soft expire: set expired_at on old non-dismissed notifications
  const { count: expired } = await supabase
    .from('notifications')
    .update({ expired_at: new Date().toISOString() })
    .is('expired_at', null)
    .lt('created_at', cutoff)
    .select('id', { count: 'exact', head: true })

  // Hard delete: remove expired notifications older than 90 days
  const { count: deleted } = await supabase
    .from('notifications')
    .delete()
    .not('expired_at', 'is', null)
    .lt('expired_at', cutoff)
    .select('id', { count: 'exact', head: true })

  return { expired: expired ?? 0, deleted: deleted ?? 0 }
}
