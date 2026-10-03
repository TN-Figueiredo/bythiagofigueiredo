/**
 * The forja's single queue (Observatório v2, Task 30): one table, `youtube_intelligence_tasks`, for the Health Coach
 * ('diagnostico', per channel) and the observatory readings (one type × one target: a niche, or a video).
 *
 *  - askReading / cancelReading: the screen's "Pedir leitura à forja" (the engine's planAsk decides; this writes).
 *  - claim: the ONLY claim CAS. With `opts.heartbeat` (only the forja's typed claim, R46/R52) it records the
 *    heartbeat first, even on an empty queue; every other caller never writes it. It shows a caller only
 *    'diagnostico' unless it announced observatory types — the old worker and the legacy GET are unchanged.
 *  - readSent: the data sent to the forja, built on the first read and frozen into `task.sent` PER TASK (R55): a
 *    requeued attempt (fail with retry, the vigia) reads the same frozen data, so a retry cites the same numbers.
 *  - refuseTask / completeReading: how the forja ends an observatory task.
 *
 * Quota: 1 request per niche + type per São Paulo day; failure and refusal do not count (forja/quota.ts).
 * One request = one type × one target, one claim per tick (coupled budget, CLAUDE.md).
 */
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import type { ServiceContext, ServiceResult } from './types'
import { ok, err } from './types'
import type { IntelTask } from './youtube'
import type { NicheScope } from '@/lib/youtube/observatorio/niche'
import type { Fmt, ForjaRequest, Niche } from '@/lib/youtube/observatorio/types'
import { machineOf } from '@/lib/youtube/observatorio/forja/states'
import { planAsk, type SessionOpts } from '@/lib/youtube/observatorio/forja/session'
import { canonicalNumberTokens, normalizeNumberToken } from '@/lib/youtube/observatorio/forja/numbers'
import { spDayStart } from '@/lib/youtube/observatorio/time'
import { NICHES } from '@/lib/youtube/observatorio/rules'
import { loadDataset, taskRowToRequest, TASK_COLS, type TaskRow } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildSent, TargetUnavailableError, type SentPack } from '@/lib/youtube/observatorio/forja/sent'

export const OBS_TYPES = ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas', 'leitura-video'] as const
export type ObsType = typeof OBS_TYPES[number]
export const isObsType = (t: unknown): t is ObsType => typeof t === 'string' && (OBS_TYPES as readonly string[]).includes(t)

export interface AskInput { type: ObsType; scope: NicheScope; videoId?: string; fmt?: Fmt; userId: string }
export interface AskOutcome {
  ok: boolean; reason: string | null
  results: Array<{ niche: Niche; ok: boolean; reason: string | null; taskId?: string; channelsOut?: Array<{ id: string; reason: string }> }>
}

const TASKS = 'youtube_intelligence_tasks'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** A channel id that cannot break out of a PostgREST `in.(…)` list. claim() already demands UUIDs. */
const SAFE_ID = /^[A-Za-z0-9_-]+$/
/** Closed column list, never '*': error_message and result_summary may carry text written by a narrow key. */
const CLAIM_COLS = 'id, site_id, channel_id, trigger_type, requested_at, started_at, task_type, target_niche, target_video_id, target_fmt'
/** readQueue page size = PostgREST max_rows (supabase/config.toml); a bigger page would be truncated silently. */
const QUEUE_PAGE = 1000
const REFUSED_REASON_MAX = 200
/**
 * Ruling R51: a conflicting reading (same task_id) is treated as abandoned only when it is older than this. A younger
 * one may belong to a concurrent POST still between its insert and its CAS; deleting it would complete the task with
 * no reading. An insert → CAS takes milliseconds, so 60 s leaves a wide margin.
 */
export const ORPHAN_READING_MIN_AGE_MS = 60_000

const iso = (ms: number) => new Date(ms).toISOString()
const isWideKey = (ctx: ServiceContext) => ctx.permissions.includes('write') || ctx.permissions.includes('admin')
/** Announced types: known ones only, each once, in the order sent. */
const announced = (types: readonly unknown[] | undefined): ObsType[] => [...new Set((types ?? []).filter(isObsType))]

