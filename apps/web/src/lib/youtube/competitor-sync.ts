import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { link } from '@/lib/youtube/observatorio/links'
import { createNotification } from '@/lib/notifications/create'
import { getSiteOwners, logSemDestinatario } from '@/lib/notifications/get-site-owners'
import crypto from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { probeThumb, isNewThumb, archiveThumb, type ThumbProbe } from '@/lib/youtube/thumb-fingerprint'
import {
  reconcileVideoVersions, normalizeDescription, type StoredVersion, type VersionPlan, type VersionField,
} from '@/lib/youtube/competitor-versions'
import { classifyShort, needsShortProbe, probeShortsBatch, newProbeBudget, isYoutubeVideoId, type ProbeBudget, type ShortProbeResult } from '@/lib/youtube/short-classifier'
import { reclassifyStoredShorts } from '@/lib/youtube/short-backfill'
import { runControlProbe, warnIfProbeBlocked } from '@/lib/youtube/short-guard'
import { recordQuota } from '@/lib/youtube/competitor-quota'
import { optCount, videoObservedOf, channelObservedOf, rawOf, captureItems, markMissing, markChannelMissing, missingProgressOf, rowsAs, isRec, CAPTURE_CHUNK, type CaptureStats } from '@/lib/youtube/competitor-capture'
import { classifyTiers, type Tier } from '@/lib/youtube/competitor-tiers'
export { optCount } from '@/lib/youtube/competitor-capture'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const MAX_FULL_SYNC_VIDEOS = 2000
const MAX_INCREMENTAL_PAGES = 5
const CHANGE_DETECTION_WINDOW_DAYS = 90
const PAGE_DELAY_MS = 300

/** As partes pedidas em TODA chamada videos.list. O quadro de cota cobra 1 unidade por chamada, qualquer que seja o número de partes. */
export const VIDEO_PARTS = 'snippet,statistics,contentDetails,liveStreamingDetails'

/** provisional until spike S1 (Last-Modified granularity) */
const LAST_MODIFIED_MINUTE = true

export interface SyncResult {
  videosChecked: number
  changesDetected: number
  dailyRecorded: number
  unitsUsed: number
  skipped?: boolean
  /** Houve mudança a avisar e nenhum org_admin da organização raiz para receber. */
  sem_destinatario?: boolean
  /** Itens que vieram sem uma parte inteira (snippet, statistics ou contentDetails): os campos dela não foram comparados. */
  partsMissing?: number
  /** (A5) Canal que veio sem snippet ou sem statistics: os campos da parte ausente não foram comparados nem gravados na linha. */
  channelPartsMissing?: number
  /** (A5) Versões de campo abertas (primeira leitura ou mudança), contando canal e vídeos. */
  fieldsOpened?: number
  /** (A5) Versões de campo fechadas porque o valor mudou. */
  fieldsClosed?: number
  /** (A5) Respostas cruas abertas (primeira leitura ou mudança). */
  rawOpened?: number
  /** (A5) Respostas cruas fechadas porque a resposta mudou. */
  rawClosed?: number
  /** (A5) Respostas acima do teto de tamanho, não guardadas. */
  rawTooBig?: number
  /** (A5) Itens cujo texto trazia NUL ou substituto solitário e foi limpo antes de gravar. */
  sanitized?: number
  /** (A5) Itens repetidos na mesma resposta (só o primeiro vale). */
  duplicates?: number
  /** (A5) Itens de vídeo sem id, deixados fora da captura. Aqui o id é sempre o uuid da linha do vídeo, então hoje é sempre 0 (fica ligado para o dia em que a captura receber item de outra origem). */
  invalid?: number
  /** (A5) Itens que NÃO foram capturados porque uma captura anterior desta execução falhou (disjuntor por canal): o canal termina em erro com a mensagem da primeira falha. */
  captureSkipped?: number
  /** (A5) Vídeos pedidos ao YouTube e não devolvidos em nenhuma chamada desta sincronização: cada um soma UMA falta. */
  missed?: number
  /** (A5) Versões `availability = 'sumiu'` EFETIVAMENTE abertas nesta execução (o plano de campos decidiu e a gravação confirmou); reexecutar a mesma situação dá 0. */
  newlyMissing?: number
  /** (A5) Vídeos que estavam marcados como ausentes e o YouTube devolveu de novo. */
  returned?: number
  /** (A5) A gravação da cota deste canal falhou: a sincronização terminou como terminou, e as unidades gastas ficaram fora da linha do dia. */
  quotaError?: true
  /** (A5) As unidades que não foram gravadas por causa do quotaError (= unitsUsed); o lote soma e tenta uma vez no fim do disparo. */
  quotaUnitsLost?: number
  /** (A5 E2) Vídeos que mudaram de faixa de série (diária ou semanal) nesta sincronização. */
  tierChanges?: number
  /** (A5 E2) Vídeos da regra diária deixados na semanal pelo teto de segurança (nunca em silêncio). */
  cutByCap?: number
  /** (A5 E2) Vídeos pedidos na passada diária que vieram sem contagem de views: não ganham ponto na série. */
  excludedNoCount?: number
}

/** (A5) Os contadores de uma sincronização que terminou em erro: o erro lançado não carrega resultado, e o lote só vê o erro. */
const failedStats = new WeakMap<object, SyncResult>()
/** Os contadores (vídeos conferidos, trocas, partes que faltaram, textos limpos…) que a sincronização tinha quando lançou; indefinido se o erro não veio dela. */
export function syncStatsOf(err: unknown): SyncResult | undefined {
  return typeof err === 'object' && err !== null ? failedStats.get(err) : undefined
}

const SP_OFFSET_MS = 3 * 3_600_000 // America/Sao_Paulo is UTC−3 with no DST since 2019
export function spDate(ms: number): string { return new Date(ms - SP_OFFSET_MS).toISOString().slice(0, 10) }
export function isDailyRecordDue(nowIso: string, lastRecordDate: string | null): { due: boolean; snapDate: string } {
  const now = Date.parse(nowIso), snapDate = spDate(now)
  const spHour = new Date(now - SP_OFFSET_MS).getUTCHours()
  return { due: spHour >= 12 && lastRecordDate !== snapDate, snapDate }
}

export type ThumbAction = 'skip' | 'heal' | 'etag' | 'reconcile'
/**
 * R10: how persistence treats a thumbnail probe against the current thumb version.
 * - skip: probe failed, nothing to say.
 * - heal: the current version never had a dHash and the probe brought one → fill it in, no change.
 * - etag: the ETag moved but the image is within DHASH_MAX_SAME → store only the ETag (avoids re-downloading
 *   every sync, never moves the dHash so slow drift cannot accumulate).
 * - reconcile: hand it to reconcileVideoVersions.
 */
