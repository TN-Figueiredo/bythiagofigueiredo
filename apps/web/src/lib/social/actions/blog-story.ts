'use server'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireEditAccess } from './_shared'

export async function hasInstagramConnection(): Promise<boolean> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { count } = await supabase
    .from('social_connections')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('provider', 'instagram')
    .is('revoked_at', null)

  return (count ?? 0) > 0
}
