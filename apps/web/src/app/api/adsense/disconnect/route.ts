import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'

export async function POST(_req: Request): Promise<Response> {
  await requireArea('admin')

  const supabase = getSupabaseServiceClient()

  const { data: orgId, error: orgErr } = await supabase.rpc('get_master_org_id')
  if (orgErr || !orgId) {
    return Response.json({ error: 'Could not resolve organization' }, { status: 500 })
  }

  const { error } = await supabase
    .from('organizations')
    .update({
      adsense_refresh_token_enc: null,
      adsense_publisher_id: null,
      adsense_connected_at: null,
      adsense_last_sync_at: null,
      adsense_sync_status: 'disconnected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId as string)

  if (error) {
    Sentry.captureException(error, { tags: { component: 'adsense-disconnect' } })
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
