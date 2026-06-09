/**
 * Pipeline Items — transport-agnostic service layer.
 *
 * Extracted from 14 route handlers under `app/api/pipeline/items/`.
 * Every function takes a `ServiceContext` and returns `ServiceResult<T>`.
 * On errors, throws `PipelineServiceError`.
 */
import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  PipelineItemCreateSchema,
  PipelineItemUpdateSchema,
  FORMAT_METADATA_SCHEMAS,
  FORMATS,
  ChecklistToggleSchema,
  GraduateSchema,
  BulkOperationSchema,
  type Format,
} from '@/lib/pipeline/schemas'
import {
  generateCode,
  DEFAULT_CHECKLISTS,
  WORKFLOWS,
  isValidStage,
  getNextStage,
  getPreviousStage,
  isFinalStage,
  getStagePosition,
} from '@/lib/pipeline/workflows'
import {
  decodeCursor,
  encodeCursor,
  parseSortParam,
  applyPipelineFilters,
} from '@/lib/pipeline/queries'
import { sanitizeForFilter } from '@/lib/pipeline/sanitize'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { computeValidationScore, VVS_PUBLISH_THRESHOLD } from '@/lib/pipeline/validation'
import { getSectionKey, SectionPatchSchema, BatchSectionUpdateSchema } from '@/lib/pipeline/sections'
import type { SectionData } from '@/lib/pipeline/sections'
import { PosBriefSchema, ABDraftSchema } from '@/lib/pipeline/video-schemas'

// Typed VIDEO sections are validated on write with the SAME schema the editor uses on
// read — so "what writes, renders" (no more silently-stored content that fails the
// strict parse and shows as 'legado'). A bad shape is rejected here with the exact
// offending field paths, which doubles as live documentation for MCP/Cowork writers.
const TYPED_VIDEO_SECTION_SCHEMAS: Record<string, z.ZodTypeAny> = {
  postprod: PosBriefSchema,
  publish: ABDraftSchema,
}
import { linkPostToItem, unlinkPostFromItem } from '@/lib/pipeline/blog-link'
import { prepareBlogTranslationPatch } from '@/lib/pipeline/draft-to-blog'
import { CurriculumContentSchema } from '@/lib/pipeline/course-schemas'
import type { ServiceContext, ServiceResult } from './types'
import { PipelineServiceError } from './types'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function assertWrite(ctx: ServiceContext): void {
  const hasWrite = ctx.permissions.includes('write') || ctx.permissions.includes('admin')
  if (!hasWrite) {
    throw new PipelineServiceError('FORBIDDEN', 'Insufficient permissions', 403)
  }
}

function assertValidId(id: string): void {
  if (!UUID_REGEX.test(id)) {
    throw new PipelineServiceError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
}

function assertKnownFormat(format: string): asserts format is Format {
  if (!FORMATS.includes(format as Format)) {
    throw new PipelineServiceError('VALIDATION_ERROR', `Unknown format: ${format}`, 422)
  }
}

// ---------------------------------------------------------------------------
// Published read-only section guard (§3.9)
// ---------------------------------------------------------------------------

const PUBLISHED_READONLY_BASES = new Set(['ideia', 'roteiro', 'postprod', 'publish'])

/** True when a section base is frozen once the item is published (authoring payloads). */
export function isPublishedReadonlySection(sectionBase: string): boolean {
  return PUBLISHED_READONLY_BASES.has(sectionBase)
}

/** True when the format's stage is at/after the published position. */
export function isPublishedStage(format: string, stage: string): boolean {
  if (!stage) return false // missing/unknown stage = not published = editable (defensive)
  const pos = getStagePosition(format as never, stage)
  return pos >= 0 && pos >= getStagePosition(format as never, 'published')
}

// ---------------------------------------------------------------------------
// List items
// ---------------------------------------------------------------------------

export interface ListItemsParams {
  limit?: number
  cursor?: string
  sort?: string
  format?: string
  stage?: string
  lang?: string
  archived?: string
  priority_min?: string
  priority_max?: string
  tag?: string
  parent_id?: string
  graduated?: string
  assigned_to?: string
  stale_days?: string
  search?: string
}

/** List pipeline items with cursor-based pagination and filtering. */
export async function listItems(
  ctx: ServiceContext,
  params: ListItemsParams,
): Promise<ServiceResult<Record<string, unknown>[]>> {
  const limit = Math.min(params.limit ?? 50, 200)
  const { column, ascending } = parseSortParam(params.sort)

  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('content_pipeline')
    .select('*', { count: 'exact' })
    .eq('site_id', ctx.siteId)
    .order(column, { ascending })
    .order('id', { ascending })
    .limit(limit + 1)

  query = applyPipelineFilters(query, {
    format: params.format,
    stage: params.stage,
    lang: params.lang,
    archived: params.archived,
    priority_min: params.priority_min,
    priority_max: params.priority_max,
    tag: params.tag,
    parent_id: params.parent_id,
    graduated: params.graduated,
    assigned_to: params.assigned_to,
    stale_days: params.stale_days,
    search: params.search,
  })

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor)
    if (decoded) {
      const safeValue =
        /^[a-zA-Z0-9\-_:.T+Z]+$/.test(decoded.sort_value) &&
        decoded.sort_value.length <= 200
      if (UUID_REGEX.test(decoded.id) && safeValue) {
        const op = ascending ? 'gt' : 'lt'
        const safeSortValue = sanitizeForFilter(decoded.sort_value)
        query = query.or(
          `${column}.${op}.${safeSortValue},and(${column}.eq.${safeSortValue},id.gt.${decoded.id})`,
        )
      }
    }
  }

  const { data, error, count } = await query
  if (error) {
    console.error('[pipeline/items/listItems]', error.message)
    throw new PipelineServiceError('DB_ERROR', 'Failed to load items', 500)
  }

  const hasNext = (data?.length ?? 0) > limit
  const items = (data?.slice(0, limit) ?? []) as Record<string, unknown>[]
  const lastItem = items[items.length - 1]
  const nextCursor =
    hasNext && lastItem
      ? encodeCursor(String(lastItem[column] ?? ''), String(lastItem['id']))
      : undefined

  return {
    data: items,
    meta: { total: count ?? 0, has_next: hasNext, next_cursor: nextCursor, limit },
  }
}

// ---------------------------------------------------------------------------
// Create items
// ---------------------------------------------------------------------------

export interface CreateItemsParams {
  items: unknown[]
}