/* ------------------------------------------------------------------------------------------------ claim */

/**
 * The PostgREST `.or()` of the claim: 'diagnostico' for the caller's channels (all channels when it names none —
 * the legacy GET), plus the observatory types it announced. Unknown types and ids with PostgREST syntax are dropped;
 * if channels were named but none survives, the diagnostico clause goes away (never widens). null = nothing to claim.
 */
export function claimFilter(channelIds: readonly string[], taskTypes: readonly ObsType[] | undefined): string | null {
  const ids = channelIds.filter(id => SAFE_ID.test(id)), types = announced(taskTypes)
  const parts: string[] = []
  if (!channelIds.length) parts.push('task_type.eq.diagnostico')
  else if (ids.length) parts.push('and(task_type.eq.diagnostico,channel_id.in.(' + ids.join(',') + '))')
  if (types.length) parts.push('task_type.in.(' + types.join(',') + ')')
  return parts.length ? parts.join(',') : null
}

/**
 * The machine's heartbeat: last poll, the types it reads, the key. A failed write never blocks the claim (the screen
 * would say "sem máquina" while the machine works — visible, and it goes to Sentry).
 */
export async function recordHeartbeat(ctx: ServiceContext, capabilities: ObsType[], now: number): Promise<void> {
  const { error } = await ctx.supabase.from('forja_heartbeat').upsert(
    { site_id: ctx.siteId, last_poll_at: iso(now), capabilities: announced(capabilities), key_id: ctx.keyId ?? null },
    { onConflict: 'site_id' },
  )
  if (error) Sentry.captureMessage('forja heartbeat write failed: ' + error.message, { extra: { siteId: ctx.siteId } })
}

/**
 * Options of a claim. `heartbeat` is passed ONLY by the forja's typed claim path (POST …/task/claim with task_types,
 * ruling R46): the legacy GET, MCP claim_task and Cowork claims never touch forja_heartbeat — a Cowork claim must not
 * make a dead machine look alive nor wipe the capabilities it announced.
 */
export interface ClaimOptions { heartbeat?: { capabilities: ObsType[] } }

/**
 * Claim the oldest pending task the caller may take, via optimistic CAS. A DB error is never flattened into
 * "queue empty" (a 204 would leave the worker looping against a broken queue). With `opts.heartbeat`, the heartbeat
 * is written first — on every such call, even when the queue is empty.
 */
