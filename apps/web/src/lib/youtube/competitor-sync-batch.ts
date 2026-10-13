import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { syncCompetitorChannel, syncCompetitorWeekly, syncStatsOf, spDate, WeeklyVersionError, type SyncResult, type ThumbBreaker } from '@/lib/youtube/competitor-sync'
import { missingProgressOf, rowsAs } from '@/lib/youtube/competitor-capture'
import { recordQuota } from '@/lib/youtube/competitor-quota'
import { createNotification } from '@/lib/notifications/create'
import { getSiteOwners, logSemDestinatario } from '@/lib/notifications/get-site-owners'
import { humanizeSyncError } from '@/lib/youtube/observatorio/channels'
import { link } from '@/lib/youtube/observatorio/links'
import { newProbeBudget, type ShortProbeStats } from '@/lib/youtube/short-classifier'
import { reclassifyStoredShortsRoundRobin } from '@/lib/youtube/short-backfill'
import { runControlProbe, warnIfProbeBlocked } from '@/lib/youtube/short-guard'

/** Depois disso o backfill de Shorts não começa (e o rodízio para): folga contra maxDuration = 300 s. */
export const BACKFILL_DEADLINE_MS = 230_000

/** Depois disso o lote não começa canal novo. (Era o literal 200_000 da rota.) */
export const BATCH_BUDGET_MS = 200_000
// O corte fixo de 150 s saiu: ele era contado do início do disparo, e a ordem dos canais é a mesma todo dia, então os canais das
// posições 7 a 11 nunca leriam os semanais. A leitura semanal é uma FASE do disparo.
/** Depois disso a fase semanal não começa vídeo novo. Fica entre "começar canal" (200 s) e o backfill de Shorts (230 s). */
export const WEEKLY_DEADLINE_MS = 210_000
/** O máximo de uma visita da fase semanal a um canal: um canal grande não tira a vez dos outros. */
export const WEEKLY_CHANNEL_BUDGET_MS = 60_000
/** A duração máxima da função do cron (`export const maxDuration` da rota). Um teste confere os dois. */
export const COMPETITORS_MAX_DURATION_S = 300
/** O aviso ao dono tem teto de tempo e de quantidade por disparo: ele nunca atrasa a coleta. */
const OWNER_NOTICE_TIMEOUT_MS = 8_000
const OWNER_NOTICE_MAX = 5

export const SLOT_HOURS_SP = [0, 6, 12, 18] as const
const H = 3_600_000
const SP_OFFSET = 3 * H

/** Last 00/06/12/18 São Paulo boundary at or before `nowMs`. */
export function currentSlotStart(nowMs: number): number {
  const local = nowMs - SP_OFFSET
  const dayStart = Math.floor(local / (24 * H)) * 24 * H
  const hour = Math.floor((local - dayStart) / H)
  const slot = [...SLOT_HOURS_SP].reverse().find((h) => h <= hour) ?? 0
  return dayStart + slot * H + SP_OFFSET
}

/** Never synced, or synced before the current slot. */
export function isDue(lastSyncedAt: string | null, nowMs: number): boolean {
  return lastSyncedAt === null || Date.parse(lastSyncedAt) < currentSlotStart(nowMs)
}

/** A linha de canal que o lote lê: o necessário para escolher os devidos, a fase semanal e a nota do dono. */
export type BatchRow = {
  id: string; channel_id: string; channel_name: string | null; site_id: string
  last_synced_at: string | null; last_ok_synced_at: string | null; sync_status: string | null
  sync_error: string | null; sync_error_since: string | null; missing_since: string | null; weekly_pass_date: string | null
}
const isBatchRow = (x: unknown): x is BatchRow => {
  if (typeof x !== 'object' || x === null) return false
  const r: Record<string, unknown> = Object.fromEntries(Object.entries(x))
  return typeof r.id === 'string' && typeof r.channel_id === 'string' && typeof r.site_id === 'string'
}