/** Create one or more pipeline items (max 50 per call). */
export async function createItems(
  ctx: ServiceContext,
  params: CreateItemsParams,
): Promise<ServiceResult<Record<string, unknown> | Record<string, unknown>[]>> {
  assertWrite(ctx)

  const { items } = params
  if (items.length > 50) {
    throw new PipelineServiceError('VALIDATION_ERROR', 'Max 50 items per batch', 400)
  }

  const parsed = items.map((item) => PipelineItemCreateSchema.safeParse(item))
  const firstError = parsed.find((p) => !p.success)
  if (firstError && !firstError.success) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      firstError.error.issues.map((i) => i.message).join(', '),
      400,
    )
  }

  for (const p of parsed) {
    if (!p.success) continue
    const format = p.data.format as Format
    const stage = p.data.stage || 'idea'
    if (!isValidStage(format, stage)) {
      throw new PipelineServiceError(
        'VALIDATION_ERROR',
        `Stage "${stage}" is not valid for format "${format}". Valid stages: ${WORKFLOWS[format].map((s) => s.stage).join(', ')}`,
        400,
      )
    }
    if (p.data.format_metadata && Object.keys(p.data.format_metadata).length > 0) {
      const metaResult = FORMAT_METADATA_SCHEMAS[format].safeParse(p.data.format_metadata)
      if (!metaResult.success) {
        throw new PipelineServiceError(
          'VALIDATION_ERROR',
          `Invalid format_metadata for ${format}: ${metaResult.error.issues.map((i) => i.message).join(', ')}`,
          400,
        )
      }
    }
  }

  const supabase = getSupabaseServiceClient()

  // Duplicate-story guard: one title = one item. Block creating a second NON-archived item
  // with the same normalized title in this site — otherwise a story fragments across ids
  // (you write to X, the link opens Y empty). Archived items don't count; pass a distinct
  // title or edit the existing item. (Pairs with the Cowork "work on the open item" lock.)
  const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase()
  const newTitles = new Set(
    parsed
      .flatMap((p) => (p.success ? [norm(p.data.title_pt), norm(p.data.title_en)] : []))
      .filter((t): t is string => t.length > 0),
  )
  if (newTitles.size > 0) {
    const { data: existingRows } = await supabase
      .from('content_pipeline')
      .select('id, title_pt, title_en')
      .eq('site_id', ctx.siteId)
      .eq('is_archived', false)
    const dup = (existingRows ?? []).find(
      (e: { id: string; title_pt: string | null; title_en: string | null }) =>
        (norm(e.title_pt).length > 0 && newTitles.has(norm(e.title_pt))) ||
        (norm(e.title_en).length > 0 && newTitles.has(norm(e.title_en))),
    )
    if (dup) {
      throw new PipelineServiceError(
        'CONFLICT',
        `An item with this title already exists (id ${dup.id}). Edit that item instead of creating a duplicate — one story = one id.`,
        409,
        { existing_id: dup.id },
      )
    }
  }

  const toInsert = parsed.map((p) => {
    if (!p.success) throw new Error('unreachable')
    const data = p.data
    const format = data.format as Format
    const title = data.title_pt || data.title_en || 'untitled'
    const code = data.code || generateCode(format, title, data.format_metadata)
    const checklist = data.production_checklist || DEFAULT_CHECKLISTS[format]

    return {
      site_id: ctx.siteId,
      code,
      title_pt: data.title_pt || null,
      title_en: data.title_en || null,
      format,
      stage: data.stage || 'idea',
      language: data.language,
      priority: data.priority,
      parent_id: data.parent_id || null,
      hook: data.hook || null,
      synopsis: data.synopsis || null,
      body_content: data.body_content || null,
      format_metadata: data.format_metadata,
      production_checklist: checklist,
      tags: data.tags,
      assigned_to: data.assigned_to || null,
    }
  })

  const { data: inserted, error } = await supabase
    .from('content_pipeline')
    .insert(toInsert)
    .select()

  if (error) {
    if (error.code === '23505') {
      throw new PipelineServiceError(
        'VALIDATION_ERROR',
        'Duplicate code. Please use a unique code.',
        409,
      )
    }
    throw new PipelineServiceError('VALIDATION_ERROR', 'Failed to create item', 400)
  }

  const isBatch = items.length > 1 || Array.isArray(items)
  return { data: isBatch ? (inserted as Record<string, unknown>[]) : (inserted?.[0] as Record<string, unknown>) }
}

// ---------------------------------------------------------------------------
// Get single item
// ---------------------------------------------------------------------------

/** Fetch a single pipeline item with its recent history and dependencies. */
export async function getItem(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  assertValidId(id)

  const supabase = getSupabaseServiceClient()
  const { data: item, error } = await supabase
    .from('content_pipeline')
    .select('*')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (error || !item) {
    throw new PipelineServiceError('NOT_FOUND', 'Item not found', 404)
  }

  const { data: history } = await supabase
    .from('content_pipeline_history')
    .select('*')
    .eq('pipeline_id', id)
    .order('changed_at', { ascending: false })
    .limit(20)

  const { data: deps } = await supabase
    .from('pipeline_dependencies')
    .select('blocker_id, blocked_id, dependency_type')
    .or(`blocker_id.eq.${id},blocked_id.eq.${id}`)

  const row = item as Record<string, unknown>
  return {
    data: { ...row, history: history ?? [], dependencies: deps ?? [] },
    meta: {
      version: row.version as number,
      etag: String(row.version),
      updated_at: row.updated_at as string,
    },
  }
}

// ---------------------------------------------------------------------------
// Update item (PATCH)
// ---------------------------------------------------------------------------

export interface UpdateItemParams {
  body: unknown
  expectedVersion: number
}

/** Update a pipeline item with optimistic concurrency control. */
export async function updateItem(
  ctx: ServiceContext,
  id: string,
  params: UpdateItemParams,
): Promise<ServiceResult<Record<string, unknown>>> {
  assertValidId(id)
  assertWrite(ctx)

  const { body, expectedVersion } = params

  const parsed = PipelineItemUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      parsed.error.issues.map((i) => i.message).join(', '),
      400,
    )
  }

  const supabase = getSupabaseServiceClient()

  const { data: current } = await supabase
    .from('content_pipeline')
    .select('version, format')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (!current) {
    throw new PipelineServiceError('NOT_FOUND', 'Item not found', 404)
  }

  assertKnownFormat(current.format)

  if (parsed.data.stage && !isValidStage(current.format as Format, parsed.data.stage)) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      `Stage "${parsed.data.stage}" is not valid for format "${current.format}". Valid stages: ${WORKFLOWS[current.format as Format].map((s) => s.stage).join(', ')}`,
      400,
    )
  }

  if (parsed.data.format_metadata && Object.keys(parsed.data.format_metadata).length > 0) {
    const metaResult = FORMAT_METADATA_SCHEMAS[current.format as Format].safeParse(
      parsed.data.format_metadata,
    )
    if (!metaResult.success) {
      throw new PipelineServiceError(
        'VALIDATION_ERROR',
        `Invalid format_metadata: ${metaResult.error.issues.map((i) => i.message).join(', ')}`,
        400,
      )
    }
  }

  if (current.version !== expectedVersion) {
    const { data: freshItem } = await supabase
      .from('content_pipeline')
      .select('*')
      .eq('id', id)
      .single()
    throw new PipelineServiceError(
      'VERSION_CONFLICT',
      `Version mismatch. Current: ${current.version}`,
      409,
      { current_version: current.version, your_version: expectedVersion, current_state: freshItem },
    )
  }

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update(updateData)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select()
    .single()

  if (error || !updated) {
    throw new PipelineServiceError(
      'VERSION_CONFLICT',
      'Concurrent modification detected',
      409,
    )
  }

  const row = updated as Record<string, unknown>
  return {
    data: row,
    meta: {
      version: row.version as number,
      etag: String(row.version),
      updated_at: row.updated_at as string,
    },
  }
}

