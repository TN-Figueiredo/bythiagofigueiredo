import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { buildExportJson } from '@/lib/pipeline/audio-import'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data: assets } = await supabase
    .from('audio_assets')
    .select('id, asset_id, original_filename, renamed_to, sha256, type, source, category, subcategory, genre, artist, track_name, artlist_url, duration_seconds, bpm, music_key, time_signature, energy, tempo_feel, tags, mood, instruments, use_cases, reuse_scenarios, reusable, status, priority, metadata, version, created_at, updated_at')
    .eq('site_id', auth.siteId)
    .neq('status', 'retired')
    .order('created_at', { ascending: false })

  const exportJson = buildExportJson((assets ?? []) as AudioAssetRow[])

  return NextResponse.json(exportJson, {
    headers: {
      ...buildRateLimitHeaders(auth),
      'Content-Disposition': 'attachment; filename="audio-library-export.json"',
    },
  })
}
