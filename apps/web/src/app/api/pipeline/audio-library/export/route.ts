import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead, pipelineError } from '@/lib/pipeline/helpers'
import { buildExportJson } from '@/lib/pipeline/audio-import'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'
import { pipelineLog } from '@/lib/pipeline/logger'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const PAGE_SIZE = 1000
  const MAX_EXPORT_ROWS = 50_000
  const allAssets: AudioAssetRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('audio_assets')
      .select('id, asset_id, original_filename, renamed_to, sha256, type, source, category, subcategory, genre, artist, track_name, artlist_url, duration_seconds, bpm, music_key, time_signature, energy, tempo_feel, tags, mood, instruments, use_cases, reuse_scenarios, reusable, status, priority, metadata, version, created_at, updated_at')
      .eq('site_id', auth.siteId)
      .neq('status', 'retired')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) { pipelineLog('error', 'audio-library', 'export DB query failed', { error }); return pipelineError('DB_ERROR', 'Failed to export assets', 500, auth) }
    const rows = (data ?? []) as AudioAssetRow[]
    allAssets.push(...rows)
    if (allAssets.length >= MAX_EXPORT_ROWS) break
    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  const exportJson = buildExportJson(allAssets)

  return NextResponse.json(exportJson, {
    headers: {
      ...buildRateLimitHeaders(auth),
      'Content-Disposition': 'attachment; filename="audio-library-export.json"',
    },
  })
}