// ---------------------------------------------------------------------------
// Archive (soft-delete) item
// ---------------------------------------------------------------------------

export interface ArchiveItemOptions {
  dryRun?: boolean
}

/** Soft-delete (archive) a pipeline item. */
export async function archiveItem(
  ctx: ServiceContext,
  id: string,
  options?: ArchiveItemOptions,
): Promise<ServiceResult<{ archived: boolean }>> {
  assertValidId(id)
  assertWrite(ctx)

  if (options?.dryRun) {
    // Verify item exists
    const supabase = getSupabaseServiceClient()
    const { data: item } = await supabase
      .from('content_pipeline')
      .select('id')
      .eq('id', id)
      .eq('site_id', ctx.siteId)
      .single()
    if (!item) throw new PipelineServiceError('NOT_FOUND', 'Item not found', 404)
    return { data: { archived: true }, meta: {} }
  }

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('content_pipeline')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: 'Archived via API',
    })
    .eq('id', id)
    .eq('site_id', ctx.siteId)

  if (error) {
    throw new PipelineServiceError('DB_ERROR', 'Failed to archive item', 400)
  }

  return { data: { archived: true } }
}

// ---------------------------------------------------------------------------
// Advance stage
// ---------------------------------------------------------------------------

export interface AdvanceItemOptions {
  dryRun?: boolean
}

/** Advance a pipeline item to the next workflow stage. */
export async function advanceItem(
  ctx: ServiceContext,
  id: string,
  options?: AdvanceItemOptions,
): Promise<ServiceResult<Record<string, unknown>>> {
  assertValidId(id)
  assertWrite(ctx)

  const supabase = getSupabaseServiceClient()
  const { data: item } = await supabase
    .from('content_pipeline')
    .select(
      'id, format, stage, version, site_id, title_pt, title_en, hook, synopsis, body_content, tags, production_checklist, format_metadata, validation_score',
    )
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (!item) throw new PipelineServiceError('NOT_FOUND', 'Item not found', 404)

  assertKnownFormat(item.format)
  const format: Format = item.format as Format
  const nextStage = getNextStage(format, item.stage)
  if (!nextStage) {
    throw new PipelineServiceError('INVALID_OPERATION', 'Already at final stage', 422)
  }

  // VVS threshold check for blog_post advancing to ready
  if (nextStage === 'ready' && format === 'blog_post') {
    const currentScore = (item.validation_score as number | null) ?? 0
    if (currentScore < VVS_PUBLISH_THRESHOLD) {
      throw new PipelineServiceError(
        'VVS_BELOW_THRESHOLD',
        'Score de validação insuficiente (mínimo 80%)',
        400,
      )
    }
  }

  // Hard dependency check
  const { data: deps } = await supabase
    .from('pipeline_dependencies')
    .select('blocker_id, dependency_type')
    .eq('blocked_id', id)
    .eq('dependency_type', 'hard')

  if (deps && deps.length > 0) {
    const { data: blockers } = await supabase
      .from('content_pipeline')
      .select('id, code, format, stage')
      .in(
        'id',
        deps.map((d) => d.blocker_id),
      )

    const unresolved = blockers?.filter(
      (b) =>
        FORMATS.includes(b.format as Format) &&
        !isFinalStage(b.format as Format, b.stage),
    )
    if (unresolved && unresolved.length > 0) {
      throw new PipelineServiceError(
        'DEPENDENCY_BLOCKED',
        'Hard dependencies not resolved',
        409,
        { blockers: unresolved },
      )
    }
  }

  // Soft dependency warnings
  const { data: softDeps } = await supabase
    .from('pipeline_dependencies')
    .select('blocker_id, dependency_type')
    .eq('blocked_id', id)
    .eq('dependency_type', 'soft')

  let warnings: string[] = []
  if (softDeps && softDeps.length > 0) {
    const { data: softBlockers } = await supabase
      .from('content_pipeline')
      .select('id, code, format, stage')
      .in(
        'id',
        softDeps.map((d) => d.blocker_id),
      )

    const pending = softBlockers?.filter(
      (b) =>
        FORMATS.includes(b.format as Format) &&
        !isFinalStage(b.format as Format, b.stage),
    )
    if (pending && pending.length > 0) {
      warnings = pending.map(
        (b) => `Soft dependency "${b.code}" still at stage "${b.stage}"`,
      )
    }
  }

  if (options?.dryRun) {
    return {
      data: { ...item, stage: nextStage } as Record<string, unknown>,
      meta: {
        version: item.version as number,
        etag: String(item.version),
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    }
  }

  // Persist stage change
  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: nextStage })
    .eq('id', id)
    .select()
    .single()

  if (error || !updated) {
    throw new PipelineServiceError('DB_ERROR', 'Failed to advance item', 400)
  }

  // Recompute VVS
  const score = computeValidationScore({
    title_pt: updated.title_pt,
    title_en: updated.title_en,
    hook: updated.hook,
    synopsis: updated.synopsis,
    body_content: updated.body_content,
    tags: updated.tags || [],
    production_checklist: updated.production_checklist || [],
    format_metadata: updated.format_metadata || {},
    format,
  })

  await supabase.from('content_pipeline').update({ validation_score: score }).eq('id', id)

  const row = updated as Record<string, unknown>
  const result: ServiceResult<Record<string, unknown>> = {
    data: { ...row, validation_score: score },
    meta: {
      version: row.version as number,
      etag: String(row.version),
      updated_at: row.updated_at as string,
    },
  }
  if (warnings.length > 0) result.warnings = warnings
  return result
}

// ---------------------------------------------------------------------------
// Retreat stage
// ---------------------------------------------------------------------------

/** Retreat a pipeline item to the previous workflow stage. */
export async function retreatItem(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  assertValidId(id)
  assertWrite(ctx)

  const supabase = getSupabaseServiceClient()
  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, format, stage, version')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (!item) throw new PipelineServiceError('NOT_FOUND', 'Item not found', 404)

  assertKnownFormat(item.format)
  const prevStage = getPreviousStage(item.format as Format, item.stage)
  if (!prevStage) {
    throw new PipelineServiceError('INVALID_OPERATION', 'Already at first stage', 422)
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: prevStage })
    .eq('id', id)
    .select()
    .single()

  if (error || !updated) {
    throw new PipelineServiceError('DB_ERROR', 'Failed to retreat item', 400)
  }

  const row = updated as Record<string, unknown>
  return {
    data: row,
    meta: {
      version: row.version as number,
      etag: String(row.version),
      updated_at: row.updated_at as string,
    },
  }
}

// ---------------------------------------------------------------------------
// Toggle checklist item
// ---------------------------------------------------------------------------

export interface ChecklistToggleParams {
  body: unknown
}

