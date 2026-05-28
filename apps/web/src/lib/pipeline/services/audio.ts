import type { ServiceContext, ServiceResult } from './types'
import { ok, fail } from './types'
import {
  AudioAssetCreateSchema,
  AudioAssetUpdateSchema,
  ResolveQuerySchema,
  ImportSchema,
  type AudioAssetRow,
  type ImportItem,
} from '@/lib/pipeline/audio-schemas'
import { resolveAudio, type ResolveResult } from '@/lib/pipeline/audio-resolver'
import { mapJsonToDbRow, classifyImportItem, buildDiffLog, buildExportJson } from '@/lib/pipeline/audio-import'
import { sanitizeForFilter, sanitizeForTsquery } from '@/lib/pipeline/sanitize'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { pipelineLog } from '@/lib/pipeline/logger'

// ---------------------------------------------------------------------------
// List params
// ---------------------------------------------------------------------------

export interface AudioListParams {
  limit?: number
  cursor?: string
  type?: string
  status?: string
  category?: string
  tags?: string
  mood?: string
  energy_min?: string
  energy_max?: string
  bpm_min?: string
  bpm_max?: string
  subcategory?: string
  genre?: string
  source?: string
  reusable?: string
  q?: string
}

export interface AudioListResult {
  data: AudioAssetRow[]
  meta: { total: number; has_next: boolean; next_cursor: string | undefined; limit: number }
}

// ---------------------------------------------------------------------------
// Get-by-id result
// ---------------------------------------------------------------------------

export interface AudioGetResult extends AudioAssetRow {
  usage: Array<{
    id: string
    pipeline_item_id: string
    scene_number: number | null
    usage_type: string
    notes: string | null
    content_pipeline: { code: string; title_pt: string; format: string } | null
  }>
}

// ---------------------------------------------------------------------------
// Import result
// ---------------------------------------------------------------------------

export interface AudioImportResult {
  dry_run: boolean
  import_log_id?: string
  preview?: { to_create: number; to_update: number; to_skip: number; errors: never[] }
  created?: number
  updated?: number
  skipped?: number
  errors?: Array<{ asset_id: string; error: string }>
}

// ---------------------------------------------------------------------------
// Stats result
// ---------------------------------------------------------------------------

export interface AudioStatsResult {
  total: number
  by_type: { music: number; sfx: number }
  by_status: { downloaded: number; pending: number; retired: number }
  most_used: Array<{ asset_id: string; track_name: string | null; usage_count: number }>
  recently_added: number
  needs_download: number
  unused: number
}

// ---------------------------------------------------------------------------
// Export result
// ---------------------------------------------------------------------------

export type AudioExportResult = ReturnType<typeof buildExportJson>

// ---------------------------------------------------------------------------
// Retire result
// ---------------------------------------------------------------------------