export function classifyThumb(prev: StoredVersion | null, probe: ThumbProbe): ThumbAction {
  if (!probe.etag && !probe.dhash) return 'skip'
  if (prev) {
    if (!prev.thumb_dhash && probe.dhash && probe.bytes) return 'heal'
    if (prev.thumb_dhash && probe.dhash && probe.etag && probe.etag !== prev.thumb_etag
      && !isNewThumb({ etag: prev.thumb_etag, dhash: prev.thumb_dhash }, probe)) return 'etag'
  }
  return 'reconcile'
}

const CHANGE_TYPE: Record<VersionField, 'title' | 'description' | 'thumbnail'> = { title: 'title', desc: 'description', thumb: 'thumbnail' }

/** R10(c): drop the plan parts of fields whose API value was missing/failed. */
export function dropFields(plan: VersionPlan, current: StoredVersion[], skip: VersionField[]): VersionPlan {
  if (!skip.length) return plan
  const skipIds = new Set(current.filter(v => skip.includes(v.field)).map(v => v.id))
  return {
    touch: plan.touch.filter(id => !skipIds.has(id)),
    close: plan.close.filter(id => !skipIds.has(id)),
    open: plan.open.filter(o => !skip.includes(o.field)),
    changes: plan.changes.filter(c => !skip.includes(c.field)),
  }
}

/** ISO-8601 (PT1M30S) → segundos; null quando ausente/ilegível. */
export function parseIsoDuration(durationStr: string | undefined): number | null {
  if (!durationStr) return null
  const match = durationStr.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match || !(match[1] || match[2] || match[3] || match[4])) return null
  return (parseInt(match[1] ?? '0', 10) * 86400) + (parseInt(match[2] ?? '0', 10) * 3600) +
         (parseInt(match[3] ?? '0', 10) * 60) + parseInt(match[4] ?? '0', 10)
}

/**
 * O corpo de um videos.list só vale se trouxe a lista (`items` é array) e nenhum `error`: um 200 `{}` ou com `error` (proxy, cota)
 * não é "nenhum vídeo devolvido". É falha da chamada, igual a um 500, e nunca conta ninguém como ausente.
 */
