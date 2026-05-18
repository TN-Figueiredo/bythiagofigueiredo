import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { BRollImportSchema } from '@/lib/pipeline/broll-schemas'
import { mapBRollJsonToDbRow, classifyBRollImportItem, buildBRollDiffLog } from '@/lib/pipeline/broll-import'
import { pipelineLog } from '@/lib/pipeline/logger'

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = BRollImportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 })
  }

  const { dry_run, schema_version, items } = parsed.data
  const supabase = getSupabaseServiceClient()

  const assetIds = items.map(i => i.asset_id).filter(Boolean)
  const { data: existingRows } = await supabase
    .from('broll_library')
    .select('asset_id, sha256, tags, version')
    .eq('site_id', auth.siteId)
    .in('asset_id', assetIds.length > 0 ? assetIds : ['__none__'])

  const existingMap = new Map((existingRows ?? []).map(r => [r.asset_id, r]))

  let created = 0, updated = 0, skipped = 0, errorCount = 0
  const errors: Array<{ asset_id: string; error: string }> = []
  const diffLog: Array<{ asset_id: string; field: string; old: unknown; new: unknown }> = []

  const toUpsert: Array<Record<string, unknown>> = []

  for (const item of items) {
    const row = mapBRollJsonToDbRow(item)
    const existing = existingMap.get(row.asset_id as string) ?? null
    const classification = classifyBRollImportItem(row, existing)

    if (dry_run) {
      if (classification === 'create') created++
      else if (classification === 'update') updated++
      else skipped++
      continue
    }

    if (classification === 'skip') { skipped++; continue }
    if (classification === 'update' && existing) {
      diffLog.push(...buildBRollDiffLog(existing as Record<string, unknown>, row))
    }
    toUpsert.push({ ...row, site_id: auth.siteId, _classification: classification })
  }

  if (!dry_run && toUpsert.length > 0) {
    const BATCH_SIZE = 100
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batchWithMeta = toUpsert.slice(i, i + BATCH_SIZE)
      const batch = batchWithMeta.map(({ _classification, ...row }) => row)
      const classifications = batchWithMeta.map(r => r._classification)

      try {
        // On conflict (update path), increment version atomically via ignoreDuplicates:false
        // so the DB trigger/default handles versioning. We explicitly bump version in the
        // upsert payload for rows that are updates so the OCC counter advances.
        const batchWithVersion = batch.map((row, idx) => {
          if (classifications[idx] === 'update') {
            const existing = existingMap.get(row.asset_id as string)
            const currentVersion = (existing as Record<string, unknown> | undefined)?.version
            return { ...row, version: typeof currentVersion === 'number' ? currentVersion + 1 : 1 }
          }
          return row
        })
        const { error } = await supabase
          .from('broll_library')
          .upsert(batchWithVersion, { onConflict: 'site_id,asset_id' })

        if (error) {
          pipelineLog('error', 'broll-library', 'batch upsert failed', { error })
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
      } catch (batchErr) {
        pipelineLog('error', 'broll-library', 'batch upsert threw', { error: batchErr })
        errorCount += batch.length
        for (const row of batch) {
          errors.push({ asset_id: (row.asset_id as string) ?? 'unknown', error: 'Unexpected error during batch processing' })
        }
      }
    }
  }

  if (dry_run) {
    return NextResponse.json({
      data: { dry_run: true, preview: { to_create: created, to_update: updated, to_skip: skipped, errors: [] } },
    }, { headers: buildRateLimitHeaders(auth) })
  }

  let importLogId: string | undefined
  try {
    const { data: logRow, error: logError } = await supabase
      .from('broll_import_log')
      .insert({
        site_id: auth.siteId,
        source: 'json_import',
        status: errorCount > 0 ? (created + updated > 0 ? 'partial' : 'failed') : 'success',
        total_items: items.length,
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
    if (logError) {
      pipelineLog('error', 'broll-library', 'import log insert failed', { error: logError })
    } else {
      importLogId = logRow?.id
    }
  } catch (logErr) {
    pipelineLog('error', 'broll-library', 'import log insert threw', { error: logErr })
  }

  return NextResponse.json({
    data: { dry_run: false, import_log_id: importLogId, created, updated, skipped, errors },
  }, { headers: buildRateLimitHeaders(auth) })
}
