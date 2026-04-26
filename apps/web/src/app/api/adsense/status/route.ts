import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(_req: Request): Promise<Response> {
  await requireArea('admin')

  const supabase = getSupabaseServiceClient()

  const { data: orgId, error: orgErr } = await supabase.rpc('get_master_org_id')
  if (orgErr || !orgId) {
    return Response.json({ error: 'Could not resolve organization' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('organizations')
    .select(
      'adsense_publisher_id, adsense_sync_status, adsense_connected_at, adsense_last_sync_at, adsense_refresh_token_enc',
    )
    .eq('id', orgId as string)
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({
    connected: Boolean(data?.adsense_publisher_id),
    publisherId: data?.adsense_publisher_id ?? null,
    syncStatus: data?.adsense_sync_status ?? 'disconnected',
    connectedAt: data?.adsense_connected_at ?? null,
    lastSyncAt: data?.adsense_last_sync_at ?? null,
    hasToken: Boolean(data?.adsense_refresh_token_enc),
  })
}
