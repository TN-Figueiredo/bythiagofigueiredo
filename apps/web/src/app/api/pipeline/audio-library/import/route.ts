import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { ImportSchema, type ImportItem } from '@/lib/pipeline/audio-schemas'
import { mapJsonToDbRow, classifyImportItem, buildDiffLog } from '@/lib/pipeline/audio-import'

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = ImportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 })
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

    try {
      if (classification === 'skip') { skipped++; continue }
      if (classification === 'update' && existing) {
        diffLog.push(...buildDiffLog(existing, row))
      }

      const { error } = await supabase
        .from('audio_assets')
        .upsert({ ...row, site_id: auth.siteId }, { onConflict: 'site_id,asset_id' })

      if (error) throw error
      if (classification === 'create') created++
      else updated++
    } catch (err) {
      errorCount++
      errors.push({ asset_id: (row.asset_id as string) ?? 'unknown', error: err instanceof Error ? err.message : String(err) })
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