/** Toggle a production checklist item on a pipeline item. */
export async function toggleChecklist(
  ctx: ServiceContext,
  id: string,
  params: ChecklistToggleParams,
): Promise<ServiceResult<Record<string, unknown>>> {
  assertValidId(id)
  assertWrite(ctx)

  const parsed = ChecklistToggleSchema.safeParse(params.body)
  if (!parsed.success) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      parsed.error.issues.map((i) => i.message).join(', '),
      400,
    )
  }

  const { index, done } = parsed.data
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, production_checklist, version')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (!item) throw new PipelineServiceError('NOT_FOUND', 'Item not found', 404)

  const checklist = [
    ...((item.production_checklist ?? []) as Array<{
      label: string
      done: boolean
      toggled_at?: string
    }>),
  ]
  if (index >= checklist.length) {
    throw new PipelineServiceError('VALIDATION_ERROR', 'Index out of bounds', 400)
  }

  const current = checklist[index]!
  checklist[index] = {
    label: current.label,
    done,
    toggled_at: new Date().toISOString(),
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ production_checklist: checklist })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new PipelineServiceError('DB_ERROR', 'Failed to update checklist', 400)
  }

  const row = updated as Record<string, unknown>
  return {
    data: row,
    meta: {
      version: row.version as number,
      etag: String(row.version),
      updated_at: row.updated_at as string,
    },
  }
}

// ---------------------------------------------------------------------------
// Graduate item
// ---------------------------------------------------------------------------

export interface GraduateItemOptions {
  dryRun?: boolean
}

/** Graduate a pipeline item to a target entity (blog post, newsletter, campaign, or course). */
export async function graduateItem(
  ctx: ServiceContext,
  id: string,
  body: unknown,
  options?: GraduateItemOptions,
): Promise<ServiceResult<Record<string, unknown>>> {
  assertValidId(id)
  assertWrite(ctx)

  const parsed = GraduateSchema.safeParse(body)
  if (!parsed.success) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      parsed.error.issues.map((i) => i.message).join(', '),
      400,
    )
  }

  const { target } = parsed.data
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('*')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (!item) throw new PipelineServiceError('NOT_FOUND', 'Item not found', 404)

  const title = item.title_pt || item.title_en
  if (!title) {
    throw new PipelineServiceError(
      'INVALID_OPERATION',
      'Item must have a title to graduate',
      422,
    )
  }

  // ---- Course graduation ----
  if (target === 'course') {
    return graduateToCourse(ctx, id, item, title, options)
  }

  // ---- Blog / Newsletter / Campaign graduation ----
  const fkMap = {
    blog_post: 'blog_post_id',
    newsletter: 'newsletter_edition_id',
    campaign: 'campaign_id',
  } as const

  type FkTarget = keyof typeof fkMap
  const fkField = fkMap[target as FkTarget]

  if ((item as Record<string, unknown>)[fkField]) {
    throw new PipelineServiceError(
      'INVALID_OPERATION',
      `Already graduated to ${target}`,
      409,
    )
  }

  if (options?.dryRun) {
    return {
      data: { graduated: true, target, entity_id: null, dry_run: true },
    }
  }

  let entityId: string | null = null

  if (target === 'blog_post') {
    entityId = await graduateToBlogPost(ctx, id, item, title, supabase)
  } else if (target === 'newsletter') {
    entityId = await graduateToNewsletter(ctx, item, title, supabase)
  } else if (target === 'campaign') {
    entityId = await graduateToCampaign(ctx, item, title, supabase)
  }

  if (entityId && fkField) {
    const { error: updateFkError } = await supabase
      .from('content_pipeline')
      .update({ [fkField]: entityId })
      .eq('id', id)
    if (updateFkError) {
      throw new PipelineServiceError('DB_ERROR', updateFkError.message, 500)
    }

    const { error: historyFkError } = await supabase
      .from('content_pipeline_history')
      .insert({
        pipeline_id: id,
        event_type: 'graduated',
        to_value: `${target}:${entityId}`,
      })
    if (historyFkError) {
      throw new PipelineServiceError('DB_ERROR', historyFkError.message, 500)
    }
  }

  return { data: { graduated: true, target, entity_id: entityId } }
}

// -- Course sub-function --

async function graduateToCourse(
  ctx: ServiceContext,
  id: string,
  item: Record<string, unknown>,
  title: string,
  options?: GraduateItemOptions,
): Promise<ServiceResult<Record<string, unknown>>> {
  const supabase = getSupabaseServiceClient()

  const currSection = (item.sections as Record<string, unknown> | null)?.curriculum_shared as
    | { content?: unknown }
    | undefined
  const currParsed = CurriculumContentSchema.safeParse(currSection?.content ?? {})
  if (!currParsed.success) {
    throw new PipelineServiceError(
      'INVALID_OPERATION',
      'No valid curriculum found',
      422,
    )
  }
  const curriculum = currParsed.data
  const eligibleModules = curriculum.modules.filter(
    (m) =>
      m.lessons.length > 0 &&
      m.lessons.every((l) => l.production_status === 'ready'),
  )
  const skippedModules = curriculum.modules
    .filter((m) => !eligibleModules.includes(m))
    .map((m) => ({
      title: m.title,
      reason:
        m.lessons.length === 0
          ? 'No lessons'
          : 'Not all lessons are ready',
    }))
  if (eligibleModules.length === 0) {
    throw new PipelineServiceError(
      'INVALID_OPERATION',
      'No modules with all lessons ready',
      422,
    )
  }

  if (options?.dryRun) {
    return {
      data: {
        graduated: true,
        target: 'course',
        entity_id: null,
        dry_run: true,
        eligible_modules: eligibleModules.length,
        skipped_modules: skippedModules,
      },
    }
  }

  const existingPlaylistId = (
    item.format_metadata as Record<string, unknown> | null
  )?.playlist_id as string | undefined

  let playlistId: string

  if (existingPlaylistId) {
    const { data: existingPlaylist } = await supabase
      .from('playlists')
      .select('id')
      .eq('id', existingPlaylistId)
      .eq('site_id', ctx.siteId)
      .single()
    if (!existingPlaylist) {
      throw new PipelineServiceError(
        'VALIDATION_ERROR',
        'Referenced playlist not found or belongs to another site',
        403,
      )
    }
    playlistId = existingPlaylistId
  } else {
    const slug = (
      (item.code as string) ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    ).slice(0, 200)
    const { data: playlist, error } = await supabase
      .from('playlists')
      .insert({
        site_id: ctx.siteId,
        name_pt: (item.title_pt as string) || null,
        name_en: (item.title_en as string) || null,
        slug,
        category: 'course',
        status: 'draft',
      })
      .select('id')
      .single()
    if (error || !playlist) {
      throw new PipelineServiceError(
        'DB_ERROR',
        'Failed to create course playlist',
        500,
      )
    }
    playlistId = playlist.id
  }

  const allItems: Array<{
    playlist_id: string
    pipeline_id: string
    sort_order: number
  }> = []
  for (const mod of eligibleModules) {
    const sortedLessons = [...mod.lessons].sort(
      (a, b) => a.sort_order - b.sort_order,
    )
    for (const lesson of sortedLessons) {
      allItems.push({
        playlist_id: playlistId,
        pipeline_id: lesson.pipeline_ref || (item.id as string),
        sort_order: mod.sort_order * 1000 + lesson.sort_order,
      })
    }
  }

  const { data: insertedItems, error: upsertItemsError } = await supabase
    .from('playlist_items')
    .upsert(allItems, {
      onConflict: 'playlist_id,pipeline_id',
      ignoreDuplicates: true,
    })
    .select('id, sort_order')
  if (upsertItemsError) {
    throw new PipelineServiceError('DB_ERROR', upsertItemsError.message, 500)
  }

  const sortedInserted = (insertedItems ?? []).sort(
    (a, b) => a.sort_order - b.sort_order,
  )

  if (sortedInserted.length > 1) {
    const edges = sortedInserted.slice(1).map((edgeItem, i) => ({
      playlist_id: playlistId,
      source_item_id: sortedInserted[i]!.id,
      target_item_id: edgeItem.id,
      edge_type: 'sequence' as const,
    }))
    const { error: upsertEdgesError } = await supabase
      .from('playlist_edges')
      .upsert(edges, {
        onConflict: 'playlist_id,source_item_id,target_item_id',
        ignoreDuplicates: true,
      })
    if (upsertEdgesError) {
      throw new PipelineServiceError('DB_ERROR', upsertEdgesError.message, 500)
    }
  }

  const updatedMetadata = {
    ...((item.format_metadata as Record<string, unknown>) ?? {}),
    playlist_id: playlistId,
  }
  const { error: updateMetaError } = await supabase
    .from('content_pipeline')
    .update({ format_metadata: updatedMetadata })
    .eq('id', id)
  if (updateMetaError) {
    throw new PipelineServiceError('DB_ERROR', updateMetaError.message, 500)
  }

  const { error: historyError } = await supabase
    .from('content_pipeline_history')
    .insert({
      pipeline_id: id,
      event_type: 'graduated',
      to_value: `course:${playlistId}`,
    })
  if (historyError) {
    throw new PipelineServiceError('DB_ERROR', historyError.message, 500)
  }

  return {
    data: {
      graduated: true,
      target: 'course',
      entity_id: playlistId,
      skipped_modules: skippedModules,
    },
  }
}