function videoItemsOf(body: unknown): unknown[] {
  const b = (typeof body === 'object' && body !== null ? body : {}) as { items?: unknown; error?: unknown }
  if (b.error != null || !Array.isArray(b.items)) throw new Error('YouTube API: resposta sem a lista de vídeos')
  return b.items
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function syncCompetitorChannel(
  channelRow: { id: string; channel_id: string; site_id: string },
  apiKey: string,
  opts: { now?: Date; fetchImpl?: typeof fetch; probeBudget?: ProbeBudget; deferBackfill?: boolean } = {},
): Promise<SyncResult> {
  const supabase = getSupabaseServiceClient()
  const now = opts.now ?? new Date()
  const nowIso = now.toISOString()
  const nowMs = now.getTime()
  const f: typeof fetch = opts.fetchImpl ?? fetch
  let unitsUsed = 0
  // Teto de sondas de Short (R109): compartilhado com o lote quando vem de runCompetitorBatch.
  const standalone = !opts.probeBudget
  const probeBudget = opts.probeBudget ?? newProbeBudget()
  // Execução isolada: o controle (1x) roda antes da primeira sonda; no lote ele já rodou.
  let controlDone = !standalone
  const ensureControl = async () => { if (!controlDone) { controlDone = true; await runControlProbe(supabase, probeBudget, f) } }
  const api = (url: string): Promise<Response> => { unitsUsed++; return f(url, { signal: AbortSignal.timeout(10_000) }) }

  // ── CAS Lock: acquire or skip ──
  const { data: locked, error: lockError } = await supabase
    .from('competitor_channels')
    .update({
      sync_status: 'syncing',
      sync_started_at: nowIso,
      sync_progress: 0,
      sync_error: null,
      last_synced_at: nowIso, // the cursor: start of this attempt
    })
    .eq('id', channelRow.id)
    .or(`sync_status.neq.syncing,sync_started_at.lt.${new Date(nowMs - 10 * 60_000).toISOString()}`)
    .select('id, sync_mode, full_sync_completed_at, video_limit, last_ok_synced_at, sync_error_since, last_seen_at')

  // Um erro aqui (coluna que não existe, banco fora) não é "outro processo está sincronizando": lança.
  if (lockError) throw new Error('trava do canal: ' + (lockError.message ?? 'erro do banco'))
  if (!locked || locked.length === 0) {
    return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 0, skipped: true }
  }
  const prevOkAt = (locked[0] as { last_ok_synced_at?: string | null }).last_ok_synced_at ?? null
  const prevErrorSince = (locked[0] as { sync_error_since?: string | null }).sync_error_since ?? null
  const prevChannelSeenAt = (locked[0] as { last_seen_at?: string | null }).last_seen_at ?? null

  const syncMode = (locked[0] as { sync_mode: string }).sync_mode
  const fullSyncDone = (locked[0] as { full_sync_completed_at: string | null }).full_sync_completed_at
  const videoLimit = (locked[0] as { video_limit: number | null }).video_limit ?? 50
  const maxIncrementalPages = Math.max(1, Math.ceil(videoLimit / 50))

  const { count: syncedCount } = await supabase
    .from('competitor_videos')
    .select('id', { count: 'exact', head: true })
    .eq('competitor_channel_id', channelRow.id)
  const needsBackfill = (syncedCount ?? 0) < videoLimit

  let videosChecked = 0
  let changesDetected = 0
  let dailyRecorded = 0
  const reconciled = new Set<string>()
  /** A5 (E1): linhas de competitor_videos já regravadas nesta sincronização, e os vídeos que vieram do YouTube nela. */
  const patched = new Set<string>()
  const seen = new Set<string>()
  /** Vídeos DISTINTOS (id do YouTube) que vieram sem uma parte: o mesmo vídeo pedido na página e na passada diária conta uma vez. */
  const partsMissingIds = new Set<string>()

  type TrackedRow = { id: string; video_id: string; title: string | null; thumbnail_url: string | null }
  /** Os fixados do canal (R118), da leitura de todos os vídeos feita no começo do `try`. */
  let pinned: TrackedRow[] = []
  /** Tudo o que o Observatório guarda deste canal: a base da faixa de cada vídeo, do "pedido e não veio" e da janela de cada mudança. */
  type FullRow = TrackedRow & {
    published_at: string | null; pinned_at: string | null; daily_until: string | null; series_tier: Tier | null; series_tier_since: string | null
    last_seen_at: string | null; missing_since: string | null; views_hidden: boolean | null; live_broadcast_content: string | null; discovered_at: string | null
  }
  const ALL_COLS = 'id, video_id, title, thumbnail_url, published_at, pinned_at, daily_until, series_tier, series_tier_since, last_seen_at, missing_since, views_hidden, live_broadcast_content, discovered_at'
  const PAGE = 1000 // max_rows do PostgREST: uma leitura maior viria cortada sem aviso, então pagina até a página curta
  // a guarda confere as duas chaves de que tudo depende (os dois ids); as outras colunas são anuláveis e chegam como o banco manda.
  // Uma linha sem id é erro, nunca "canal sem vídeos".
  const isFullRow = (x: unknown): x is FullRow => isRec(x) && typeof x.id === 'string' && typeof x.video_id === 'string'
  /** Lança em erro de consulta: uma leitura que falha nunca é "canal sem vídeos". Pré-requisito da passada diária. */
  const loadAll = async (): Promise<FullRow[]> => {
    const out: FullRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from('competitor_videos').select(ALL_COLS).eq('competitor_channel_id', channelRow.id).order('id').range(from, from + PAGE - 1)
      fail('não foi possível ler os vídeos do canal', error)
      let page: FullRow[]
      try { page = rowsAs(data, isFullRow, 'vídeos do canal') } catch (e) { throw new Error('não foi possível ler os vídeos do canal: ' + (e instanceof Error ? e.message : String(e))) }
      out.push(...page)
      if (page.length < PAGE) return out
    }
  }
  /** Fora das provas de série: sem contagem de views, estreia agendada, ou ausente. Continua sendo pedido (é como se descobre que voltou). */
  const outOfProof = (r: FullRow): boolean => r.views_hidden === true || r.live_broadcast_content === 'upcoming' || r.missing_since != null
  const classify = (rows: FullRow[]) => classifyTiers(
    rows.map(r => ({ id: r.id, publishedAt: r.published_at ? Date.parse(r.published_at) : null, pinned: r.pinned_at != null, dailyUntil: r.daily_until, tier: r.series_tier })),
    { videoLimit, nowMs, today: spDate(nowMs) })
  /** tracked uuids with no competitor_video_daily row for snapDate */
  const missingDaily = async (uuids: string[], snapDate: string): Promise<string[]> => {
    if (!uuids.length) return []
    const have = new Set<string>()
    for (let i = 0; i < uuids.length; i += 200) {
      const { data } = await supabase.from('competitor_video_daily').select('video_id').eq('snap_date', snapDate).in('video_id', uuids.slice(i, i + 200))
      for (const r of (data ?? []) as Array<{ video_id: string }>) have.add(r.video_id)
    }
    return uuids.filter(u => !have.has(u))
  }
  const loadCurrent = async (uuids: string[]): Promise<Map<string, StoredVersion[]>> => {
    const map = new Map<string, StoredVersion[]>()
    if (!uuids.length) return map
    const { data } = await supabase
      .from('competitor_video_versions')
      .select('id, video_id, field, value_text, value_hash, thumb_etag, thumb_dhash, first_seen_at, last_seen_at')
      .in('video_id', uuids)
      .eq('is_current', true)
    for (const r of (data ?? []) as Array<StoredVersion & { video_id: string }>) {
      const list = map.get(r.video_id) ?? []
      list.push(r)
      map.set(r.video_id, list)
    }
    return map
  }
  const fail = (what: string, error: { message?: string } | null | undefined): void => {
    if (error) throw new Error(`${what}: ${error.message ?? 'database error'}`)
  }
  /** (A5) O primeiro erro de uma gravação que NÃO é pré-requisito da série do dia: guardado aqui e lançado no fim. */
  let lateFailure: Error | null = null
  const late = (what: string, error: { message?: string } | null | undefined): boolean => {
    if (!error) return false
    lateFailure ??= new Error(what + ': ' + (error.message ?? 'erro do banco'))
    return true
  }

  /** A5 (E1): o que se sabia de cada vídeo ANTES desta sincronização (a janela de uma mudança começa na última leitura boa). */
  const rowInfo = new Map<string, { lastSeenAt: string | null; weeklySince: string | null; missing: boolean }>()
  const captured = new Set<string>()
  /** uuids pedidos a videos.list numa chamada que RESPONDEU (falha de rede ou HTTP não é sumiço). */
  const asked = new Set<string>()
  let missedStats = { missed: 0, newlyMissing: 0 }
  // A captura nunca impede a série do dia: a falha vai para a mesma `lateFailure` (não há segunda variável).
  const cap = { fieldsOpened: 0, fieldsClosed: 0, rawOpened: 0, rawClosed: 0, rawTooBig: 0, sanitized: 0, duplicates: 0, invalid: 0 }
  const addCap = (st: CaptureStats): void => { for (const k of Object.keys(cap) as Array<keyof typeof cap>) cap[k] += st[k] }
  // Disjuntor por canal: depois da PRIMEIRA falha de captura nenhum bloco seguinte lê nem grava captura (o banco doente seria
  // repetido a cada bloco). O que deixou de ser capturado por isso conta em `captureSkipped`; quem já foi tentado e falhou não conta.
  let captureBroken = false
  const captureTried = new Set<string>()
  const captureSkippedIds = new Set<string>()
  const captureFailed = (e: unknown): void => {
    captureBroken = true
    lateFailure ??= e instanceof Error ? e : new Error(String(e))
  }
  let channelPartsMissing = 0
  /** (A5 E2) O que a classificação das faixas decidiu nesta sincronização, e os vídeos pedidos na passada diária que vieram sem contagem. */
  let tierChanges = 0, tierCut = 0, excludedNoCount = 0
  /** (A5) A cota é gravada UMA vez, no fim (sucesso ou erro); se a gravação falhar, a sincronização não muda de destino: só marca quotaError. */
  let quotaError = false
  const flushQuota = async (): Promise<void> => {
    try {
      // partes_ausentes vai junto: é o único lugar durável desse número
      await recordQuota(supabase, { siteId: channelRow.site_id, nowMs, units: unitsUsed, mode: 'competitors', cut: tierCut, extra: { partes_ausentes: partsMissingIds.size } })
    } catch { quotaError = true }
  }
  const noteRow = (r: { id?: unknown; last_seen_at?: unknown; missing_since?: unknown }): void => {
    if (typeof r.id !== 'string' || rowInfo.has(r.id)) return
    rowInfo.set(r.id, { lastSeenAt: typeof r.last_seen_at === 'string' ? r.last_seen_at : null, weeklySince: null, missing: r.missing_since != null })
  }
  /** O que a leitura de um vídeo grava na linha; sem miniatura utilizável (só `default`, ou nenhuma) a chave fica de fora: o valor gravado não é anulado. */
  const observedOf = (item: unknown) => {
    const o = videoObservedOf(item, nowIso, parseIsoDuration)
    if (o.patch.thumbnail_url != null) return o
    const { thumbnail_url: _semMiniatura, ...patch } = o.patch
    return { ...o, patch }
  }
  /** Vídeos que estavam marcados como ausentes e vieram de novo nesta sincronização (calculado na hora: vale também quando o canal termina em erro). */
  const returnedCount = (): number => [...seen].filter(id => rowInfo.get(id)?.missing).length
  /** Os contadores da sincronização até aqui; zero não aparece (como sempre foi no resultado). */
  const counters = (): SyncResult => ({
    videosChecked, changesDetected, dailyRecorded, unitsUsed,
    ...(partsMissingIds.size ? { partsMissing: partsMissingIds.size } : {}),
    ...(channelPartsMissing ? { channelPartsMissing } : {}),
    ...(cap.fieldsOpened ? { fieldsOpened: cap.fieldsOpened } : {}), ...(cap.fieldsClosed ? { fieldsClosed: cap.fieldsClosed } : {}),
    ...(cap.rawOpened ? { rawOpened: cap.rawOpened } : {}), ...(cap.rawClosed ? { rawClosed: cap.rawClosed } : {}), ...(cap.rawTooBig ? { rawTooBig: cap.rawTooBig } : {}),
    ...(cap.sanitized ? { sanitized: cap.sanitized } : {}),
    ...(cap.duplicates ? { duplicates: cap.duplicates } : {}), ...(cap.invalid ? { invalid: cap.invalid } : {}),
    ...(captureSkippedIds.size ? { captureSkipped: captureSkippedIds.size } : {}),
    ...(missedStats.missed ? { missed: missedStats.missed } : {}), ...(missedStats.newlyMissing ? { newlyMissing: missedStats.newlyMissing } : {}),
    ...(returnedCount() ? { returned: returnedCount() } : {}),
    ...(quotaError ? { quotaError: true as const, quotaUnitsLost: unitsUsed } : {}),
    ...(tierChanges ? { tierChanges } : {}), ...(tierCut ? { cutByCap: tierCut } : {}), ...(excludedNoCount ? { excludedNoCount } : {}),
  })
  /** Campos e raw dos vídeos que vieram, em lotes de 50, e só então o carimbo de "visto". */
  const captureFetched = async (pairs: Array<{ uuid: string; item: unknown }>): Promise<void> => {
    const todo = pairs.filter(p => !captured.has(p.uuid))
    for (let i = 0; i < todo.length; i += CAPTURE_CHUNK) {
      const chunk = todo.slice(i, i + CAPTURE_CHUNK)
      if (captureBroken) { for (const p of chunk) if (!captureTried.has(p.uuid)) captureSkippedIds.add(p.uuid); continue }
      try {
        const st = await captureItems(supabase, {
          siteId: channelRow.site_id, channelId: channelRow.id, scope: 'video', nowIso,
          items: chunk.map(p => {
            const info = rowInfo.get(p.uuid)
            return { videoId: p.uuid, fields: videoObservedOf(p.item, nowIso, parseIsoDuration).fields, raw: rawOf(p.item), prevSeenAt: info?.lastSeenAt ?? null, weeklySince: info?.weeklySince ?? null }
          }),
        })
        addCap(st)
        const { error } = await supabase.from('competitor_videos').update({ last_seen_at: nowIso }).in('id', chunk.map(p => p.uuid))
        fail('não foi possível guardar a última leitura dos vídeos', error)
        for (const p of chunk) captured.add(p.uuid)
      } catch (e) {
        for (const p of chunk) captureTried.add(p.uuid)
        captureFailed(e)
      }
    }
  }

  /** Reconciles one video's versions and applies the plan. Throws on any database error (compensating first). */
  const reconcileVideo = async (
    videoUuid: string, videoId: string,
    o: { apiTitle: string; apiDescription: string | undefined; thumbnailUrl: string | null; viewCount: number | null; existingTitle: string | null; existingThumbUrl: string | null },
    current: StoredVersion[], touchIds: string[],
  ): Promise<void> => {
    reconciled.add(videoUuid)
    const prevThumb = current.find(v => v.field === 'thumb') ?? null
    let probe: ThumbProbe | null = null
    try {
      probe = await probeThumb(videoId, prevThumb ? { etag: prevThumb.thumb_etag, dhash: prevThumb.thumb_dhash } : null, f)
    } catch {
      probe = null // network failure: skip the thumbnail this round
    }
    const action: ThumbAction = probe ? classifyThumb(prevThumb, probe) : 'skip'

    if (probe && prevThumb && action === 'heal') {
      const blobUrl = await archiveThumb(videoUuid, probe).catch(() => null)
      const { error } = await supabase.from('competitor_video_versions').update({
        thumb_dhash: probe.dhash, thumb_etag: probe.etag, last_seen_at: nowIso,
        ...(blobUrl ? { thumb_blob_url: blobUrl } : {}),
      }).eq('id', prevThumb.id)
      fail('heal thumb version', error)
    } else if (probe && prevThumb && action === 'etag') {
      const { error } = await supabase.from('competitor_video_versions').update({
        thumb_etag: probe.etag, last_seen_at: nowIso,
      }).eq('id', prevThumb.id)
      fail('update thumb etag', error)
    }

    const skip: VersionField[] = []
    if (!o.apiTitle) skip.push('title')
    if (o.apiDescription === undefined) skip.push('desc')
    if (action !== 'reconcile') skip.push('thumb')

    const rawPlan = reconcileVideoVersions(
      current,
      { title: o.apiTitle, description: o.apiDescription === undefined ? '' : normalizeDescription(o.apiDescription), thumb: action === 'reconcile' ? probe : null },
      { prevOkAt, now: nowIso },
      { lastModifiedMinute: LAST_MODIFIED_MINUTE },
    )
    const plan = dropFields(rawPlan, current, skip)

    touchIds.push(...plan.touch)
    if (!plan.close.length && !plan.open.length && !plan.changes.length) return

    // One transaction in the database (R22): close + open + change rows, or nothing.
    const openRows = []
    for (const op of plan.open) {
      const blobUrl = op.field === 'thumb' && op.thumb ? await archiveThumb(videoUuid, op.thumb).catch(() => null) : null
      const lm = op.thumb?.lastModified ? Date.parse(op.thumb.lastModified) : NaN
      openRows.push({
        field: op.field,
        value_text: op.value_text,
        value_hash: op.value_hash,
        has_text: op.has_text,
        thumb_etag: op.thumb?.etag ?? null,
        thumb_dhash: op.thumb?.dhash ?? null,
        thumb_blob_url: blobUrl,
        thumb_last_modified: Number.isFinite(lm) ? new Date(lm).toISOString() : null,
        first_seen_at: op.first_seen_at,
        last_seen_at: nowIso,
        window_start: op.window_start,
        precision: op.precision,
      })
    }
    const changeRows = plan.changes.map(c => {
      const fromV = current.find(v => v.id === c.fromId) as (StoredVersion & { value_text?: string | null }) | undefined
      const opened = plan.open.find(op => op.field === c.field)
      return {
        field: c.field,
        site_id: channelRow.site_id,
        change_type: CHANGE_TYPE[c.field],
        ...(c.field === 'title' ? { old_title: fromV?.value_text ?? o.existingTitle ?? null, new_title: opened?.value_text ?? o.apiTitle } : {}),
        ...(c.field === 'thumb' ? { old_thumbnail_url: o.existingThumbUrl, new_thumbnail_url: o.thumbnailUrl } : {}),
        view_count_at_change: o.viewCount,
        from_version_id: c.fromId,
        window_start: c.window_start,
        window_end: c.window_end,
        precision: c.precision,
        detected_at: nowIso,
      }
    })
    const { data, error } = await supabase.rpc('apply_competitor_version_plan', {
      p_video_id: videoUuid, p_close: plan.close, p_open: openRows, p_changes: changeRows,
    })
    fail('apply version plan', error)
    changesDetected += (data as { changes?: number } | null)?.changes ?? 0
  }

  type FetchedItem = { id: string; snippet?: Record<string, unknown>; statistics?: Record<string, string> }
  /** Reconciles videos.list items against their stored rows, skipping what this sync already reconciled (daily pass and R123). */
  const reconcileFetched = async (items: FetchedItem[], byYt: Map<string, TrackedRow>): Promise<void> => {
    const pending = items.filter(it => byYt.has(it.id) && !reconciled.has(byYt.get(it.id)!.id))
    const currentMap = await loadCurrent(pending.map(it => byYt.get(it.id)!.id))
    const touch: string[] = []
    for (const it of pending) {
      const row = byYt.get(it.id)!
      const sn = it.snippet ?? {}
      const thumbs = sn.thumbnails as { maxres?: { url?: string }; high?: { url?: string } } | undefined
      await reconcileVideo(row.id, it.id, {
        apiTitle: (sn.title as string | undefined) ?? '',
        apiDescription: sn.description as string | undefined,
        thumbnailUrl: thumbs?.maxres?.url ?? thumbs?.high?.url ?? null,
        viewCount: optCount(it.statistics?.viewCount),
        existingTitle: row.title,
        existingThumbUrl: row.thumbnail_url,
      }, currentMap.get(row.id) ?? [], touch)
    }
    if (touch.length) {
      const { error } = await supabase.from('competitor_video_versions').update({ last_seen_at: nowIso }).in('id', touch)
      fail('touch versions', error)
    }
  }
  /**
   * A linha do vídeo é regravada toda vez que o YouTube o devolve, em qualquer chamada (página, passada diária, fixados):
   * contagens, sinalizadores (D2: contagem ausente é nulo mais o sinalizador, nunca 0), ao vivo, e a sequência de faltas
   * zerada. Uma vez por sincronização. Erro de gravação nunca é "ok": é guardado (late) e o canal termina em erro, depois da série do dia.
   */
  const patchFetched = async (items: FetchedItem[], byYt: Map<string, TrackedRow>): Promise<void> => {
    for (const it of items) {
      const row = byYt.get(it.id)
      if (!row) continue
      seen.add(row.id)
      if (patched.has(row.id)) continue
      const o = observedOf(it)
      if (o.partsMissing.length) partsMissingIds.add(it.id)
      const { error } = await supabase.from('competitor_videos').update(o.patch).eq('id', row.id)
      // (emenda do portão: S-I5) não lança: a série do dia vem antes; o erro é guardado e o canal termina em erro
      if (late('não foi possível atualizar a linha do vídeo', error)) continue
      patched.add(row.id)
    }
  }

  try {
    // Daily record due? 12:00 São Paulo AND at least one tracked video has no row for today's SP date
    // (due per video, so a partial record is completed by the next sync).
    const snapDate = spDate(nowMs)
    const hourOk = isDailyRecordDue(nowIso, null).due
    let all = await loadAll()
    const byId = new Map<string, FullRow>()
    // `rowInfo` guarda o que se sabia de cada vídeo ANTES desta sincronização: o primeiro registro vale (`has`), os de leituras seguintes só completam.
    const index = (): void => {
      byId.clear()
      for (const r of all) {
        byId.set(r.id, r)
        if (!rowInfo.has(r.id)) rowInfo.set(r.id, { lastSeenAt: r.last_seen_at, weeklySince: r.series_tier === 'semanal' ? r.series_tier_since : null, missing: r.missing_since != null })
      }
    }
    index()
    pinned = all.filter(r => r.pinned_at != null)
    const pinnedUuids = new Set(pinned.map(p => p.id))
    // A passada diária segue a REGRA (classifyTiers), nunca a faixa gravada: no dia do deploy nenhum vídeo tem faixa, e o vídeo sem faixa
    // que a regra põe na diária ganha o ponto de hoje como sempre ganhou. Os N mais recentes e os fixados de antes estão sempre nela.
    let tierPlan = classify(all)
    let dailyDue = false
    if (hourOk) {
      const proof = tierPlan.daily.map(id => byId.get(id)!).filter(r => !outOfProof(r))
      dailyDue = needsBackfill || (await missingDaily(proof.map(r => r.id), snapDate)).length > 0
    }

    // ── 1. Channel metadata ──
    const channelRes = await api(
      `${YOUTUBE_API_BASE}/channels?part=contentDetails,snippet,statistics&id=${channelRow.channel_id}&key=${apiKey}`,
    )
    if (!channelRes.ok) throw new Error(`YouTube API ${channelRes.status} for channel ${channelRow.channel_id}`)

    const channelData = await channelRes.json()
    // Só sumiço de verdade marca ausência do canal: `items` lista vazia, ou sem `items` com `pageInfo.totalResults === 0`.
    // Corpo sem `items`, com `error` ou fora da forma é falha da chamada (igual a um 500) e lança antes de qualquer marca.
    {
      const items: unknown = channelData?.items
      const absent = Array.isArray(items) ? items.length === 0 : items == null && channelData?.pageInfo?.totalResults === 0
      if (channelData?.error != null || (!Array.isArray(items) && !absent)) throw new Error(`YouTube API: resposta sem o canal ${channelRow.channel_id}`)
    }
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylistId) {
      // `items: []` = channel removed/closed or a mistyped id. Never stamp last_ok_synced_at; the catch below records the
      // error and humanizeSyncError turns the 404 into "não encontrado no YouTube".
      if (!channelData.items?.length) {
        // (A5) a resposta que veio SEM o canal soma a falta dele (a 2ª seguida grava missing_since e a versão 'sumiu'). Falha de rede
        // ou HTTP já lançou acima e nunca chega aqui; um item sem a lista de uploads também não é sumiço. A marca que falha não some:
        // vai ao Sentry e entra no texto do erro do canal (o 404 continua sendo o erro).
        try { await markChannelMissing(supabase, { siteId: channelRow.site_id, channelId: channelRow.id, nowIso }) } catch (e) {
          Sentry.captureException(e, { tags: { component: 'sync-youtube', mode: 'competitors-missing' }, extra: { channelId: channelRow.channel_id } })
          throw new Error(`YouTube API 404 for channel ${channelRow.channel_id} (e a falta não foi registrada: ${e instanceof Error ? e.message : String(e)})`)
        }
      }
      throw new Error(`YouTube API 404 for channel ${channelRow.channel_id}`)
    }

    const snippet = channelData.items[0].snippet
    const stats = channelData.items[0].statistics
    // D2: contagem ausente é nulo, nunca 0 (`statistics: {}` presente não é "o canal tem 0 vídeos"); '0' medido continua 0.
    const youtubeVideoCount = optCount(stats?.videoCount)
    // Hidden counters are absent from the API: null, never 0 ("sem contagem").
    const subscriberCount = optCount(stats?.hiddenSubscriberCount ? undefined : stats?.subscriberCount)

    // (A5) campos e raw do canal. `last_seen_at` só é carimbado se a captura deu certo (a janela da próxima mudança depende dele).
    const chObserved = channelObservedOf(channelData.items[0])
    if (chObserved.partsMissing.length) channelPartsMissing++
    let channelCaptured = false
    try {
      const st = await captureItems(supabase, { siteId: channelRow.site_id, channelId: channelRow.id, scope: 'canal', nowIso,
        items: [{ videoId: null, fields: chObserved.fields, raw: rawOf(channelData.items[0]), prevSeenAt: prevChannelSeenAt, weeklySince: null }] })
      addCap(st)
      channelCaptured = true
    } catch (e) {
      captureFailed(e)
    }

    const { error: chErr } = await supabase
      .from('competitor_channels')
      .update({
        // só as chaves das partes que vieram: parte ausente não grava vazio, nulo nem zero por cima do gravado
        ...(chObserved.partsMissing.includes('snippet') ? {} : { channel_name: snippet?.title ?? '', thumbnail_url: snippet?.thumbnails?.default?.url ?? null }),
        ...(chObserved.partsMissing.includes('statistics') ? {} : { subscriber_count: subscriberCount, youtube_video_count: youtubeVideoCount }),
        ...chObserved.patch,
        ...(channelCaptured ? { last_seen_at: nowIso } : {}),
      })
      .eq('id', channelRow.id)
    late('não foi possível atualizar a linha do canal', chErr)

    // Daily snapshot (non-blocking). (A5, D2) Sem a parte statistics não há retrato do dia: gravar nulo/0 criaria um "dia medido em zero"
    // (e o upsert apagaria um retrato bom do mesmo dia). O mesmo vale para `statistics` presente SEM nenhuma contagem (`{}`): um retrato
    // todo nulo também lê como dia medido e cobriria um bom. O retrato só é gravado quando ao menos uma contagem veio (inscritos escondidos sozinhos não contam); sem linha é "não medido".
    const snapshotViews = optCount(stats?.viewCount)
    // Só contagem mede: `hiddenSubscriberCount` sozinho (true ou false), sem número nenhum, grava uma linha toda nula que o upsert poria por cima de um retrato bom do dia.
    const snapshotMeasured = subscriberCount !== null || youtubeVideoCount !== null || snapshotViews !== null
    try {
      if (!chObserved.partsMissing.includes('statistics') && snapshotMeasured) await supabase
        .from('competitor_channel_snapshots')
        .upsert({
          competitor_channel_id: channelRow.id,
          subscriber_count: subscriberCount,
          video_count: youtubeVideoCount,
          view_count: snapshotViews,
          snapshot_date: snapDate,
          subscribers_hidden: chObserved.patch.subscribers_hidden,
        }, { onConflict: 'competitor_channel_id,snapshot_date' })
    } catch {
      // Non-fatal
    }

    // ── 2. Decide sync strategy ──
    const isFullSync = syncMode === 'full' && !fullSyncDone
    const changeDetectionCutoff = new Date(nowMs - CHANGE_DETECTION_WINDOW_DAYS * 86_400_000).toISOString()

    let nextPageToken: string | undefined
    let pageCount = 0

    do {
      // Fetch playlist page
      let playlistUrl = `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`
      if (nextPageToken) playlistUrl += `&pageToken=${nextPageToken}`

      const playlistRes = await api(playlistUrl)
      if (!playlistRes.ok) throw new Error(`YouTube API ${playlistRes.status} for playlist ${uploadsPlaylistId}`)

      const playlistData = await playlistRes.json()
      const videoIds = (playlistData.items ?? [])
        .map((item: Record<string, unknown>) => {
          const snip = item.snippet as Record<string, unknown> | undefined
          const resId = snip?.resourceId as Record<string, unknown> | undefined
          return resId?.videoId
        })
        .filter(Boolean) as string[]

      if (!videoIds.length) break

      // Fetch video details
      const videosRes = await api(
        `${YOUTUBE_API_BASE}/videos?part=${VIDEO_PARTS}&id=${videoIds.join(',')}&key=${apiKey}`,
      )
      if (!videosRes.ok) throw new Error(`YouTube API ${videosRes.status} for video details`)

      const videosData = await videosRes.json()
      videoItemsOf(videosData) // antes de qualquer `asked`: corpo malformado não vira falta

      // Batch lookup existing videos
      const { data: existingVideos } = await supabase
        .from('competitor_videos')
        .select('id, video_id, title, description_hash, thumbnail_url, view_count, is_short, last_seen_at, missing_since')
        .eq('competitor_channel_id', channelRow.id)
        .in('video_id', videoIds)
      for (const v of existingVideos ?? []) noteRow(v)
      const existingMap = new Map((existingVideos ?? []).map(v => [v.video_id, v]))
      // (A5) os já gravados que a lista de uploads trouxe foram pedidos a videos.list; o lançamento de `!videosRes.ok` vem antes, então uma chamada que falhou não chega aqui
      for (const v of existingVideos ?? []) asked.add(v.id as string)

      // Current versions of every known video in this page, one query
      const currentByVideo = await loadCurrent((existingVideos ?? []).map(v => v.id as string))
      const touchIds: string[] = []
      /** Os vídeos desta página que têm linha (novos e já gravados), para a captura no fim do laço. */
      const pagePairs: Array<{ uuid: string; item: unknown }> = []

      // Smart incremental: stop if we hit a known video
      let hitKnownVideo = false

      // Shorts de 61–180 s: a sonda decide (R109), só para vídeos novos, dentro do teto da execução.
      const probeCandidates = ((videosData.items ?? []) as Array<Record<string, unknown>>)
        .map(v => ({ id: v.id as string, dur: parseIsoDuration((v.contentDetails as { duration?: string } | undefined)?.duration), title: ((v.snippet as { title?: string } | undefined)?.title) ?? '' }))
        .filter(v => needsShortProbe(v.dur) && !v.title.includes('#Shorts') && !existingMap.has(v.id)) // só novos; os já gravados são do backfill (I-1)
      if (probeCandidates.length) await ensureControl()
      const probes = await probeShortsBatch(probeCandidates.map(v => v.id), probeBudget, f)
      if (probeBudget.stats) probeBudget.stats.pending += probeCandidates.filter(v => isYoutubeVideoId(v.id) && !probes.has(v.id)).length

      for (const video of videosData.items ?? []) {
        videosChecked++
        const videoId = video.id as string
        const apiTitle = (video.snippet?.title as string | undefined) ?? ''
        const title = apiTitle || null
        const apiDescription = video.snippet?.description as string | undefined
        const description = apiDescription ?? ''
        const descriptionHash = crypto.createHash('sha256').update(description).digest('hex').slice(0, 16)
        const thumbnailUrl = (video.snippet?.thumbnails?.maxres?.url ?? video.snippet?.thumbnails?.high?.url ?? null) as string | null
        const viewCount = optCount(video.statistics?.viewCount)
        const publishedAt = (video.snippet?.publishedAt as string) ?? null
        const tags: string[] = (video.snippet?.tags as string[]) ?? []
        const categoryId: string | null = (video.snippet?.categoryId as string) ?? null

        const durationSeconds = parseIsoDuration(video.contentDetails?.duration as string | undefined)
        const observed = observedOf(video)
        if (observed.partsMissing.length) partsMissingIds.add(videoId)
        const probe: ShortProbeResult | undefined = probes.get(videoId)
        const verdict = classifyShort({ durationSeconds, title, probe })
        let isShort = verdict.isShort
        // Já gravado e sem veredito conclusivo nesta rodada (teto esgotado ou sonda inconclusiva): mantém o gravado (R114).
        const keepStored = needsShortProbe(durationSeconds) && !title?.includes('#Shorts') && probe !== 'short' && probe !== 'normal'
        const storedShort = existingMap.get(videoId)?.is_short as boolean | null | undefined
        if (keepStored && storedShort != null && existingMap.has(videoId)) isShort = storedShort
        // Sem a parte contentDetails a duração não veio: o valor gravado fica (parte ausente não apaga nem reclassifica).
        if (observed.patch.duration_seconds === undefined && storedShort != null && existingMap.has(videoId)) isShort = storedShort

        const existing = existingMap.get(videoId) ?? null
        let videoUuid: string | null = existing ? (existing.id as string) : null

        if (!existing) {
          const { data: inserted, error: insErr } = await supabase.from('competitor_videos').insert({
            competitor_channel_id: channelRow.id, video_id: videoId, title, description_hash: descriptionHash, thumbnail_url: thumbnailUrl,
            published_at: publishedAt, duration_seconds: durationSeconds, is_short: isShort, tags, category_id: categoryId,
            original_thumbnail_url: thumbnailUrl, ...observed.patch, discovered_at: nowIso,
          }).select('id').single()
          // (emenda do portão: S-I5) um vídeo que não grava não derruba os outros 49 nem a série do dia
          if (late('não foi possível gravar o vídeo novo', insErr)) continue
          videoUuid = (inserted as { id: string } | null)?.id ?? null
          if (videoUuid) { patched.add(videoUuid); seen.add(videoUuid) }
        } else {
          // Mark as known for smart incremental
          hitKnownVideo = true
        }

        // Versions: <90-day videos every sync, older ones only when the daily record is due; a pinned video every sync (R123)
        const shouldReconcile = dailyDue || (videoUuid != null && pinnedUuids.has(videoUuid)) || (publishedAt ? publishedAt > changeDetectionCutoff : true)
        if (videoUuid && shouldReconcile) {
          await reconcileVideo(videoUuid, videoId, {
            apiTitle, apiDescription, thumbnailUrl, viewCount,
            existingTitle: existing ? (existing.title as string | null) : null,
            existingThumbUrl: existing ? (existing.thumbnail_url as string | null) : null,
          }, currentByVideo.get(videoUuid) ?? [], touchIds)
        }

        if (videoUuid) pagePairs.push({ uuid: videoUuid, item: video })

        if (!existing) continue

        // Update stats
        const { error: updErr } = await supabase
          .from('competitor_videos')
          .update({
            ...(title ? { title } : {}),
            ...(apiDescription !== undefined ? { description_hash: descriptionHash } : {}),
            is_short: isShort,
            // (emenda do portão: S-M2) tags, category_id, thumbnail_url e duration_seconds vêm de observed.patch, só quando a parte veio
            ...observed.patch,
          })
          .eq('id', existing.id)
        seen.add(existing.id as string)
        if (!late('não foi possível atualizar a linha do vídeo', updErr)) patched.add(existing.id as string)
      }

      if (touchIds.length) {
        const { error } = await supabase.from('competitor_video_versions').update({ last_seen_at: nowIso }).in('id', touchIds)
        fail('touch versions', error)
      }
      await captureFetched(pagePairs)

      // Update progress
      await supabase
        .from('competitor_channels')
        .update({ sync_progress: videosChecked })
        .eq('id', channelRow.id)

      nextPageToken = playlistData.nextPageToken as string | undefined
      pageCount++

      // Decide whether to continue
      if (isFullSync) {
        if (videosChecked >= MAX_FULL_SYNC_VIDEOS) break
        if (nextPageToken) await sleep(PAGE_DELAY_MS)
      } else {
        // Smart incremental: stop when we hit a known video or reach per-channel page cap
        if ((!needsBackfill && hitKnownVideo) || pageCount >= maxIncrementalPages) break
      }
    } while (nextPageToken)

    // ── A5 (E2): a faixa de cada vídeo, recalculada a cada sincronização, com os vídeos que a página acabou de inserir ──
    all = await loadAll()
    index()
    tierPlan = classify(all)
    tierChanges = tierPlan.changes.length
    tierCut = tierPlan.cut
    if (tierPlan.changes.length) {
      const { error } = await supabase.rpc('apply_competitor_tier_plan', { p_site_id: channelRow.site_id, p_channel_id: channelRow.id, p_changes: tierPlan.changes, p_today: snapDate })
      // a faixa que não grava não impede a passada diária, que usa o plano em memória; o canal termina em erro
      if (!late('não foi possível gravar a faixa da série', error)) {
        for (const c of tierPlan.changes) { const r = byId.get(c.video_id); if (r) { r.series_tier = c.tier; r.series_tier_since = snapDate } }
      }
    }

    // ── Daily views record (12:00 SP), due per video; also the once-a-day pass over older videos (R17) ──
    let dailyFailure: Error | null = null
    if (hourOk) {
      const tracked = tierPlan.daily.map(id => byId.get(id)!)
      const missing = new Set(await missingDaily(tracked.map(t => t.id), snapDate))
      const todo = tracked.filter(t => missing.has(t.id))
      for (let i = 0; i < todo.length; i += 50) {
        const chunk = todo.slice(i, i + 50)
        try {
          const res = await api(`${YOUTUBE_API_BASE}/videos?part=${VIDEO_PARTS}&id=${chunk.map(c => c.video_id).join(',')}&key=${apiKey}`)
          if (!res.ok) throw new Error(`YouTube API ${res.status} for daily statistics`)
          const body = await res.json()
          videoItemsOf(body)
          for (const c of chunk) asked.add(c.id) // a chamada respondeu: o que não veio nela conta como pedido e não devolvido
          const byYt = new Map(chunk.map(c => [c.video_id, c]))
          const items = ((body.items ?? []) as FetchedItem[]).filter(it => byYt.has(it.id))
          const rows = items
            .filter(it => it.statistics?.viewCount !== undefined)
            .map(it => ({
              video_id: byYt.get(it.id)!.id,
              snap_date: snapDate,
              views: parseInt(it.statistics!.viewCount!, 10),
              likes: it.statistics!.likeCount !== undefined ? parseInt(it.statistics!.likeCount, 10) : null,
              comments: it.statistics!.commentCount !== undefined ? parseInt(it.statistics!.commentCount, 10) : null,
              taken_at: nowIso,
            }))
          excludedNoCount += items.length - rows.length
          if (rows.length) {
            const { data: inserted, error } = await supabase
              .from('competitor_video_daily')
              .upsert(rows, { onConflict: 'video_id,snap_date', ignoreDuplicates: true })
              .select('video_id')
            fail('record daily views', error)
            dailyRecorded += (inserted ?? []).length
          }
          // once-a-day pass: reconcile what the incremental pages did not reach
          await reconcileFetched(items, byYt)
          await patchFetched(items, byYt)
          await captureFetched(items.filter(it => byYt.has(it.id)).map(it => ({ uuid: byYt.get(it.id)!.id, item: it })))
        } catch (e) {
          dailyFailure ??= e instanceof Error ? e : new Error(String(e))
        }
      }
      if (dailyRecorded > 0) {
        // series start: atomic, only while still null
        const { error: e1 } = await supabase.from('competitor_settings')
          .upsert({ site_id: channelRow.site_id }, { onConflict: 'site_id', ignoreDuplicates: true })
        fail('ensure competitor_settings', e1)
        const { error: e2 } = await supabase.from('competitor_settings')
          .update({ series_started_at: nowIso, updated_at: nowIso })
          .eq('site_id', channelRow.site_id)
          .is('series_started_at', null)
        fail('start series', e2)
      }
      if (dailyFailure) throw dailyFailure // the next sync fills in the missing ids
    }

    // ── Pinned videos (R123): checked on EVERY sync. What the playlist pages or the daily pass already reconciled is
    // skipped, so a channel with no pins, or whose pins were all reached above, makes no extra call. ──
    const pinnedLeft = pinned.filter(p => !reconciled.has(p.id))
    for (let i = 0; i < pinnedLeft.length; i += 50) {
      const chunk = pinnedLeft.slice(i, i + 50)
      const res = await api(`${YOUTUBE_API_BASE}/videos?part=${VIDEO_PARTS}&id=${chunk.map(c => c.video_id).join(',')}&key=${apiKey}`)
      if (!res.ok) throw new Error(`YouTube API ${res.status} for pinned videos`)
      const body = await res.json()
      videoItemsOf(body)
      for (const c of chunk) asked.add(c.id)
      const fetched = (body.items ?? []) as FetchedItem[], byYt = new Map(chunk.map(c => [c.video_id, c]))
      await reconcileFetched(fetched, byYt)
      await patchFetched(fetched, byYt)
      await captureFetched(fetched.filter(it => byYt.has(it.id)).map(it => ({ uuid: byYt.get(it.id)!.id, item: it })))
    }

    // ── Re-classificação dos já gravados como longos com 61–180 s (R109), mesmo teto da execução ──
    try {
      if (!opts.deferBackfill) {
        await reclassifyStoredShorts(supabase, channelRow.id, nowMs, probeBudget, f, ensureControl)
        if (probeBudget.stats) warnIfProbeBlocked(probeBudget.stats) // "sincronizar agora" também avisa
      }
    } catch {
      // a sonda nunca derruba o sync
    }

    // Notifications (unchanged from original)
    let semDestinatario = false
    if (changesDetected > 0 && process.env.COMPETITOR_NOTIFICATIONS_ENABLED !== 'false') {
      try {
        const owners = await getSiteOwners(supabase, channelRow.site_id)
        if (owners.length === 0) {
          semDestinatario = true
          logSemDestinatario('competitor-sync', channelRow.site_id)
        }

        for (const owner of owners) {
          await createNotification({
            site_id: channelRow.site_id,
            user_id: owner.userId,
            type: 'youtube.competitor_change',
            domain: 'youtube',
            priority: 2,
            title: `${changesDetected} mudança(s) em ${snippet?.title ?? channelRow.channel_id}`,
            message: `Detectamos mudanças em vídeos de ${snippet?.title ?? 'competidor'}. Confira no Observatório.`,
            action_href: link.mudancas(),
            dedup_key: `competitor-change-${channelRow.id}-${nowIso.slice(0, 10)}`,
          })
        }
      } catch {
        // Non-fatal
      }
    }

    // ── A5 (E1): o que foi pedido e não veio em NENHUMA chamada desta sincronização soma UMA falta ──
    // Gravação nova: só depois da série do dia e dos fixados, e falhar aqui vira `lateFailure` (o canal termina em erro, sem perder o resto).
    try {
      const missedIds = [...asked].filter(id => !seen.has(id))
      if (missedIds.length) {
        missedStats = await markMissing(supabase, { siteId: channelRow.site_id, channelId: channelRow.id, videoIds: missedIds, nowIso, weeklySinceOf: id => rowInfo.get(id)?.weeklySince ?? null })
      }
    } catch (e) {
      // a marca (o rpc) pode já estar no banco quando a versão 'sumiu' falha: o que é conhecido chega ao resultado
      const progress = missingProgressOf(e)
      if (progress) missedStats = progress
      lateFailure ??= e instanceof Error ? e : new Error(String(e))
    }

    // (A5) O erro da primeira gravação que não é pré-requisito da série do dia: lançado aqui, depois da passada diária, dos
    // fixados e das notificações; o canal termina em erro e não carimba last_ok_synced_at.
    if (lateFailure) throw lateFailure

    // Mark completion
    const updatePayload: Record<string, unknown> = {
      sync_status: 'idle',
      sync_error: null,
      last_ok_synced_at: nowIso,
      sync_error_since: null,
    }
    if (isFullSync) {
      updatePayload.full_sync_completed_at = nowIso
    }
    await supabase.from('competitor_channels').update(updatePayload).eq('id', channelRow.id)

    await flushQuota()
    return { ...counters(), ...(semDestinatario ? { sem_destinatario: true } : {}) }
  } catch (error) {
    // a cota gasta até aqui é gravada mesmo com o canal em erro (a chamada que falhou também custou)
    await flushQuota()
    // os contadores acompanham o erro (syncStatsOf): o lote só vê o erro, e o que faltou/limpou não pode sumir junto
    if (typeof error === 'object' && error !== null) failedStats.set(error, counters())
    // Set error status, preserve partial data
    await supabase
      .from('competitor_channels')
      .update({
        sync_status: 'error',
        sync_error: error instanceof Error ? error.message : 'Unknown sync error',
        sync_error_since: prevErrorSince ?? nowIso,
      })
      .eq('id', channelRow.id)
    throw error
  }
}

export { reclassifyStoredShorts } from '@/lib/youtube/short-backfill'
