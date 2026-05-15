import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { buildExportJson } from '@/lib/pipeline/audio-import'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data: assets } = await supabase
    .from('audio_assets')
    .select('*')
    .eq('site_id', auth.siteId)
    .neq('status', 'retired')
    .order('created_at', { ascending: false })

  const exportJson = buildExportJson((assets ?? []) as Array<Record<string, unknown>>, {})

  return NextResponse.json(exportJson, {
    headers: {
      ...buildRateLimitHeaders(auth),
      'Content-Disposition': 'attachment; filename="audio-library-export.json"',
    },
  })
}