// -- Blog post sub-function --

async function graduateToBlogPost(
  ctx: ServiceContext,
  id: string,
  item: Record<string, unknown>,
  title: string,
  supabase: ReturnType<typeof getSupabaseServiceClient>,
): Promise<string> {
  if (!item.created_by) {
    throw new PipelineServiceError(
      'INVALID_OPERATION',
      'Item has no creator — cannot resolve author',
      422,
    )
  }
  const { data: author } = await supabase
    .from('authors')
    .select('id')
    .eq('user_id', item.created_by as string)
    .single()
  if (!author) {
    throw new PipelineServiceError(
      'INVALID_OPERATION',
      'No author profile found for this user',
      422,
    )
  }

  const primaryLocale =
    (item.language as string) === 'en' ? 'en' : 'pt-br'
  const { data: post, error } = await supabase
    .from('blog_posts')
    .insert({
      site_id: ctx.siteId,
      author_id: author.id,
      status: 'draft',
      category: (item.category as string) ?? 'building',
      cover_image_url: (item.cover_image_url as string) ?? null,
      locale: primaryLocale,
    })
    .select('id')
    .single()
  if (error) {
    throw new PipelineServiceError('DB_ERROR', 'Failed to create blog post', 400)
  }

  const makeSlug = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 200)
  const sections = item.sections as Record<string, unknown> | null
  const excerptField = item.hook ? { excerpt: item.hook as string } : {}

  const locales: Array<{ locale: string; title: string }> = []
  if ((item.language as string) === 'both') {
    if (item.title_pt) locales.push({ locale: 'pt-br', title: item.title_pt as string })
    if (item.title_en) locales.push({ locale: 'en', title: item.title_en as string })
  } else {
    locales.push({ locale: primaryLocale, title })
  }

  const translations = await Promise.all(
    locales.map(async ({ locale, title: txTitle }) => {
      try {
        const patch = await prepareBlogTranslationPatch(sections, locale)
        if (patch) {
          return {
            post_id: post.id,
            locale,
            ...excerptField,
            ...patch,
            title: txTitle,
            slug: makeSlug(txTitle),
          }
        }
      } catch {
        // Best-effort: fall back to empty content
      }
      return {
        post_id: post.id,
        locale,
        title: txTitle,
        slug: makeSlug(txTitle),
        content_mdx: '',
        ...excerptField,
      }
    }),
  )

  if (translations.length > 0) {
    const { error: translationsError } = await supabase
      .from('blog_translations')
      .insert(translations)
    if (translationsError) {
      throw new PipelineServiceError('DB_ERROR', translationsError.message, 500)
    }
  }

  return post.id
}

// -- Newsletter sub-function --

async function graduateToNewsletter(
  ctx: ServiceContext,
  item: Record<string, unknown>,
  title: string,
  supabase: ReturnType<typeof getSupabaseServiceClient>,
): Promise<string> {
  const { data: edition, error } = await supabase
    .from('newsletter_editions')
    .insert({
      site_id: ctx.siteId,
      subject: title,
      status: 'draft',
      content: (item.body_content as string) || '',
    })
    .select('id')
    .single()
  if (error) {
    throw new PipelineServiceError(
      'DB_ERROR',
      'Failed to create newsletter edition',
      400,
    )
  }
  return edition.id
}

// -- Campaign sub-function --

async function graduateToCampaign(
  ctx: ServiceContext,
  item: Record<string, unknown>,
  title: string,
  supabase: ReturnType<typeof getSupabaseServiceClient>,
): Promise<string> {
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      site_id: ctx.siteId,
      name: title,
      slug:
        (item.code as string) ||
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 200),
      status: 'draft',
    })
    .select('id')
    .single()
  if (error) {
    throw new PipelineServiceError('DB_ERROR', 'Failed to create campaign', 400)
  }
  return campaign.id
}

// ---------------------------------------------------------------------------
// Restore item
// ---------------------------------------------------------------------------

/** Restore a previously archived pipeline item. */
export async function restoreItem(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  assertValidId(id)
  assertWrite(ctx)

  const supabase = getSupabaseServiceClient()
  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ is_archived: false, archived_at: null, archive_reason: null })
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .select()
    .single()

  if (error || !updated) {
    throw new PipelineServiceError('NOT_FOUND', 'Item not found', 404)
  }

  await supabase.from('content_pipeline_history').insert({
    pipeline_id: id,
    event_type: 'restored',
  })

  const row = updated as Record<string, unknown>
  return {
    data: row,
    meta: {
      version: row.version as number,
      etag: String(row.version),
      updated_at: row.updated_at as string,
    },
  }
}

// ---------------------------------------------------------------------------
// Get history
// ---------------------------------------------------------------------------

export interface GetHistoryParams {
  limit?: number
}

/** Fetch the change history for a pipeline item. */
export async function getHistory(
  ctx: ServiceContext,
  id: string,
  params?: GetHistoryParams,
): Promise<ServiceResult<Record<string, unknown>[]>> {
  assertValidId(id)

  const limit = Math.min(params?.limit ?? 50, 200)
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (!item) throw new PipelineServiceError('NOT_FOUND', 'Item not found', 404)

  const { data: history, error } = await supabase
    .from('content_pipeline_history')
    .select('*')
    .eq('pipeline_id', id)
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new PipelineServiceError('DB_ERROR', 'Failed to load history', 400)
  }

  return { data: (history ?? []) as Record<string, unknown>[] }
}

