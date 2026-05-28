import type { ServiceContext, ServiceResult } from './types'
import { ok, fail } from './types'
import {
  BRollAssetCreateSchema,
  BRollAssetUpdateSchema,
  BRollImportSchema,
  type BRollAssetRow,
} from '@/lib/pipeline/broll-schemas'
import { mapBRollJsonToDbRow, classifyBRollImportItem, buildBRollDiffLog } from '@/lib/pipeline/broll-import'
import { sanitizeForFilter, sanitizeForTsquery } from '@/lib/pipeline/sanitize'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { pipelineLog } from '@/lib/pipeline/logger'

// ---------------------------------------------------------------------------
// BROLL select columns (reused across list + create)
// ---------------------------------------------------------------------------

const BROLL_SELECT_COLUMNS = 'id, asset_id, original_filename, renamed_to, sha256, file_size_bytes, type, source, source_type, category, subcategory, location, description, tags, codec, fps, resolution, width, height, duration_seconds, bitrate_kbps, has_audio, color_profile, storage_url, thumbnail_url, proxy_url, reusable, status, captured_at, metadata, version, created_at, updated_at' as const

// ---------------------------------------------------------------------------
// List params
// ---------------------------------------------------------------------------

export interface BRollListParams {
  limit?: number
  cursor?: string
  type?: string
  status?: string
  source_type?: string
  category?: string
  resolution?: string
  tags?: string
  has_audio?: string
  reusable?: string
  location?: string
  q?: string
}

export interface BRollListResult {
  data: BRollAssetRow[]
  meta: { total: number; has_next: boolean; next_cursor: string | undefined; limit: number }
}

// ---------------------------------------------------------------------------
// Get-by-id result
// ---------------------------------------------------------------------------

export interface BRollGetResult extends BRollAssetRow {
  usage: Array<{
    id: string
    pipeline_item_id: string
    beat_index: number | null
    timecode_in: string | null
    timecode_out: string | null
    usage_type: string
    notes: string | null
    content_pipeline: { code: string; title_pt: string; format: string } | null
  }>
}

// ---------------------------------------------------------------------------
// Import result
// ---------------------------------------------------------------------------

export interface BRollImportResult {
  dry_run: boolean
  import_log_id?: string
  preview?: { to_create: number; to_update: number; to_skip: number; errors: never[] }
  created?: number
  updated?: number
  skipped?: number
  errors?: Array<{ asset_id: string; error: string }>
}

// ---------------------------------------------------------------------------
// Retire result
// ---------------------------------------------------------------------------