export interface BatchTotals {
  unitsUsed: number; dailyRecorded: number; weeklyRecorded: number; weeklyDeferred: number; earlyRecorded: number
  fieldsOpened: number; fieldsClosed: number; rawOpened: number; rawClosed: number; rawTooBig: number
  missed: number; newlyMissing: number; returned: number; tierChanges: number; cutByCap: number; excludedNoCount: number
  promoted: number; promotionExtended: number; longWindowChanges: number
  partsMissing: number; channelPartsMissing: number; sanitized: number; duplicates: number; invalid: number; captureSkipped: number
  thumbFailed: number; thumbSkipped: number; versionFailed: number
  quotaErrors: number; quotaUnitsLost: number
}
const zeroTotals = (): BatchTotals => ({
  unitsUsed: 0, dailyRecorded: 0, weeklyRecorded: 0, weeklyDeferred: 0, earlyRecorded: 0,
  fieldsOpened: 0, fieldsClosed: 0, rawOpened: 0, rawClosed: 0, rawTooBig: 0,
  missed: 0, newlyMissing: 0, returned: 0, tierChanges: 0, cutByCap: 0, excludedNoCount: 0,
  promoted: 0, promotionExtended: 0, longWindowChanges: 0,
  partsMissing: 0, channelPartsMissing: 0, sanitized: 0, duplicates: 0, invalid: 0, captureSkipped: 0,
  thumbFailed: 0, thumbSkipped: 0, versionFailed: 0,
  quotaErrors: 0, quotaUnitsLost: 0,
})
/** Os contadores da sincronização de um canal que somam direto nos totais do disparo (os mesmos nomes nos dois lados). */
const SYNC_SUMMED = [
  'unitsUsed', 'dailyRecorded', 'earlyRecorded', 'fieldsOpened', 'fieldsClosed', 'rawOpened', 'rawClosed', 'rawTooBig',
  'missed', 'newlyMissing', 'returned', 'tierChanges', 'cutByCap', 'excludedNoCount', 'promotionExtended',
  'partsMissing', 'channelPartsMissing', 'sanitized', 'duplicates', 'invalid', 'captureSkipped', 'quotaUnitsLost',
] as const satisfies ReadonlyArray<keyof BatchTotals & keyof SyncResult>

export interface WeeklyPhaseResult {
  ran: boolean; visited: number; complete: number; pending: number; recorded: number; deferred: number; promoted: number; errors: number; unitsUsed: number
  longWindowChanges: number; thumbFailed: number; thumbSkipped: number; versionFailed: number
  /** O primeiro erro da fase (canal e motivo): a resposta do cron é onde ele fica visível. */
  firstError?: string
  /** Erros da fase por site: o número de cada site vai para a linha da cota do dia dele. */
  errorsBySite: Record<string, number>
}
const emptyWeekly = (): WeeklyPhaseResult => ({ ran: false, visited: 0, complete: 0, pending: 0, recorded: 0, deferred: 0, promoted: 0, errors: 0, unitsUsed: 0, longWindowChanges: 0, thumbFailed: 0, thumbSkipped: 0, versionFailed: 0, errorsBySite: {} })

export interface BatchResult {
  synced: number
  errors: number
  skipped: number
  remainingDue: number
  stoppedForTime: boolean
  shorts_probe?: ShortProbeStats
  /** Sites with at least one channel synced or errored in this run (an errored sync may have written part of its data). */
  siteIds: string[]
  /** Todo site com canal concorrente, sincronizado ou não neste disparo: a prova é lida para todos. */
  healthSiteIds: string[]
  totals: BatchTotals
  weekly: WeeklyPhaseResult
  /** O que só o dono resolve (canal em erro há mais de 3 dias), recalculado do banco a cada disparo. */
  acao_do_dono: string[]
  /** Avisos ao dono (canal que cruzou o 3º dia em erro e lembretes semanais): enviados e com falha. */
  ownerNotices: { sent: number; failed: number }
  /** Unidades de cota que nem a nova tentativa do fim do disparo conseguiu gravar; indefinido = tudo gravado. */
  quotaLost?: number
}

/** Health verdict: fail when at least half of the attempted channels errored. */
export function batchHealth(r: Pick<BatchResult, 'synced' | 'errors'>): { ok: boolean; message?: string } {
  const attempted = r.errors + r.synced
  if (r.errors > 0 && r.errors >= r.synced) {
    return { ok: false, message: `${r.errors} of ${attempted} channels failed` }
  }
  return { ok: true }
}