// ---------------------------------------------------------------------------
// Link blog post
// ---------------------------------------------------------------------------

const LinkSchema = z.object({
  blog_post_id: z.string().uuid(),
})

/** Link an existing blog post to a pipeline item. */
export async function linkBlogPost(
  ctx: ServiceContext,
  id: string,
  body: unknown,
): Promise<ServiceResult<{ linked: boolean; blog_post_id: string }>> {
  assertValidId(id)
  assertWrite(ctx)

  const parsed = LinkSchema.safeParse(body)
  if (!parsed.success) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      parsed.error.issues.map((i) => i.message).join(', '),
      400,
    )
  }

  const linkResult = await linkPostToItem(
    id,
    parsed.data.blog_post_id,
    ctx.siteId,
    null,
  )

  if (!linkResult.ok) {
    const status =
      linkResult.code === 'NOT_FOUND'
        ? 404
        : linkResult.code === 'FORBIDDEN'
          ? 403
          : linkResult.code === 'DUPLICATE' || linkResult.code === 'ALREADY_LINKED'
            ? 409
            : 400
    throw new PipelineServiceError(
      linkResult.code ?? 'LINK_FAILED',
      linkResult.error,
      status,
    )
  }

  return { data: { linked: true, blog_post_id: parsed.data.blog_post_id } }
}

// ---------------------------------------------------------------------------
// Unlink blog post
// ---------------------------------------------------------------------------

/** Unlink the blog post currently linked to a pipeline item. */
export async function unlinkBlogPost(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<{ unlinked: boolean }>> {
  assertValidId(id)
  assertWrite(ctx)

  const unlinkResult = await unlinkPostFromItem(id, ctx.siteId, null)
  if (!unlinkResult.ok) {
    throw new PipelineServiceError('UNLINK_FAILED', unlinkResult.error, 400)
  }

  return { data: { unlinked: true } }
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

const PublishBodySchema = z.object({
  targetStage: z.enum(['published', 'scheduled']),
  scheduledFor: z.string().datetime().nullable().optional(),
})

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'scheduled'],
  scheduled: ['published'],
}

export interface PublishItemOptions {
  dryRun?: boolean
}

/** Publish or schedule a blog_post pipeline item. */
export async function publishItem(
  ctx: ServiceContext,
  id: string,
  body: unknown,
  options?: PublishItemOptions,
): Promise<ServiceResult<{ ok: boolean; targetStage: string; blogPostId: string }>> {
  assertValidId(id)
  assertWrite(ctx)

  const parsed = PublishBodySchema.safeParse(body)
  if (!parsed.success) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      parsed.error.issues.map((i) => i.message).join(', '),
      400,
    )
  }

  const { targetStage, scheduledFor } = parsed.data

  if (targetStage === 'scheduled' && !scheduledFor) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      'scheduledFor is required for scheduled stage',
      422,
    )
  }
  if (targetStage === 'scheduled' && scheduledFor) {
    const scheduledDate = new Date(scheduledFor)
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      throw new PipelineServiceError(
        'VALIDATION_ERROR',
        'scheduledFor must be a valid future date',
        422,
      )
    }
  }

  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, format, blog_post_id, site_id, version, stage, validation_score')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .maybeSingle()

  if (!item) {
    throw new PipelineServiceError('NOT_FOUND', 'Pipeline item not found', 404)
  }
  if (((item.validation_score as number | null) ?? 0) < VVS_PUBLISH_THRESHOLD) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      `VVS score must be at least ${VVS_PUBLISH_THRESHOLD} to publish`,
      422,
    )
  }
  if (item.format !== 'blog_post') {
    throw new PipelineServiceError(
      'INVALID_OPERATION',
      'Publish action is only available for blog_post format',
      422,
    )
  }
  if (!item.blog_post_id) {
    throw new PipelineServiceError(
      'INVALID_OPERATION',
      'Pipeline item must be graduated to a blog post first',
      422,
    )
  }

  const { data: blogPost } = await supabase
    .from('blog_posts')
    .select('id, status')
    .eq('id', item.blog_post_id as string)
    .eq('site_id', ctx.siteId)
    .maybeSingle()

  if (!blogPost) {
    throw new PipelineServiceError('NOT_FOUND', 'Linked blog post not found', 404)
  }

  const allowed = VALID_TRANSITIONS[blogPost.status as string] ?? []
  if (!allowed.includes(targetStage)) {
    throw new PipelineServiceError(
      'INVALID_OPERATION',
      `Cannot transition blog post from "${blogPost.status}" to "${targetStage}"`,
      422,
    )
  }

  if (options?.dryRun) {
    return {
      data: {
        ok: true,
        targetStage,
        blogPostId: item.blog_post_id as string,
      },
    }
  }

  // Update blog post status
  const patch: Record<string, unknown> = { status: targetStage }
  if (targetStage === 'published') {
    patch.published_at = new Date().toISOString()
  }
  if (targetStage === 'scheduled') {
    patch.scheduled_for = scheduledFor
  }

  const { error: updateError } = await supabase
    .from('blog_posts')
    .update(patch)
    .eq('id', item.blog_post_id as string)
    .eq('site_id', ctx.siteId)
    .eq('status', blogPost.status as string)

  if (updateError) {
    console.error('[publish] blog_posts update failed:', updateError.message)
    throw new PipelineServiceError('DB_ERROR', 'Failed to update blog post', 500)
  }

  // Advance pipeline item stage (optimistic concurrency via version guard)
  const { error: stageError, count: stageCount } = await supabase
    .from('content_pipeline')
    .update(
      { stage: targetStage, version: (item.version as number) + 1 },
      { count: 'exact' },
    )
    .eq('id', id)
    .eq('version', item.version as number)

  if (stageError) {
    console.error('[publish] pipeline stage update failed:', stageError.message)
    throw new PipelineServiceError(
      'DB_ERROR',
      'Failed to advance pipeline stage',
      500,
    )
  }
  if (stageCount === 0) {
    throw new PipelineServiceError(
      'VERSION_CONFLICT',
      'Pipeline item was modified concurrently. Reload and try again.',
      409,
    )
  }

  // Record history (best-effort — log but don't fail the request)
  const { error: historyError } = await supabase
    .from('content_pipeline_history')
    .insert({
      pipeline_id: id,
      event_type: 'stage_changed',
      from_value: item.stage as string,
      to_value: targetStage,
      changed_by: null,
    })
  if (historyError) {
    console.error(
      '[publish] Failed to insert pipeline history:',
      historyError.message,
    )
  }

  return {
    data: {
      ok: true,
      targetStage,
      blogPostId: item.blog_post_id as string,
    },
  }
}

// ---------------------------------------------------------------------------
// Get section
// ---------------------------------------------------------------------------

export interface GetSectionParams {
  section: string
  lang?: string
}

