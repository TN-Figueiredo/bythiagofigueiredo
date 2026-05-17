import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const h = await headers()
  const siteId = h.get('x-site-id')
  const orgId = h.get('x-org-id')

  const diagnostics: Record<string, unknown> = {
    siteId,
    orgId,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) + '...',
  }

  try {
    const supabase = getSupabaseServiceClient()

    const { data, error, count } = await supabase
      .from('media_assets')
      .select('id, site_id, filename', { count: 'exact' })
      .eq('site_id', siteId ?? '')
      .is('deleted_at', null)
      .limit(3)

    diagnostics.queryError = error?.message ?? null
    diagnostics.queryCount = count
    diagnostics.sampleRows = data?.map((r) => ({ id: r.id, filename: r.filename })) ?? []

    const { data: allSites } = await supabase
      .from('media_assets')
      .select('site_id')
      .is('deleted_at', null)
      .limit(1)

    diagnostics.anySiteIdInTable = allSites?.[0]?.site_id ?? null
    diagnostics.siteIdMatch = allSites?.[0]?.site_id === siteId
  } catch (err) {
    diagnostics.serviceClientError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(diagnostics)
}
