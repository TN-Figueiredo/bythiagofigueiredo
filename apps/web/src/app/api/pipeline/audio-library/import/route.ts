import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateWrite, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { ImportSchema, type ImportItem } from '@/lib/pipeline/audio-schemas'
import { mapJsonToDbRow, classifyImportItem, buildDiffLog } from '@/lib/pipeline/audio-import'
import { pipelineLog } from '@/lib/pipeline/logger'

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = ImportSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)
  }

  const { dry_run, schema_version, music, sfx } = parsed.data
  const supabase = getSupabaseServiceClient()

  const allItems = [
    ...music.map(item => ({ ...item, _type: 'music' as const })),
    ...sfx.map(item => ({ ...item, _type: 'sfx' as const })),
  ]

  const assetIds = allItems.map(i => i.asset_id).filter(Boolean)
  const { data: existingRows } = await supabase
    .from('audio_assets')
    .select('asset_id, sha256, tags, mood, energy')
    .eq('site_id', auth.siteId)
    .in('asset_id', assetIds.length > 0 ? assetIds : ['__none__'])

  const existingMap = new Map((existingRows ?? []).map(r => [r.asset_id, r]))

  let created = 0, updated = 0, skipped = 0, errorCount = 0
  const errors: Array<{ asset_id: string; error: string }> = []
  const diffLog: Array<{ asset_id: string; field: string; old: unknown; new: unknown }> = []

  const toUpsert: Array<Record<string, unknown>> = []

  for (const rawItem of allItems) {
    const { _type, ...item } = rawItem
    const row = mapJsonToDbRow(item as ImportItem, _type)
    const existing = existingMap.get(row.asset_id as string) ?? null
    const classification = classifyImportItem(row, existing)

    if (dry_run) {
      if (classification === 'create') created++
      else if (classification === 'update') updated++
      else skipped++
      continue
    }

    if (classification === 'skip') { skipped++; continue }
    if (classification === 'update' && existing) {
      diffLog.push(...buildDiffLog(existing, row))
    }
    toUpsert.push({ ...row, site_id: auth.siteId, _classification: classification })
  }

  if (!dry_run && toUpsert.length > 0) {
    const BATCH_SIZE = 100
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE).map(({ _classification, ...row }) => row)
      const classifications = toUpsert.slice(i, i + BATCH_SIZE).map(r => r._classification)
      const { error } = await supabase
        .from('audio_assets')
        .upsert(batch, { onConflict: 'site_id,asset_id' })

      if (error) {
        pipelineLog('error', 'audio-library', 'batch upsert failed', { error })
        errorCount += batch.length
        for (const row of batch) {
          errors.push({ asset_id: (row.asset_id as string) ?? 'unknown', error: 'Batch upsert failed' })
        }
      } else {
        for (const cls of classifications) {
          if (cls === 'create') created++
          else updated++
        }
      }
    }
  }

  if (dry_run) {
    return NextResponse.json({
      data: { dry_run: true, preview: { to_create: created, to_update: updated, to_skip: skipped, errors: [] } },
    }, { headers: buildRateLimitHeaders(auth) })
  }

  const { data: logRow } = await supabase
    .from('audio_import_log')
    .insert({
      site_id: auth.siteId,
      source: 'json_import',
      status: errorCount > 0 ? (created + updated > 0 ? 'partial' : 'failed') : 'success',
      total_items: allItems.length,
      created_count: created,
      updated_count: updated,
      skipped_count: skipped,
      error_count: errorCount,
      errors,
      diff_log: diffLog,
      schema_version,
      imported_by: auth.source === 'api_key' ? 'cowork' : 'cms_ui',
    })
    .select('id')
    .single()

  return NextResponse.json({
    data: { dry_run: false, import_log_id: logRow?.id, created, updated, skipped, errors },
  }, { headers: buildRateLimitHeaders(auth) })
}