export interface AudioRetireResult {
  id: string
  status: string
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/** List audio assets with cursor pagination, filtering and full-text search. */
export async function listAudioAssets(
  ctx: ServiceContext,
  params: AudioListParams,
): Promise<ServiceResult<AudioListResult>> {
  const rawLimit = Number(params.limit || '50')
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.round(rawLimit) : 50, 200))
  const cursor = params.cursor || undefined

  let query = ctx.supabase
    .from('audio_assets')
    .select('*', { count: 'exact' })
    .eq('site_id', ctx.siteId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (params.type && ['music', 'sfx'].includes(params.type)) query = query.eq('type', params.type)
  if (params.status && ['downloaded', 'pending', 'retired'].includes(params.status)) query = query.eq('status', params.status)
  if (params.category) query = query.eq('category', sanitizeForFilter(params.category))

  if (params.tags) {
    query = query.overlaps('tags', params.tags.split(',').map(t => sanitizeForFilter(t.trim())).filter(Boolean))
  }
  if (params.mood) {
    query = query.overlaps('mood', params.mood.split(',').map(m => sanitizeForFilter(m.trim())).filter(Boolean))
  }

  const safeInt = (v: string) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null }

  if (params.energy_min) { const n = safeInt(params.energy_min); if (n !== null) query = query.gte('energy', n) }
  if (params.energy_max) { const n = safeInt(params.energy_max); if (n !== null) query = query.lte('energy', n) }
  if (params.bpm_min) { const n = safeInt(params.bpm_min); if (n !== null) query = query.gte('bpm', n) }
  if (params.bpm_max) { const n = safeInt(params.bpm_max); if (n !== null) query = query.lte('bpm', n) }

  if (params.subcategory) query = query.eq('subcategory', sanitizeForFilter(params.subcategory))
  if (params.genre) query = query.eq('genre', sanitizeForFilter(params.genre))
  if (params.source) query = query.eq('source', sanitizeForFilter(params.source))

  if (params.reusable === 'true') query = query.eq('reusable', true)
  else if (params.reusable === 'false') query = query.eq('reusable', false)

  if (params.q) {
    const safe = sanitizeForTsquery(params.q)
    if (safe) query = query.textSearch('search_vector', safe, { type: 'websearch', config: 'english' })
  }

  if (cursor && UUID_REGEX.test(cursor)) {
    const { data: cursorItem } = await ctx.supabase
      .from('audio_assets')
      .select('created_at')
      .eq('id', cursor)
      .eq('site_id', ctx.siteId)
      .single()
    if (cursorItem) {
      query = query.or(`created_at.lt.${cursorItem.created_at},and(created_at.eq.${cursorItem.created_at},id.lt.${cursor})`)
    }
  }

  const { data, error, count } = await query.limit(limit + 1)
  if (error) {
    pipelineLog('error', 'audio-library', 'GET failed', { error })
    return fail('DB_ERROR', 'Failed to load assets', 500)
  }

  const hasNext = (data?.length ?? 0) > limit
  const items = (data?.slice(0, limit) ?? []) as AudioAssetRow[]
  const lastItem = items[items.length - 1] as { id: string } | undefined

  return ok({
    data: items,
    meta: { total: count ?? 0, has_next: hasNext, next_cursor: hasNext && lastItem ? lastItem.id : undefined, limit },
  })
}

/** Create a single audio asset after Zod validation. */
export async function createAudioAsset(
  ctx: ServiceContext,
  body: unknown,
): Promise<ServiceResult<AudioAssetRow>> {
  const parsed = AudioAssetCreateSchema.safeParse(body)
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  const { data, error } = await ctx.supabase
    .from('audio_assets')
    .insert({ ...parsed.data, site_id: ctx.siteId })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return fail('CONFLICT', 'Asset with this ID or SHA256 already exists', 409)
    }
    pipelineLog('error', 'audio-library', 'POST failed', { error })
    return fail('DB_ERROR', 'Failed to save asset', 500)
  }

  return ok(data as AudioAssetRow, 201)
}