const spHour = (ms: number): number => new Date(ms - SP_OFFSET).getUTCHours()
const DAY_MS = 86_400_000
const nameOf = (r: BatchRow): string => r.channel_name ?? r.channel_id

/**
 * A fase semanal do disparo (A5 E2, OP-15). Roda DEPOIS dos canais devidos, a partir das 12:00 de São Paulo. Visita os canais
 * cuja passada semanal de hoje ainda não está completa (weekly_pass_date diferente de hoje), a dívida mais antiga primeiro
 * (nunca carimbado antes de todos), com até WEEKLY_CHANNEL_BUDGET_MS por visita, em rodízio, enquanto o disparo tem menos de
 * WEEKLY_DEADLINE_MS. Nada aqui depende da posição do canal na fila da sincronização nem de qual faixa é: o que não coube
 * continua devido pelo dado e é o primeiro do disparo seguinte.
 * Um só disjuntor de miniatura serve a todos os canais do disparo (a queda do host de imagens é de todos).
 */
export async function runWeeklyPhase(rows: BatchRow[], o: { apiKey: string; started: number; now: () => number; thumbs?: boolean }): Promise<WeeklyPhaseResult> {
  const out = emptyWeekly()
  const today = spDate(o.now())
  const eligible = rows.filter(r => r.missing_since == null)
  const doneToday = new Set(eligible.filter(r => r.weekly_pass_date === today).map(r => r.id))
  out.pending = eligible.length - doneToday.size
  if (spHour(o.now()) < 12) return out
  out.ran = true
  const key = (r: BatchRow): string => r.weekly_pass_date ?? '' // nulo (nunca) antes de qualquer data
  let queue = eligible.filter(r => !doneToday.has(r.id)).sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const overall = (): boolean => o.now() - o.started >= WEEKLY_DEADLINE_MS
  const breaker: ThumbBreaker = { failures: 0 }
  const lastDeferred = new Map<string, number>()
  const count = (r: { recorded: number; promoted: number; unitsUsed: number; longWindowChanges: number; thumbFailed?: number; thumbSkipped?: number; versionFailed?: number }): void => {
    out.recorded += r.recorded; out.promoted += r.promoted; out.unitsUsed += r.unitsUsed; out.longWindowChanges += r.longWindowChanges
    out.thumbFailed += r.thumbFailed ?? 0; out.thumbSkipped += r.thumbSkipped ?? 0; out.versionFailed += r.versionFailed ?? 0
  }
  const fail = (row: BatchRow, err: unknown): void => {
    out.errors++
    out.errorsBySite[row.site_id] = (out.errorsBySite[row.site_id] ?? 0) + 1
    out.firstError ??= (nameOf(row) + ': ' + (err instanceof Error ? err.message : String(err))).slice(0, 200)
    Sentry.captureException(err, { tags: { component: 'sync-youtube', mode: 'competitors-weekly' }, extra: { channelId: row.channel_id, siteId: row.site_id } })
  }
  while (queue.length && !overall()) {
    const again: BatchRow[] = []
    let progressed = false
    for (const row of queue) {
      if (overall()) { again.push(row); continue }
      const visitStart = o.now()
      try {
        const r = await syncCompetitorWeekly(row, o.apiKey, { thumbs: o.thumbs, thumbBreaker: breaker, deadline: () => overall() || o.now() - visitStart >= WEEKLY_CHANNEL_BUDGET_MS })
        out.visited++
        count(r)
        if (r.skipped) continue // sendo sincronizado agora: fica para o disparo seguinte
        if (r.complete) { doneToday.add(row.id); out.complete++; lastDeferred.delete(row.id); continue }
        if (r.deferred === 0) continue // nada devido e nada adiado, mas sem passada completa (vídeo ainda sem faixa): voltar a ele neste disparo não muda nada
        lastDeferred.set(row.id, r.deferred)
        again.push(row)
        if (r.recorded > 0) progressed = true
      } catch (err) {
        if (err instanceof WeeklyVersionError) {
          // a leitura TERMINOU (os pontos estão gravados e o canal foi carimbado, porque o recibo é o ponto): os contadores vêm do resultado
          out.visited++
          count(err.result)
          if (err.result.complete) { doneToday.add(row.id); out.complete++; lastDeferred.delete(row.id) }
          fail(row, err)
          continue
        }
        // erro da fase semanal NÃO põe o canal em erro (a sincronização dele deu certo) e não volta à fila neste disparo
        fail(row, err)
      }
    }
    queue = again
    if (!progressed) break // ninguém andou nesta volta: não gira em falso
  }
  out.deferred = [...lastDeferred.values()].reduce((a, b) => a + b, 0)
  out.pending = eligible.length - doneToday.size
  return out
}