/** Fetch a single section from a pipeline item. */
export async function getSection(
  ctx: ServiceContext,
  id: string,
  params: GetSectionParams,
): Promise<ServiceResult<SectionData | null>> {
  assertValidId(id)

  const lang = params.lang || 'en'

  const supabase = getSupabaseServiceClient()
  const { data: item, error } = await supabase
    .from('content_pipeline')
    .select('id, format, language, version, sections')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (error || !item) {
    throw new PipelineServiceError('NOT_FOUND', 'Item not found', 404)
  }

  const sectionKey = getSectionKey(params.section, lang, item.format as Format)

  const sections = (item.sections ?? {}) as Record<string, SectionData>
  const sectionData = sections[sectionKey] ?? null

  return {
    data: sectionData,
    meta: {
      section_key: sectionKey,
      item_version: item.version as number,
      exists: sectionData !== null,
    },
  }
}

// ---------------------------------------------------------------------------
// Patch section
// ---------------------------------------------------------------------------

export interface PatchSectionParams {
  section: string
  lang?: string
  body: unknown
  expectedVersion: number
}

/** Update a single section on a pipeline item with optimistic locking. */
export async function patchSection(
  ctx: ServiceContext,
  id: string,
  params: PatchSectionParams,
): Promise<ServiceResult<SectionData>> {
  assertValidId(id)
  assertWrite(ctx)

  const parsed = SectionPatchSchema.safeParse(params.body)
  if (!parsed.success) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Invalid request body',
      400,
    )
  }

  const lang = params.lang || 'en'

  const supabase = getSupabaseServiceClient()

  const { data: item, error: fetchError } = await supabase
    .from('content_pipeline')
    .select('id, version, format, stage, sections')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()

  if (fetchError || !item) {
    throw new PipelineServiceError('NOT_FOUND', 'Item not found', 404)
  }

  // Data-layer published freeze (§3.9): teleprompter spoken/cursor are session-only and never PATCH,
  // so they are unaffected; ideia/roteiro/postprod/publish writes are rejected when published.
  if (isPublishedStage(item.format, item.stage) && isPublishedReadonlySection(params.section)) {
    throw new PipelineServiceError(
      'FORBIDDEN',
      'Section is read-only while published',
      403,
      { stage: item.stage },
    )
  }

  const sectionKey = getSectionKey(params.section, lang, item.format as Format)

  if (item.version !== params.expectedVersion) {
    throw new PipelineServiceError(
      'PRECONDITION_FAILED',
      'Version mismatch',
      412,
      {
        expected: params.expectedVersion,
        current: item.version,
      },
    )
  }

  // Typed video sections: reject a wrong shape NOW (with field paths) instead of storing
  // it raw and letting the editor's strict read fall back to "Pós legado / somente leitura".
  if (item.format === 'video') {
    const typedSchema = TYPED_VIDEO_SECTION_SCHEMAS[params.section]
    if (typedSchema) {
      // A string here means a JSON payload that failed to parse upstream — almost always
      // the MCP transport (mcp-remote/desktop client) truncating a large tool-call argument.
      // Surface the real diagnosis instead of a cryptic "Expected object, received string".
      if (typeof parsed.data.content === 'string') {
        const len = parsed.data.content.length
        throw new PipelineServiceError(
          'VALIDATION_ERROR',
          `'${params.section}' content arrived as a string (${len} chars), not a JSON object. ` +
            `This is usually the MCP transport truncating a large payload (~1.5KB+). Send a leaner object, ` +
            `or split the detail into the roteiro/notes.`,
          400,
          { section: params.section, received: 'string', length: len },
        )
      }
      const contentCheck = typedSchema.safeParse(parsed.data.content)
      if (!contentCheck.success) {
        const fields = contentCheck.error.issues
          .slice(0, 10)
          .map((iss) => `${iss.path.join('.') || '(root)'}: ${iss.message}`)
          .join('; ')
        throw new PipelineServiceError(
          'VALIDATION_ERROR',
          `Invalid '${params.section}' content for a video item — fix these fields: ${fields}`,
          400,
          { section: params.section, issues: contentCheck.error.issues },
        )
      }
    }
  }

  const sections = (item.sections ?? {}) as Record<string, SectionData>
  const existing = sections[sectionKey]
  if (existing && existing.rev !== parsed.data.rev) {
    throw new PipelineServiceError('CONFLICT', 'Section revision mismatch', 409, {
      expected_rev: parsed.data.rev,
      current_rev: existing.rev,
    })
  }

  const newRev = (existing?.rev ?? 0) + 1
  const updatedSection: SectionData = {
    rev: newRev,
    cowork_rev: existing?.cowork_rev ?? null,
    source: parsed.data.source ?? existing?.source ?? 'user',
    edited:
      (parsed.data.source ?? 'user') === 'user' || existing?.edited === true,
    content: parsed.data.content,
    updated_at: new Date().toISOString(),
    modified_by: parsed.data.modified_by ?? null,
  }

  const newSections = { ...sections, [sectionKey]: updatedSection }

  const { data: updated, error: updateError } = await supabase
    .from('content_pipeline')
    .update({
      sections: newSections,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('version', params.expectedVersion)
    .select('version')
    .single()

  if (updateError || !updated) {
    throw new PipelineServiceError(
      'CONFLICT',
      'Concurrent update detected',
      409,
    )
  }

  return {
    data: updatedSection,
    meta: {
      section_key: sectionKey,
      item_version: updated.version as number,
    },
  }
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

export interface BulkOperationResult {
  results: Array<{ id: string; ok: boolean; error?: string }>
  success_count: number
  failure_count: number
}

export interface BulkOperationOptions {
  dryRun?: boolean
}

/** Execute multiple operations (advance, retreat, archive, restore, tag, update) in a single call. */
export async function bulkOperate(
  ctx: ServiceContext,
  body: unknown,
  options?: BulkOperationOptions,
): Promise<ServiceResult<BulkOperationResult>> {
  assertWrite(ctx)

  const parsed = BulkOperationSchema.safeParse(body)
  if (!parsed.success) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      parsed.error.issues.map((i) => i.message).join(', '),
      400,
    )
  }

  const supabase = getSupabaseServiceClient()

  // Phase 1: Validate all operations — no writes, collect all errors
  type ValidatedOp = {
    op: (typeof parsed.data.operations)[number]
    writeData?: Record<string, unknown>
  }
  const validated: ValidatedOp[] = []
  const errors: Array<{ id: string; error: string }> = []

  for (const op of parsed.data.operations) {
    if (op.op === 'advance') {
      const { data: item } = await supabase
        .from('content_pipeline')
        .select('id, format, stage')
        .eq('id', op.id)
        .eq('site_id', ctx.siteId)
        .single()
      if (!item) {
        errors.push({ id: op.id, error: 'Not found' })
        continue
      }
      if (!FORMATS.includes(item.format as Format)) {
        errors.push({ id: op.id, error: 'Unknown format' })
        continue
      }
      const next = getNextStage(item.format as Format, item.stage)
      if (!next) {
        errors.push({ id: op.id, error: 'Already at final stage' })
        continue
      }
      validated.push({ op, writeData: { stage: next } })
    } else if (op.op === 'retreat') {
      const { data: item } = await supabase
        .from('content_pipeline')
        .select('id, format, stage')
        .eq('id', op.id)
        .eq('site_id', ctx.siteId)
        .single()
      if (!item) {
        errors.push({ id: op.id, error: 'Not found' })
        continue
      }
      if (!FORMATS.includes(item.format as Format)) {
        errors.push({ id: op.id, error: 'Unknown format' })
        continue
      }
      const prev = getPreviousStage(item.format as Format, item.stage)
      if (!prev) {
        errors.push({ id: op.id, error: 'Already at first stage' })
        continue
      }
      validated.push({ op, writeData: { stage: prev } })
    } else if (op.op === 'archive') {
      validated.push({
        op,
        writeData: {
          is_archived: true,
          archived_at: new Date().toISOString(),
        },
      })
    } else if (op.op === 'restore') {
      validated.push({
        op,
        writeData: {
          is_archived: false,
          archived_at: null,
          archive_reason: null,
        },
      })
    } else if (op.op === 'tag') {
      const { data: item } = await supabase
        .from('content_pipeline')
        .select('tags')
        .eq('id', op.id)
        .eq('site_id', ctx.siteId)
        .single()
      if (!item) {
        errors.push({ id: op.id, error: 'Not found' })
        continue
      }
      const toAdd = op.data?.add ?? []
      const toRemove = op.data?.remove ?? []
      const tags = Array.from(
        new Set([...((item.tags as string[]) || []), ...toAdd]),
      ).filter((t: string) => !toRemove.includes(t))
      validated.push({ op, writeData: { tags } })
    } else if (op.op === 'update') {
      const { data: item } = await supabase
        .from('content_pipeline')
        .select('version')
        .eq('id', op.id)
        .eq('site_id', ctx.siteId)
        .single()
      if (!item) {
        errors.push({ id: op.id, error: 'Not found' })
        continue
      }
      if (item.version !== op.version) {
        errors.push({
          id: op.id,
          error: `Version conflict. Current: ${item.version}`,
        })
        continue
      }
      validated.push({ op })
    }
  }

  // If any validation failed, reject the entire batch
  if (errors.length > 0) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      `${errors.length} operation(s) failed validation`,
      400,
      { errors },
    )
  }

  // Dry run: return what would happen
  if (options?.dryRun) {
    const dryResults = validated.map(({ op }) => ({
      id: op.id,
      ok: true,
    }))
    return {
      data: {
        results: dryResults,
        success_count: dryResults.length,
        failure_count: 0,
      },
    }
  }

  // Phase 2: Execute all writes — all validations passed
  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const { op, writeData } of validated) {
    try {
      if (
        op.op === 'advance' ||
        op.op === 'retreat' ||
        op.op === 'archive' ||
        op.op === 'restore' ||
        op.op === 'tag'
      ) {
        await supabase
          .from('content_pipeline')
          .update(writeData!)
          .eq('id', op.id)
          .eq('site_id', ctx.siteId)
        results.push({ id: op.id, ok: true })
      } else if (op.op === 'update') {
        const { data, error } = await supabase
          .from('content_pipeline')
          .update(op.data)
          .eq('id', op.id)
          .eq('site_id', ctx.siteId)
          .eq('version', op.version)
          .select()
          .single()
        if (error || !data) {
          results.push({
            id: op.id,
            ok: false,
            error: 'Version conflict (concurrent modification)',
          })
          continue
        }
        results.push({ id: op.id, ok: true })
      }
    } catch {
      results.push({ id: op.id, ok: false, error: 'Operation failed' })
    }
  }

  const allOk = results.every((r) => r.ok)
  return {
    data: {
      results,
      success_count: results.filter((r) => r.ok).length,
      failure_count: results.filter((r) => !r.ok).length,
    },
    meta: allOk ? undefined : { total: results.length },
  }
}