/** Get a single audio asset by UUID, including usage records. */
export async function getAudioAsset(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<AudioGetResult>> {
  if (!UUID_REGEX.test(id)) return fail('VALIDATION_ERROR', 'Invalid ID format', 400)

  const { data: asset, error } = await ctx.supabase
    .from('audio_assets')
    .select('*')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (error) {
    pipelineLog('error', 'audio-library', 'GET by id failed', { error })
    if (error.code === 'PGRST116') return fail('NOT_FOUND', 'Asset not found', 404)
    return fail('DB_ERROR', 'Failed to load asset', 500)
  }
  if (!asset) return fail('NOT_FOUND', 'Asset not found', 404)

  const { data: usage } = await ctx.supabase
    .from('audio_asset_usage')
    .select('id, pipeline_item_id, scene_number, usage_type, notes, content_pipeline(code, title_pt, format)')
    .eq('audio_asset_id', id)
    .eq('site_id', ctx.siteId)

  return ok({ ...asset, usage: usage ?? [] } as AudioGetResult)
}

/** Update an audio asset with optimistic concurrency control (version check). */
export async function updateAudioAsset(
  ctx: ServiceContext,
  id: string,
  body: unknown,
): Promise<ServiceResult<AudioAssetRow>> {
  if (!UUID_REGEX.test(id)) return fail('VALIDATION_ERROR', 'Invalid ID format', 400)

  const parsed = AudioAssetUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  const { version, ...updates } = parsed.data
  const { data, error } = await ctx.supabase
    .from('audio_assets')
    .update(updates)
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .eq('version', version)
    .select('*')
    .single()

  if (error || !data) {
    const { data: exists } = await ctx.supabase
      .from('audio_assets')
      .select('id, version')
      .eq('id', id)
      .eq('site_id', ctx.siteId)
      .single()
    if (!exists) return fail('NOT_FOUND', 'Asset not found', 404)
    return fail('CONFLICT', `Version mismatch: expected ${version}, current ${exists.version}`, 409)
  }

  return ok(data as AudioAssetRow)
}

/** Soft-delete (retire) an audio asset. */
export async function retireAudioAsset(
  ctx: ServiceContext,
  id: string,
  options?: { dryRun?: boolean },
): Promise<ServiceResult<AudioRetireResult>> {
  if (!UUID_REGEX.test(id)) return fail('VALIDATION_ERROR', 'Invalid ID format', 400)

  if (options?.dryRun) {
    const { data: exists } = await ctx.supabase
      .from('audio_assets')
      .select('id, status')
      .eq('id', id)
      .eq('site_id', ctx.siteId)
      .single()
    if (!exists) return fail('NOT_FOUND', 'Asset not found', 404)
    return ok({ id: exists.id as string, status: 'retired' })
  }

  const { data, error } = await ctx.supabase
    .from('audio_assets')
    .update({ status: 'retired' })
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .select('id, status')
    .single()

  if (error || !data) return fail('NOT_FOUND', 'Asset not found', 404)

  return ok(data as AudioRetireResult)
}

/** Context-based smart matching — resolve the best audio assets for a query. */
export async function resolveAudioAssets(
  ctx: ServiceContext,
  body: unknown,
): Promise<ServiceResult<ResolveResult>> {
  const parsed = ResolveQuerySchema.safeParse(body)
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  try {
    const result = await resolveAudio(ctx.supabase, ctx.siteId, parsed.data)
    return ok(result)
  } catch (err) {
    pipelineLog('error', 'audio-library', 'resolve failed', { error: err })
    return fail('DB_ERROR', 'Failed to resolve audio', 500)
  }
}

/** Batch import audio assets from JSON (music + sfx), with dry-run support. */
export async function importAudioAssets(
  ctx: ServiceContext,
  body: unknown,
): Promise<ServiceResult<AudioImportResult>> {
  const parsed = ImportSchema.safeParse(body)
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  const { dry_run, schema_version, music, sfx } = parsed.data

  const allItems = [
    ...music.map(item => ({ ...item, _type: 'music' as const })),
    ...sfx.map(item => ({ ...item, _type: 'sfx' as const })),
  ]

  const assetIds = allItems.map(i => i.asset_id).filter(Boolean)
  const { data: existingRows } = await ctx.supabase
    .from('audio_assets')
    .select('asset_id, sha256, tags, mood, energy')
    .eq('site_id', ctx.siteId)
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
      diffLog.push(...buildDiffLog(existing as Record<string, unknown>, row))
    }
    toUpsert.push({ ...row, site_id: ctx.siteId, _classification: classification })
  }

  if (!dry_run && toUpsert.length > 0) {
    const BATCH_SIZE = 100
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE).map(({ _classification, ...row }) => row)
      const classifications = toUpsert.slice(i, i + BATCH_SIZE).map(r => r._classification)
      const { error } = await ctx.supabase
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
    return ok({
      dry_run: true,
      preview: { to_create: created, to_update: updated, to_skip: skipped, errors: [] as never[] },
    })
  }

  const { data: logRow } = await ctx.supabase
    .from('audio_import_log')
    .insert({
      site_id: ctx.siteId,
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
      imported_by: ctx.source === 'api_key' ? 'cowork' : 'cms_ui',
    })
    .select('id')
    .single()

  return ok({
    dry_run: false,
    import_log_id: logRow?.id as string | undefined,
    created,
    updated,
    skipped,
    errors,
  })
}