/** Canais em erro há mais de 3 dias (a mesma conta do SQL: sync_error_since, canal não ausente). A nota e o aviso saem daqui. */
type LongError = { row: BatchRow; sinceMs: number; days: number; reason: string }
function longErrors(rows: BatchRow[], nowMs: number): LongError[] {
  const out: LongError[] = []
  for (const row of rows) {
    if (row.sync_status !== 'error' || row.missing_since != null || row.sync_error_since == null) continue
    const sinceMs = Date.parse(row.sync_error_since)
    if (!(nowMs - sinceMs > 3 * DAY_MS)) continue
    // os dias contam da última sincronização boa (é o que o dono sente: "faz N dias que não atualiza"); sem ela, do começo do erro
    const lastOk = row.last_ok_synced_at != null ? Date.parse(row.last_ok_synced_at) : NaN
    const days = Math.floor((nowMs - (Number.isFinite(lastOk) ? lastOk : sinceMs)) / DAY_MS)
    out.push({ row, sinceMs, days, reason: row.sync_error ? humanizeSyncError(row.sync_error).slice(0, 160) : 'erro sem mensagem registrada' })
  }
  return out.sort((a, b) => a.sinceMs - b.sinceMs || (a.row.id < b.row.id ? -1 : 1))
}

/**
 * O aviso ao dono: UMA notificação quando o canal cruza o 3º dia em erro e um lembrete por semana enquanto durar. A trava é o estado
 * gravado: a chave (canal, dia em que o erro começou, número da semana desde o 3º dia) é única por dono em `notifications`
 * (índice idx_notifications_dedup), e a consulta abaixo evita até a tentativa. Nunca lança: aviso que falha não derruba o cron.
 */