export interface BRollRetireResult {
  id: string
  status: string
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/** List B-Roll assets with cursor pagination, filtering and full-text search. */
export async function listBRollAssets(
  ctx: ServiceContext,
  params: BRollListParams,
): Promise<ServiceResult<BRollListResult>> {
  const limit = Math.max(1, Math.min(parseInt(String(params.limit || '50')) || 50, 200))
  const cursor = params.cursor || undefined

  let query = ctx.supabase
    .from('broll_library')
    .select(BROLL_SELECT_COLUMNS, { count: 'exact' })
    .eq('site_id', ctx.siteId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (params.type && ['footage', 'photo', 'screen_recording', 'stock', 'graphic', 'animation'].includes(params.type)) {
    query = query.eq('type', params.type)
  }
  if (params.status && ['available', 'pending', 'retired'].includes(params.status)) {
    query = query.eq('status', params.status)
  }
  if (params.source_type && ['pessoal', 'generico'].includes(params.source_type)) {
    query = query.eq('source_type', params.source_type)
  }
  if (params.category) query = query.eq('category', sanitizeForFilter(params.category))
  if (params.resolution) query = query.eq('resolution', sanitizeForFilter(params.resolution))

  if (params.tags) {
    query = query.contains('tags', params.tags.split(',').map(t => sanitizeForFilter(t.trim())).filter(Boolean))
  }

  if (params.has_audio === 'true') query = query.eq('has_audio', true)
  else if (params.has_audio === 'false') query = query.eq('has_audio', false)

  if (params.reusable === 'true') query = query.eq('reusable', true)
  else if (params.reusable === 'false') query = query.eq('reusable', false)

  if (params.location) query = query.ilike('location', `%${sanitizeForFilter(params.location)}%`)

  if (params.q) {
    const safe = sanitizeForTsquery(params.q)
    if (safe) query = query.textSearch('search_vector', safe, { type: 'websearch', config: 'english' })
  }

  if (cursor && UUID_REGEX.test(cursor)) {
    const { data: cursorItem } = await ctx.supabase
      .from('broll_library')
      .select('created_at')
      .eq('id', cursor)
      .eq('site_id', ctx.siteId)
      .single()
    if (cursorItem) {
      const ts = cursorItem.created_at as string
      const ISO_TS_REGEX = /^\d{4}-\d{2}-\d{2}T[\d:.+Z-]+$/
      if (ISO_TS_REGEX.test(ts)) {
        query = query.or(`created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${cursor})`)
      }
    }
  }

  const { data, error, count } = await query.limit(limit + 1)
  if (error) {
    pipelineLog('error', 'broll-library', 'GET failed', { error })
    return fail('DB_ERROR', 'Failed to load assets', 500)
  }

  const hasNext = (data?.length ?? 0) > limit
  const items = (data?.slice(0, limit) ?? []) as BRollAssetRow[]
  const lastItem = items[items.length - 1] as { id: string } | undefined

  return ok({
    data: items,
    meta: { total: count ?? 0, has_next: hasNext, next_cursor: hasNext && lastItem ? lastItem.id : undefined, limit },
  })
}

/** Create a single B-Roll asset after Zod validation. */
export async function createBRollAsset(
  ctx: ServiceContext,
  body: unknown,
): Promise<ServiceResult<BRollAssetRow>> {
  const parsed = BRollAssetCreateSchema.safeParse(body)
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  const { data, error } = await ctx.supabase
    .from('broll_library')
    .insert({ ...parsed.data, site_id: ctx.siteId })
    .select(BROLL_SELECT_COLUMNS)
    .single()

  if (error) {
    if (error.code === '23505') {
      return fail('CONFLICT', 'Asset with this ID or SHA256 already exists', 409)
    }
    pipelineLog('error', 'broll-library', 'POST failed', { error })
    return fail('DB_ERROR', 'Failed to save asset', 500)
  }

  return ok(data as BRollAssetRow, 201)
}

/** Get a single B-Roll asset by UUID, including usage records. */
export async function getBRollAsset(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<BRollGetResult>> {
  if (!UUID_REGEX.test(id)) return fail('VALIDATION_ERROR', 'Invalid ID format', 400)

  const { data: asset, error } = await ctx.supabase
    .from('broll_library')
    .select('*')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (error) {
    pipelineLog('error', 'broll-library', 'GET by id failed', { error })
    if (error.code === 'PGRST116') return fail('NOT_FOUND', 'Asset not found', 404)
    return fail('DB_ERROR', 'Failed to load asset', 500)
  }
  if (!asset) return fail('NOT_FOUND', 'Asset not found', 404)

  const { data: usage } = await ctx.supabase
    .from('broll_library_usage')
    .select('id, pipeline_item_id, beat_index, timecode_in, timecode_out, usage_type, notes, content_pipeline(code, title_pt, format)')
    .eq('broll_asset_id', id)
    .eq('site_id', ctx.siteId)

  return ok({ ...asset, usage: usage ?? [] } as BRollGetResult)
}

/** Update a B-Roll asset with optimistic concurrency control (version check). */
export async function updateBRollAsset(
  ctx: ServiceContext,
  id: string,
  body: unknown,
): Promise<ServiceResult<BRollAssetRow>> {
  if (!UUID_REGEX.test(id)) return fail('VALIDATION_ERROR', 'Invalid ID format', 400)

  const parsed = BRollAssetUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  const { version, ...updates } = parsed.data

  const { data, error } = await ctx.supabase
    .from('broll_library')
    .update({ ...updates, version: version + 1 })
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .eq('version', version)
    .select('*')
    .maybeSingle()

  if (error) {
    pipelineLog('error', 'broll-library', 'PATCH failed', { error })
    return fail('DB_ERROR', 'Failed to update asset', 500)
  }

  if (!data) {
    const { data: exists } = await ctx.supabase
      .from('broll_library')
      .select('id, version')
      .eq('id', id)
      .eq('site_id', ctx.siteId)
      .maybeSingle()
    if (!exists) return fail('NOT_FOUND', 'Asset not found', 404)
    return fail('CONFLICT', `Version mismatch: expected ${version}, current ${exists.version}`, 409)
  }

  return ok(data as BRollAssetRow)
}

/** Soft-delete (retire) a B-Roll asset. */
export async function retireBRollAsset(
  ctx: ServiceContext,
  id: string,
  options?: { dryRun?: boolean },
): Promise<ServiceResult<BRollRetireResult>> {
  if (!UUID_REGEX.test(id)) return fail('VALIDATION_ERROR', 'Invalid ID format', 400)

  if (options?.dryRun) {
    const { data: exists } = await ctx.supabase
      .from('broll_library')
      .select('id, status')
      .eq('id', id)
      .eq('site_id', ctx.siteId)
      .single()
    if (!exists) return fail('NOT_FOUND', 'Asset not found', 404)
    return ok({ id: exists.id as string, status: 'retired' })
  }

  const { data, error } = await ctx.supabase
    .from('broll_library')
    .update({ status: 'retired' })
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .select('id, status')
    .single()

  if (error || !data) return fail('NOT_FOUND', 'Asset not found', 404)

  return ok(data as BRollRetireResult)
}

/** Batch import B-Roll assets from JSON, with dry-run support. */
export async function importBRollAssets(
  ctx: ServiceContext,
  body: unknown,
): Promise<ServiceResult<BRollImportResult>> {
  const parsed = BRollImportSchema.safeParse(body)
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  const { dry_run, schema_version, items } = parsed.data

  const assetIds = items.map(i => i.asset_id).filter(Boolean)
  const { data: existingRows } = await ctx.supabase
    .from('broll_library')
    .select('asset_id, sha256, tags, version')
    .eq('site_id', ctx.siteId)
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
    toUpsert.push({ ...row, site_id: ctx.siteId, _classification: classification })
  }

  if (!dry_run && toUpsert.length > 0) {
    const BATCH_SIZE = 100
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batchWithMeta = toUpsert.slice(i, i + BATCH_SIZE)
      const batch = batchWithMeta.map(({ _classification, ...row }) => row)
      const classifications = batchWithMeta.map(r => r._classification)

      try {
        const batchWithVersion = batch.map((row, idx) => {
          if (classifications[idx] === 'update') {
            const existing = existingMap.get(row.asset_id as string)
            const currentVersion = (existing as Record<string, unknown> | undefined)?.version
            return { ...row, version: typeof currentVersion === 'number' ? currentVersion + 1 : 1 }
          }
          return row
        })
        const { error } = await ctx.supabase
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
    return ok({
      dry_run: true,
      preview: { to_create: created, to_update: updated, to_skip: skipped, errors: [] as never[] },
    })
  }

  let importLogId: string | undefined
  try {
    const { data: logRow, error: logError } = await ctx.supabase
      .from('broll_import_log')
      .insert({
        site_id: ctx.siteId,
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
        imported_by: ctx.source === 'api_key' ? 'cowork' : 'cms_ui',
      })
      .select('id')
      .single()
    if (logError) {
      pipelineLog('error', 'broll-library', 'import log insert failed', { error: logError })
    } else {
      importLogId = logRow?.id as string | undefined
    }
  } catch (logErr) {
    pipelineLog('error', 'broll-library', 'import log insert threw', { error: logErr })
  }

  return ok({
    dry_run: false,
    import_log_id: importLogId,
    created,
    updated,
    skipped,
    errors,
  })
}