/** Full export of all non-retired audio assets as structured JSON. */
export async function exportAudioAssets(
  ctx: ServiceContext,
): Promise<ServiceResult<AudioExportResult>> {
  const PAGE_SIZE = 1000
  const MAX_EXPORT_ROWS = 50_000
  const allAssets: AudioAssetRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await ctx.supabase
      .from('audio_assets')
      .select('id, asset_id, original_filename, renamed_to, sha256, type, source, category, subcategory, genre, artist, track_name, artlist_url, duration_seconds, bpm, music_key, time_signature, energy, tempo_feel, tags, mood, instruments, use_cases, reuse_scenarios, reusable, status, priority, metadata, version, created_at, updated_at')
      .eq('site_id', ctx.siteId)
      .neq('status', 'retired')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      pipelineLog('error', 'audio-library', 'export DB query failed', { error })
      return fail('DB_ERROR', 'Failed to export assets', 500)
    }
    const rows = (data ?? []) as AudioAssetRow[]
    allAssets.push(...rows)
    if (allAssets.length >= MAX_EXPORT_ROWS) break
    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return ok(buildExportJson(allAssets))
}

/** Aggregate statistics for the audio library. */
export async function getAudioStats(
  ctx: ServiceContext,
): Promise<ServiceResult<AudioStatsResult>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [totalRes, musicRes, sfxRes, downloadedRes, pendingRes, retiredRes, recentRes, usageRes] = await Promise.all([
    ctx.supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', ctx.siteId),
    ctx.supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', ctx.siteId).eq('type', 'music'),
    ctx.supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', ctx.siteId).eq('type', 'sfx'),
    ctx.supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', ctx.siteId).eq('status', 'downloaded'),
    ctx.supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', ctx.siteId).eq('status', 'pending'),
    ctx.supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', ctx.siteId).eq('status', 'retired'),
    ctx.supabase.from('audio_assets').select('*', { count: 'exact', head: true }).eq('site_id', ctx.siteId).gte('created_at', thirtyDaysAgo),
    ctx.supabase.from('audio_asset_usage').select('audio_asset_id').eq('site_id', ctx.siteId).limit(10000),
  ])

  const usageList = (usageRes.data ?? []).map(r => r.audio_asset_id as string)
  const usageCount: Record<string, number> = {}
  for (const uid of usageList) usageCount[uid] = (usageCount[uid] ?? 0) + 1
  const topUsedIds = Object.entries(usageCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  let most_used: Array<{ asset_id: string; track_name: string | null; usage_count: number }> = []
  if (topUsedIds.length > 0) {
    const ids = topUsedIds.map(([id]) => id)
    const { data: topAssets } = await ctx.supabase
      .from('audio_assets')
      .select('id, asset_id, track_name')
      .eq('site_id', ctx.siteId)
      .in('id', ids)
    const assetMap = new Map((topAssets ?? []).map(a => [a.id, a]))
    most_used = topUsedIds.map(([id, count]) => {
      const a = assetMap.get(id)
      return { asset_id: a?.asset_id ?? id, track_name: a?.track_name ?? null, usage_count: count }
    })
  }

  const total = totalRes.count ?? 0
  const by_status = {
    downloaded: downloadedRes.count ?? 0,
    pending: pendingRes.count ?? 0,
    retired: retiredRes.count ?? 0,
  }

  return ok({
    total,
    by_type: { music: musicRes.count ?? 0, sfx: sfxRes.count ?? 0 },
    by_status,
    most_used,
    recently_added: recentRes.count ?? 0,
    needs_download: by_status.pending,
    unused: Math.max(0, total - new Set(usageList).size),
  })
}