// ---------------------------------------------------------------------------
// Batch section updates
// ---------------------------------------------------------------------------

export interface BatchSectionResult {
  item_id: string
  section_key: string
  ok: boolean
  data?: SectionData
  meta?: { item_version: number }
  error?: { code: string; message: string }
}

export interface BatchSectionsResponse {
  results: BatchSectionResult[]
  summary: { total: number; succeeded: number; failed: number }
}

/** Update multiple sections across pipeline items in one call. */
export async function batchUpdateSections(
  ctx: ServiceContext,
  body: unknown,
): Promise<ServiceResult<BatchSectionsResponse>> {
  assertWrite(ctx)

  const parsed = BatchSectionUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Invalid request body',
      400,
    )
  }

  const supabase = getSupabaseServiceClient()
  const results: BatchSectionResult[] = []

  // Group updates by item ID for efficient DB access
  const itemGroups = new Map<string, typeof parsed.data.updates>()
  for (const update of parsed.data.updates) {
    const group = itemGroups.get(update.item_id) ?? []
    group.push(update)
    itemGroups.set(update.item_id, group)
  }

  for (const [itemId, updates] of itemGroups) {
    const { data: item, error: fetchError } = await supabase
      .from('content_pipeline')
      .select('id, version, format, sections')
      .eq('id', itemId)
      .eq('site_id', ctx.siteId)
      .single()

    if (fetchError || !item) {
      for (const u of updates) {
        results.push({
          item_id: itemId,
          section_key: getSectionKey(u.section, u.lang, (u.format ?? 'video') as Format),
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Item not found' },
        })
      }
      continue
    }

    const currentVersion = item.version as number
    let currentSections = (item.sections ?? {}) as Record<
      string,
      SectionData
    >

    for (const update of updates) {
      const sectionKey = getSectionKey(update.section, update.lang, item.format as Format)
      const existing = currentSections[sectionKey]
      const newRev = (existing?.rev ?? 0) + 1

      const updatedSection: SectionData = {
        rev: newRev,
        cowork_rev: existing?.cowork_rev ?? null,
        source: update.source,
        edited: update.source === 'user' || existing?.edited === true,
        content: update.content,
        updated_at: new Date().toISOString(),
        modified_by: update.modified_by ?? null,
      }

      currentSections = {
        ...currentSections,
        [sectionKey]: updatedSection,
      }
      results.push({
        item_id: itemId,
        section_key: sectionKey,
        ok: true,
        data: updatedSection,
        meta: { item_version: 0 },
      })
    }

    const { data: updated, error: updateError } = await supabase
      .from('content_pipeline')
      .update({
        sections: currentSections,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('version', currentVersion)
      .select('version')
      .single()

    if (updateError || !updated) {
      for (const r of results) {
        if (r.item_id === itemId && r.ok) {
          r.ok = false
          r.data = undefined
          r.meta = undefined
          r.error = {
            code: 'CONFLICT',
            message: 'Concurrent update detected, retry',
          }
        }
      }
    } else {
      for (const r of results) {
        if (r.item_id === itemId && r.ok && r.meta) {
          r.meta.item_version = updated.version as number
        }
      }
    }
  }

  const succeeded = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length

  return {
    data: {
      results,
      summary: { total: results.length, succeeded, failed },
    },
  }
}