async function noticeOwners(sb: ReturnType<typeof getSupabaseServiceClient>, rows: BatchRow[], nowMs: number): Promise<{ sent: number; failed: number }> {
  const counts = { sent: 0, failed: 0 }
  if (process.env.COMPETITOR_NOTIFICATIONS_ENABLED === 'false') return counts
  const todo = longErrors(rows, nowMs).slice(0, OWNER_NOTICE_MAX).map(e => {
    const week = Math.floor((nowMs - e.sinceMs - 3 * DAY_MS) / (7 * DAY_MS))
    return { ...e, week, dedup: 'competitor-channel-error-' + e.row.id + '-' + new Date(e.sinceMs).toISOString().slice(0, 10) + '-' + week }
  })
  if (!todo.length) return counts
  const work = async (): Promise<void> => {
    let already = new Set<string>()
    try {
      const { data, error } = await sb.from('notifications').select('dedup_key').in('dedup_key', todo.map(t => t.dedup))
      if (!error && Array.isArray(data)) already = new Set(data.flatMap(d => (typeof d === 'object' && d !== null && 'dedup_key' in d && typeof d.dedup_key === 'string' ? [d.dedup_key] : [])))
    } catch { /* sem a consulta, tenta criar: o índice único do banco impede a repetição */ }
    const owners = new Map<string, Awaited<ReturnType<typeof getSiteOwners>>>()
    for (const t of todo) {
      if (already.has(t.dedup)) continue
      const name = nameOf(t.row)
      if (!owners.has(t.row.site_id)) owners.set(t.row.site_id, await getSiteOwners(sb, t.row.site_id))
      const list = owners.get(t.row.site_id) ?? []
      if (!list.length) { logSemDestinatario('competitor-sync-batch', t.row.site_id); continue }
      for (const owner of list) {
        try {
          const r = await createNotification({
            site_id: t.row.site_id, user_id: owner.userId, type: 'youtube.competitor_channel_error', domain: 'youtube', priority: 3,
            title: t.week === 0 ? 'O canal ' + name + ' está em erro há ' + t.days + ' dias' : 'Lembrete: o canal ' + name + ' continua em erro (' + t.days + ' dias)',
            message: t.week === 0
              ? 'O Observatório não consegue atualizar o canal ' + name + ' há ' + t.days + ' dias. Motivo: ' + t.reason + '. Confira o canal: se ele saiu do YouTube ou mudou de endereço, vale trocar ou remover.'
              : 'O canal ' + name + ' continua sem atualizar há ' + t.days + ' dias. Motivo: ' + t.reason + '. Confira o canal no Observatório.',
            action_href: link.canais({ filter: 'problemas' }),
            dedup_key: t.dedup,
          })
          if (!r.success) { counts.failed++; Sentry.captureMessage('aviso de canal em erro não criado: ' + (r.error ?? 'sem detalhe'), { level: 'warning', tags: { component: 'sync-youtube', mode: 'competitors-notice' } }) }
          else if (!r.suppressed) counts.sent++
        } catch (err) {
          counts.failed++
          Sentry.captureException(err, { tags: { component: 'sync-youtube', mode: 'competitors-notice' }, extra: { channelId: t.row.channel_id, siteId: t.row.site_id } })
        }
      }
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([work(), new Promise<void>(resolve => { timer = setTimeout(() => { Sentry.captureMessage('aviso ao dono passou de ' + OWNER_NOTICE_TIMEOUT_MS / 1000 + ' s', { level: 'warning', tags: { component: 'sync-youtube', mode: 'competitors-notice' } }); resolve() }, OWNER_NOTICE_TIMEOUT_MS) })])
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'sync-youtube', mode: 'competitors-notice' } })
  } finally {
    clearTimeout(timer)
  }
  return counts
}