export async function claim(ctx: ServiceContext, input: { channelIds: string[]; taskTypes?: ObsType[] }, now: number, opts: ClaimOptions = {}): Promise<ServiceResult<IntelTask | null>> {
  const { supabase, siteId } = ctx
  const bad = input.channelIds.filter(id => !UUID.test(id))
  if (bad.length) return err('VALIDATION_ERROR', 'channel_ids: not a uuid: ' + bad.slice(0, 3).join(', '), 400)
  const types = announced(input.taskTypes)
  if (opts.heartbeat) await recordHeartbeat(ctx, opts.heartbeat.capabilities, now)

  const filter = claimFilter(input.channelIds, types.length ? types : undefined)
  if (filter == null) return ok(null)
  const { data: task, error: selectError } = await supabase
    .from(TASKS)
    .select('id')
    .eq('site_id', siteId)
    .eq('status', 'pending')
    .or(filter)
    .order('requested_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (selectError) return err('INTERNAL_ERROR', 'Failed to read the task queue', 500)
  if (!task) return ok(null)

  const { data: claimed, error: updateError } = await supabase
    .from(TASKS)
    .update({ status: 'running', started_at: iso(now), result_summary: { claimed_by: ctx.keyId ?? null } })
    .eq('id', (task as { id: string }).id)
    .eq('site_id', siteId)
    .eq('status', 'pending')
    .select(CLAIM_COLS)
    .maybeSingle()
  if (updateError) return err('INTERNAL_ERROR', 'Failed to claim the task', 500)
  if (!claimed) return ok(null)
  return ok(claimed as IntelTask)
}

/* ------------------------------------------------------------------------------------------------ ask / cancel */

/** What the planner needs: active observatory requests (any day) and today's (SP) finished ones. */
async function readQueue(ctx: ServiceContext, now: number): Promise<TaskRow[]> {
  // Paged until a short page: in practice it is a handful of rows (active ones + today's), but a silent cut would
  // hide an active request from the planner and let a second one through.
  const out: TaskRow[] = []
  for (let from = 0; ; from += QUEUE_PAGE) {
    const { data, error } = await ctx.supabase
      .from(TASKS)
      .select(TASK_COLS)
      .eq('site_id', ctx.siteId)
      .in('task_type', [...OBS_TYPES])
      .or('status.in.(pending,running),requested_at.gte."' + iso(spDayStart(now)) + '"')
      .order('requested_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + QUEUE_PAGE - 1)
    if (error) return err('INTERNAL_ERROR', 'Failed to read the forja queue', 500)
    const page = (data ?? []) as TaskRow[]
    out.push(...page)
    if (page.length < QUEUE_PAGE) return out
  }
}

const AskSchema = z.object({
  type: z.enum(OBS_TYPES),
  scope: z.enum(['todos', 'viagem', 'ia']),
  videoId: z.string().uuid().optional(),
  fmt: z.enum(['long', 'short']).optional(),
  userId: z.string().uuid(),
}).refine(a => a.type !== 'leitura-video' || !!a.videoId, { message: 'videoId: required for leitura-video', path: ['videoId'] })

const fmtFor = (type: ObsType, fmt: Fmt | undefined): Fmt | null =>
  type === 'padroes-titulo-shorts' ? 'short' : type === 'padroes-titulo' || type === 'temas' ? (fmt ?? 'long') : null

function validationMessage(e: z.ZodError): string {
  return e.issues.slice(0, 3).map(i => (i.path.length ? i.path.join('.') + ': ' : '') + i.message).join('; ') || 'Request body validation failed'
}

/**
 * Ask the forja for a reading. The engine's planAsk decides (capability, free niche, quota, the video's niche busy,
 * channels out of the request); one `pending` row is written per niche it sent, in click order.
 */
export async function askReading(ctx: ServiceContext, input: AskInput, now: number): Promise<ServiceResult<AskOutcome>> {
  const parsed = AskSchema.safeParse(input)
  if (!parsed.success) return err('VALIDATION_ERROR', validationMessage(parsed.error), 400)
  const { type, scope, videoId, userId } = parsed.data
  const { supabase, siteId } = ctx

  const [rows, ds] = await Promise.all([readQueue(ctx, now), loadDataset({ siteId, now, supabase })])
  const obs = createObservatory(ds)
  const clock = obs.date, lastPollAt = ds.queue.lastPollAt
  const machine = machineOf(lastPollAt, clock)
  const opts: SessionOpts = {
    capabilities: ds.queue.capabilities,
    eligible: n => obs.forja.eligibleChannels(n),
    videoOf: id => { const v = obs.video(id); return v ? { niche: v.niche, title: v.title } : undefined },
  }
  const toRequests = (rs: TaskRow[]) => rs.map(r => taskRowToRequest(r, lastPollAt, now)).filter((q): q is ForjaRequest => q != null)
  const target = { type, video: videoId ?? null }
  const plan = planAsk(toRequests(rows), machine, clock, opts, scope, target)

  const fmt = fmtFor(type, parsed.data.fmt)
  const results: AskOutcome['results'] = []
  let raced = false
  for (const [i, r] of plan.results.entries()) {
    if (!r.ok) { results.push({ niche: r.niche, ok: false, reason: r.reason }); continue }
    const { data, error } = await supabase.from(TASKS).insert({
      site_id: siteId, task_type: type, target_niche: r.niche, target_video_id: type === 'leitura-video' ? videoId ?? null : null, target_fmt: fmt,
      trigger_type: 'manual', status: 'pending', requested_by: userId,
      // +i ms keeps the click order (IA before Viagem) in the claim's `order by requested_at`
      requested_at: iso(now + i),
    }).select('id').single()
    if (error && error.code === '23505') {
      // a concurrent ask won the niche: say what the engine says about the request that exists now
      const again = planAsk(toRequests(await readQueue(ctx, now)), machine, clock, opts, type === 'leitura-video' ? scope : r.niche, target)
      const reason = again.results.find(x => x.niche === r.niche && !x.ok)?.reason ?? 'Nada enviado: já há um pedido de ' + NICHES[r.niche].label + ' em andamento.'
      results.push({ niche: r.niche, ok: false, reason })
      raced = true
      continue
    }
    if (error || !data) return err('INTERNAL_ERROR', 'Failed to write the forja request', 500)
    results.push({ niche: r.niche, ok: true, reason: null, taskId: (data as { id: string }).id, ...(r.channelsOut ? { channelsOut: r.channelsOut } : {}) })
  }
  const anyOk = results.some(r => r.ok)
  // the engine's own reason, unless a race changed a niche's answer after the plan
  const reason = anyOk ? null : !raced ? plan.reason : type === 'leitura-video' ? results[0]!.reason : results.map(r => r.reason).join('; ')
  return ok({ ok: anyOk, reason, results })
}

const CancelSchema = z.object({ type: z.enum(OBS_TYPES), niche: z.enum(['ia', 'viagem']), videoId: z.string().uuid().optional() })
  .refine(c => c.type !== 'leitura-video' || !!c.videoId, { message: 'videoId: required for leitura-video', path: ['videoId'] })

/** Cancel a request that is still waiting. A running one belongs to the machine and is not cancelled. */
export async function cancelReading(ctx: ServiceContext, input: { type: ObsType; niche: Niche; videoId?: string }): Promise<ServiceResult<{ cancelled: boolean }>> {
  const parsed = CancelSchema.safeParse(input)
  if (!parsed.success) return err('VALIDATION_ERROR', validationMessage(parsed.error), 400)
  const { type, niche, videoId } = parsed.data
  let q = ctx.supabase.from(TASKS).delete().eq('site_id', ctx.siteId).eq('task_type', type).eq('target_niche', niche).eq('status', 'pending')
  if (type === 'leitura-video' && videoId) q = q.eq('target_video_id', videoId)
  const { data, error } = await q.select('id')
  if (error) return err('INTERNAL_ERROR', 'Failed to cancel the forja request', 500)
  return ok({ cancelled: Array.isArray(data) && data.length > 0 })
}

/* ------------------------------------------------------------------------------------------------ refuse / complete */

interface HeldTask {
  id: string; status: string; task_type: string; target_niche: string | null; target_video_id: string | null; target_fmt: string | null
  result_summary: unknown; started_at: string | null; sent?: unknown
}

/** Shape check for a tasks row read with a dynamic column list (the supabase client cannot type it). */
function isHeldTask(d: unknown): d is HeldTask {
  return typeof d === 'object' && d !== null && typeof (d as { id?: unknown }).id === 'string'
    && typeof (d as { status?: unknown }).status === 'string' && typeof (d as { task_type?: unknown }).task_type === 'string'
}

/** The running task, held by this key (unless wide), of an observatory type. */
async function heldObsTask(ctx: ServiceContext, taskId: string, cols: string): Promise<{ task: HeldTask; previous: Record<string, unknown> }> {
  const { data, error } = await ctx.supabase.from(TASKS).select(cols).eq('id', taskId).eq('site_id', ctx.siteId).maybeSingle()
  if (error) return err('INTERNAL_ERROR', 'Failed to read the task', 500)
  if (!data) return err('NOT_FOUND', 'Task not found', 404)
  if (!isHeldTask(data)) return err('INTERNAL_ERROR', 'Failed to read the task', 500)
  const task = data
  if (task.status !== 'running') return err('TASK_NOT_RUNNING', `Task status is '${task.status}', expected 'running'`, 409)
  const previous = (task.result_summary ?? {}) as Record<string, unknown>
  if (!isWideKey(ctx) && (!ctx.keyId || previous.claimed_by !== ctx.keyId)) return err('TASK_NOT_RUNNING', 'Task is held by another key', 409)
  if (!isObsType(task.task_type)) return err('VALIDATION_ERROR', 'Task is not an observatory reading', 400)
  return { task, previous }
}

/**
 * The forja refuses a task (e.g. it received data older than the last sincronização). `reason` is a short code
 * ('dado-velho'); the screen maps it to the canonical sentence (forja/states.ts refusedReasonText). A refusal does not
 * use the quota.
 */
export async function refuseTask(ctx: ServiceContext, taskId: string, reason: string, now: number = Date.now()): Promise<ServiceResult<{ id: string; status: 'refused' }>> {
  const code = typeof reason === 'string' ? reason.trim() : ''
  if (!code || code.length > REFUSED_REASON_MAX) return err('VALIDATION_ERROR', `reason: required, at most ${REFUSED_REASON_MAX} characters`, 400)
  const { task, previous } = await heldObsTask(ctx, taskId, 'id, status, task_type, target_niche, target_video_id, target_fmt, result_summary, started_at')
  let cas = ctx.supabase.from(TASKS)
    .update({ status: 'refused', refused_at: iso(now), refused_reason: code, result_summary: { ...previous, closed_by: ctx.keyId ?? null } })
    .eq('id', taskId).eq('site_id', ctx.siteId).eq('status', 'running').eq('started_at', task.started_at as string)
  if (!isWideKey(ctx)) cas = cas.eq('result_summary->>claimed_by', ctx.keyId as string)
  const { data, error } = await cas.select('id, status').maybeSingle()
  if (error) return err('INTERNAL_ERROR', 'Failed to refuse the task', 500)
  if (!data) return err('TASK_NOT_RUNNING', 'The task is no longer held by this key', 409)
  return ok({ id: taskId, status: 'refused' as const })
}

export interface SentRead {
  task_id: string; task_type: ObsType
  target: { niche: string | null; video_id: string | null; fmt: string | null }
  sent: SentPack
}

/**
 * The data sent to the forja for a running observatory task (GET …/competitors/readings). Built by the engine on the
 * first read and frozen into `task.sent`; every later read — and completeReading — uses that frozen copy, so the
 * numbers the reading may cite never move under the forja.
 *
 * The freeze is PER TASK, not per claim (R55): a requeue keeps `sent`, and the next attempt's GET returns it at once.
 * The CAS that writes it (sent IS NULL, still running, same started_at, same holder) only decides who freezes first.
 *
 * A target that no longer exists (TargetUnavailableError: the video is gone) is a 422 — not retryable, nothing
 * frozen. Any other failure while building is a bug or a broken row: Sentry + a generic 500, which the worker retries.
 */
export async function readSent(ctx: ServiceContext, taskId: string, now: number = Date.now()): Promise<ServiceResult<SentRead>> {
  const cols = 'id, status, task_type, target_niche, target_video_id, target_fmt, result_summary, started_at, sent'
  const { task } = await heldObsTask(ctx, taskId, cols)
  const out = (sent: unknown): ServiceResult<SentRead> => ok({
    task_id: task.id, task_type: task.task_type as ObsType,
    target: { niche: task.target_niche, video_id: task.target_video_id, fmt: task.target_fmt },
    sent: sent as SentPack,
  })
  if (task.sent != null) return out(task.sent)

  let sent: SentPack
  try {
    const obs = createObservatory(await loadDataset({ siteId: ctx.siteId, now, supabase: ctx.supabase }))
    sent = buildSent(obs, task.task_type, { niche: task.target_niche as Niche | null, videoId: task.target_video_id, fmt: task.target_fmt as Fmt | null })
  } catch (e) {
    if (e instanceof TargetUnavailableError) return err('TARGET_UNAVAILABLE', 'The target of this task is no longer available', 422)
    Sentry.captureException(e, { extra: { taskId: task.id, taskType: task.task_type, siteId: ctx.siteId } })
    return err('INTERNAL_ERROR', 'Failed to build the data sent to the forja', 500)
  }

  let cas = ctx.supabase.from(TASKS).update({ sent })
    .eq('id', task.id).eq('site_id', ctx.siteId).eq('status', 'running').eq('started_at', task.started_at as string).is('sent', null)
  if (!isWideKey(ctx)) cas = cas.eq('result_summary->>claimed_by', ctx.keyId as string)
  const { data: frozen, error } = await cas.select('sent').maybeSingle()
  if (error) return err('INTERNAL_ERROR', 'Failed to freeze the data sent to the forja', 500)
  if (frozen) return out((frozen as { sent: unknown }).sent)
  // Lost the CAS: a concurrent read froze first (return ITS copy), or the task left 'running' / changed hands (409).
  const again = await heldObsTask(ctx, taskId, cols)
  if (again.task.started_at !== task.started_at || again.task.sent == null) return err('TASK_NOT_RUNNING', 'The task is no longer held by this key', 409)
  return out(again.task.sent)
}

/** What the forja posts for an observatory task (POST …/competitors/readings). Extra analysis keys are kept. */
export const ReadingSubmissionSchema = z.object({
  task_id: z.string().uuid(),
  model: z.string().trim().min(1).max(80),
  // R29: the worker sends an offset ("-03:00") or Z
  generated_at: z.string().datetime({ offset: true }),
  text: z.object({
    title: z.string().max(300).optional(),
    lead: z.string().max(4000),
    items: z.array(z.string().max(1000)).max(60).default([]),
    theme: z.string().max(80).optional(),
  }),
  analysis: z.object({
    linhas_lidas: z.number().int().nonnegative().optional(),
    linhas_enviadas: z.number().int().nonnegative().optional(),
  }).catchall(z.unknown()).default({}),
  evidence: z.array(z.object({
    id: z.string().min(1).max(100),
    note: z.string().max(1000).optional(),
    theme: z.string().max(80).optional(),
  })).max(500).default([]),
})
export type ReadingSubmission = z.input<typeof ReadingSubmissionSchema>

const SentSchema = z.object({ ids: z.array(z.string()), numbers: z.array(z.string()) }).passthrough()
const quoted = (xs: readonly string[]) => xs.slice(0, 20).map(x => '“' + x + '”').join('; ') + (xs.length > 20 ? ' (+' + (xs.length - 20) + ')' : '')

/**
 * Publish a reading. The task must be running, held by this key, observatory-typed and have its data frozen
 * (`sent`, by the readings GET). Every number the text cites must be in `sent.numbers` (both sides in the forja's
 * canonical form, R26/R30/R38) and every evidence id in `sent.ids`. Then the reading row (with `sent` copied from
 * the task) and the CAS running → completed; a second POST is a 409.
 */
export async function completeReading(ctx: ServiceContext, input: ReadingSubmission, now: number = Date.now()): Promise<ServiceResult<{ readingId: string }>> {
  const parsed = ReadingSubmissionSchema.safeParse(input)
  if (!parsed.success) return err('VALIDATION_ERROR', validationMessage(parsed.error), 400)
  const sub = parsed.data
  const { supabase, siteId } = ctx
  const { task, previous } = await heldObsTask(ctx, sub.task_id, 'id, status, task_type, target_niche, target_video_id, target_fmt, result_summary, started_at, sent')
  if (task.sent == null) return err('TASK_NOT_READY', 'The data sent to the forja was never read for this task (GET …/competitors/readings first)', 409)
  const sent = SentSchema.safeParse(task.sent)
  if (!sent.success) return err('INTERNAL_ERROR', 'The frozen data of this task is malformed', 500)

  const allowed = new Set(sent.data.numbers.map(n => normalizeNumberToken(n) || n))
  const texts = [sub.text.title, sub.text.lead, ...sub.text.items, ...sub.evidence.map(e => e.note)]
  const strangers = [...new Set(texts.flatMap(t => canonicalNumberTokens(t)).filter(t => !allowed.has(t)))]
  if (strangers.length) return err('VALIDATION_ERROR', 'numbers not in the data sent to the forja: ' + quoted(strangers), 400)
  const ids = new Set(sent.data.ids)
  const outside = [...new Set(sub.evidence.map(e => e.id).filter(id => !ids.has(id)))]
  if (outside.length) return err('VALIDATION_ERROR', 'evidence ids not in the data sent to the forja: ' + quoted(outside), 400)

  const insertReading = () => supabase.from('competitor_readings').insert({
    site_id: siteId, task_id: task.id, task_type: task.task_type, niche: task.target_niche, video_id: task.target_video_id, fmt: task.target_fmt,
    model: sub.model, generated_at: sub.generated_at, sent: task.sent, analysis: sub.analysis, text: sub.text, evidence: sub.evidence,
  }).select('id').single()
  let { data: reading, error: insertError } = await insertReading()
  if (insertError && insertError.code === '23505') {
    // Another reading already holds this task_id. Since the task was running and ours above, it was never published
    // (a published reading completes the task). It is deleted ONLY when unambiguously abandoned (R51): older than
    // ORPHAN_READING_MIN_AGE_MS AND the task, re-read right now, still running and held by this key. Otherwise it may
    // be a concurrent POST in flight → 409, nothing deleted.
    const busy = () => err('TASK_NOT_RUNNING', 'Another reading for this task is being published', 409)
    const { data: existing, error: existingError } = await supabase.from('competitor_readings')
      .select('id, created_at').eq('site_id', siteId).eq('task_id', task.id).maybeSingle()
    if (existingError) return err('INTERNAL_ERROR', 'Failed to read the conflicting reading', 500)
    if (existing) {
      const ex = existing as { id: string; created_at: string }
      const createdAt = Date.parse(ex.created_at)
      if (!Number.isFinite(createdAt) || now - createdAt < ORPHAN_READING_MIN_AGE_MS) return busy()
      const { data: again, error: againError } = await supabase.from(TASKS).select('status, result_summary').eq('id', task.id).eq('site_id', siteId).maybeSingle()
      if (againError) return err('INTERNAL_ERROR', 'Failed to read the task', 500)
      const st = again as { status: string; result_summary: unknown } | null
      const holder = ((st?.result_summary ?? {}) as Record<string, unknown>).claimed_by
      if (!st || st.status !== 'running' || (!isWideKey(ctx) && (!ctx.keyId || holder !== ctx.keyId))) return busy()
      const { error: orphanError } = await supabase.from('competitor_readings').delete().eq('id', ex.id).eq('site_id', siteId).eq('task_id', task.id)
      if (orphanError) return err('INTERNAL_ERROR', 'Failed to remove an abandoned reading of this task', 500)
    }
    ;({ data: reading, error: insertError } = await insertReading())
    if (insertError && insertError.code === '23505') return busy()
  }
  if (insertError || !reading) return err('INTERNAL_ERROR', 'Failed to write the reading', 500)
  const readingId = (reading as { id: string }).id

  let cas = supabase.from(TASKS)
    .update({ status: 'completed', completed_at: iso(now), result_summary: { ...previous, closed_by: ctx.keyId ?? null, reading_id: readingId } })
    .eq('id', task.id).eq('site_id', siteId).eq('status', 'running').eq('started_at', task.started_at as string)
  if (!isWideKey(ctx)) cas = cas.eq('result_summary->>claimed_by', ctx.keyId as string)
  const { data: closed, error: closeError } = await cas.select('id').maybeSingle()
  if (closeError || !closed) {
    // the task left 'running' between the read and the CAS (the vigia released it): the reading is not published
    // by the reading's own id; if this cleanup fails, a later attempt removes it once it is abandoned (R51, above)
    const { error: cleanupError } = await supabase.from('competitor_readings').delete().eq('id', readingId)
    if (cleanupError) Sentry.captureMessage('forja reading cleanup failed: ' + cleanupError.message, { extra: { readingId, taskId: task.id } })
    if (closeError) return err('INTERNAL_ERROR', 'Failed to close the task', 500)
    return err('TASK_NOT_RUNNING', 'The task is no longer held by this key', 409)
  }
  return ok({ readingId })
}