export async function runCompetitorBatch(opts: {
  apiKey: string
  batchSize: number
  budgetMs: number
  now?: () => number
  /** A fase semanal do disparo (padrão desligada; a rota liga). Desligar não muda nada além dela. */
  weekly?: boolean
  /** false = a fase semanal não confere a miniatura */
  thumbs?: boolean
}): Promise<BatchResult> {
  const now = opts.now ?? Date.now
  const started = now()
  const sb = getSupabaseServiceClient()
  const { data, error } = await sb
    .from('competitor_channels')
    .select('id, channel_id, channel_name, site_id, last_synced_at, last_ok_synced_at, sync_status, sync_error, sync_error_since, missing_since, weekly_pass_date')
    .order('last_synced_at', { ascending: true, nullsFirst: true })
  if (error) throw new Error(`competitor batch: ${error.message}`)
  // Resposta nula ou fora da forma é falha de leitura, nunca "nenhum canal" (lista vazia só quando o banco diz que é vazia).
  const rows = rowsAs(data, isBatchRow, 'competitor batch')
  // Defensive: channels stuck in 'error' go after the healthy ones so they can
  // never starve the cursor. Array.sort is stable, so the oldest-first order
  // (nulls first) is kept within each group.
  const due = rows
    .filter((r) => isDue(r.last_synced_at, started))
    .sort((a, b) => Number(a.sync_status === 'error') - Number(b.sync_status === 'error'))
  const probeBudget = newProbeBudget() // 60 sondas de Short por execução, divididas entre os canais
  // Sonda de controle uma vez por execução, antes das demais (I-2).
  if (due.length) await runControlProbe(sb, probeBudget, fetch)
  const res: BatchResult = {
    synced: 0, errors: 0, skipped: 0, remainingDue: 0, stoppedForTime: false, siteIds: [],
    totals: zeroTotals(), healthSiteIds: [...new Set(rows.map(r => r.site_id))], weekly: emptyWeekly(),
    acao_do_dono: longErrors(rows, started).map(e => 'canal ' + nameOf(e.row) + ' em erro há ' + e.days + ' dias: ' + e.reason),
    ownerNotices: { sent: 0, failed: 0 },
  }
  // O aviso vem antes dos canais de propósito: os tetos de tempo são contados do começo do disparo, então o aviso (limitado a 8 s) só
  // encurta a lista deste disparo e nunca empurra o fim dele.
  res.ownerNotices = await noticeOwners(sb, rows, started)
  const t = res.totals
  const add = (r: Partial<Record<keyof BatchTotals, number>>): void => { for (const k of SYNC_SUMMED) t[k] += r[k] ?? 0 }
  const lostBySite = new Map<string, { units: number; errors: number }>()
  const lose = (siteId: string, r: SyncResult): void => {
    if (!r.quotaError) return
    t.quotaErrors++
    const cur = lostBySite.get(siteId) ?? { units: 0, errors: 0 }
    lostBySite.set(siteId, { units: cur.units + (r.quotaUnitsLost ?? 0), errors: cur.errors + 1 })
  }
  let taken = 0
  const syncedIds: string[] = []
  const touchedSites = new Set<string>()
  for (const row of due) {
    if (taken >= opts.batchSize) break
    if (now() - started > opts.budgetMs) {
      res.stoppedForTime = true
      break
    }
    taken++
    try {
      const r = await syncCompetitorChannel(row, opts.apiKey, { probeBudget, deferBackfill: true })
      if (r.skipped) res.skipped++
      else { res.synced++; syncedIds.push(row.id); touchedSites.add(row.site_id); add(r); lose(row.site_id, r) }
    } catch (err) {
      res.errors++
      touchedSites.add(row.site_id)
      // os contadores acompanham o erro: o canal que terminou em erro também leu, limpou e perdeu cota
      const stats = syncStatsOf(err)
      if (stats) { add(stats); lose(row.site_id, stats) }
      else {
        const progress = missingProgressOf(err)
        if (progress) { t.missed += progress.missed; t.newlyMissing += progress.newlyMissing }
      }
      Sentry.captureException(err, {
        tags: { component: 'sync-youtube', mode: 'competitors' },
        extra: { channelId: row.channel_id, siteId: row.site_id },
      })
    }
  }
  // ── A5 (E2): a fase semanal. Depois dos canais devidos (a série diária vem sempre antes), antes do backfill de Shorts. ──
  if (opts.weekly === true) {
    res.weekly = await runWeeklyPhase(rows, { apiKey: opts.apiKey, started, now, thumbs: opts.thumbs })
    const w = res.weekly
    t.weeklyRecorded += w.recorded; t.weeklyDeferred += w.deferred; t.promoted += w.promoted; t.unitsUsed += w.unitsUsed
    t.longWindowChanges += w.longWindowChanges; t.thumbFailed += w.thumbFailed; t.thumbSkipped += w.thumbSkipped; t.versionFailed += w.versionFailed
    // o número de erros da fase fica na linha da cota do dia do site, que é durável; a resposta do cron ninguém guarda
    for (const [siteId, n] of Object.entries(w.errorsBySite)) await recordQuota(sb, { siteId, nowMs: now(), units: 0, mode: 'competitors_semanal', extra: { erros_semanal: n } }).catch(() => undefined)
  }
  // ── A cota que um canal não conseguiu gravar: uma nova tentativa por site; se essa falhar, o resumo diz quanto ficou de fora. ──
  for (const [siteId, lost] of lostBySite) {
    if (lost.units <= 0) continue
    try { await recordQuota(sb, { siteId, nowMs: now(), units: lost.units, mode: 'competitors', extra: { erros_cota: lost.errors } }) }
    catch { res.quotaLost = (res.quotaLost ?? 0) + lost.units }
  }
  // Backfill só depois de todos os vídeos novos (R114), em rodízio entre os canais sincronizados.
  try {
    await reclassifyStoredShortsRoundRobin(sb, syncedIds, started, probeBudget, fetch, () => now() - started > BACKFILL_DEADLINE_MS)
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'sync-youtube', mode: 'competitors-shorts-backfill' } })
  }
  const st = probeBudget.stats!
  res.shorts_probe = { ...st }
  warnIfProbeBlocked(st)
  res.remainingDue = due.length - taken
  res.siteIds = [...touchedSites]
  return res
}
