// Port of dados.js:858-935, 1035-1058, 1966-1985 (+ sync.label at 415): channel stats, cadence, sync labels, problem phrase.
import { RULES, DEFAULT_AGES } from './rules'
import { median } from './stats'
import { DAY, H, WD } from './time'
import { changesIn } from './changes'
import { outliers, median7 } from './outliers'
import type { EngineCtx, Derived } from './series'
import type { Fmt, ObsChannel, ObsVideo, SyncState } from './types'

type V = ObsVideo & Derived
type Ch = ObsChannel & { videos: ObsVideo[] }
const p2 = (n: number) => (n < 10 ? '0' : '') + n

export function syncLabel(state: SyncState): 'sincronizado' | 'atrasado' | 'erro' | 'buscando vídeos' {
  return ({ ok: 'sincronizado', atrasado: 'atrasado', erro: 'erro', backfill: 'buscando vídeos' } as const)[state]
}

/** Maps the DB `sync_error` text to the owner-facing reason. Unknown text is returned as is, never hidden. */
export function humanizeSyncError(msg: string): string {
  if (/YouTube API 404|\b404\b/.test(msg)) return 'não encontrado no YouTube (404)'
  if (/quotaExceeded|403/.test(msg)) return 'cota diária da API do YouTube esgotada'
  if (/timeout|aborted/i.test(msg)) return 'tempo de resposta do YouTube esgotado'
  return msg
}

export interface SyncRow {
  sync_status: string; sync_error: string | null; last_ok_synced_at: string | null; sync_error_since: string | null
  youtube_video_count: number | null; video_limit: number; tracked: number; full_sync_completed_at?: string | null
}
/**
 * Sync state from DB columns (used by load.ts). erro > backfill > atrasado > ok.
 * R21: 'backfill' iff the channel never completed an OK sync. After one OK sync a channel is never backfill
 * because tracked < youtube_video_count (Shorts/private videos are normal) or full_sync_completed_at is null.
 */
export function deriveSyncState(row: SyncRow, nowMs: number): SyncState {
  if (row.sync_status === 'error') return 'erro'
  if (row.last_ok_synced_at == null) return 'backfill'
  if (nowMs - Date.parse(row.last_ok_synced_at) > RULES.syncLateHours * H) return 'atrasado'
  return 'ok'
}
/** Backfill progress (R21): tracked / min(video_limit, youtube_video_count ?? video_limit). */
export function backfillProgress(row: Pick<SyncRow, 'tracked' | 'video_limit' | 'youtube_video_count'>): { done: number; total: number } {
  return { done: row.tracked, total: Math.min(row.video_limit, row.youtube_video_count ?? row.video_limit) }
}

const vids = (ctx: EngineCtx, ch: Ch): V[] => ch.videos.map(v => ctx.V.get(v.id) ?? (v as V))

export const NEVER_SYNCED = 'nunca sincronizado com sucesso'

/** Owner-facing reason for a channel in trouble; null when ok. */
export function problemLabel(ctx: EngineCtx, ch: ObsChannel): string | null {
  const s = ch.sync
  if (s.state === 'erro') return s.msg ? humanizeSyncError(s.msg) : 'erro sem mensagem registrada'
  if (s.state === 'atrasado') return s.last == null ? NEVER_SYNCED : 'sem sincronização boa há ' + Math.round((ctx.clock.now - s.last) / H) + ' h'
  if (s.state === 'backfill') return s.backfill ? 'ainda buscando vídeos (' + s.backfill.done + ' de ' + s.backfill.total + ')' : 'ainda buscando vídeos'
  return null
}

/** Single problem phrase anchored on the last success (dados.js:1966-1985); a channel that never synced OK says so, with no date. */
export function problemPhrase(ctx: EngineCtx, ch: ObsChannel): string | null {
  const s = ch.sync, { clock } = ctx
  if (s.state === 'backfill') return syncLabel('backfill') + (s.backfill ? ' (' + s.backfill.done + ' de ' + s.backfill.total + ')' : '')
  if (s.state === 'ok') return null
  if (s.last == null) return (s.state === 'erro' ? 'erro' : 'atrasado') + ' · ' + NEVER_SYNCED + (s.state === 'erro' ? ' · ' + problemLabel(ctx, ch) : '')
  if (s.state === 'atrasado') return 'atrasado · última sincronização ' + clock.dmhm(s.last) + ' (' + clock.ago(s.last) + ')'
  return 'erro desde ' + clock.dmhm(s.errorSince || s.last) + ' · última sincronização boa ' + clock.dmhm(s.last) + ' · ' + problemLabel(ctx, ch)
}

export function cadence(ctx: EngineCtx, channelId: string, fmtId: Fmt = 'long') {
  const { clock } = ctx, NOW = clock.now
  const ch = ctx.CH.get(channelId)!
  const W = RULES.habit.weeks, from = NOW - W * 7 * DAY
  const vs = ch.videos.filter(v => v.fmt === fmtId && v.pub > from)
  const weeks = Array.from({ length: W }, (_, w) => { const a = from + w * 7 * DAY, b = a + 7 * DAY; return { from: a, to: b, n: vs.filter(v => v.pub > a && v.pub <= b).length } })
  const pw = Math.round(vs.length / W * 10) / 10
  const pairs: Record<string, number> = {}
  vs.forEach(v => { const p = clock.parts(v.pub), k = p.dow + '|' + p.h; pairs[k] = (pairs[k] || 0) + 1 })
  const best = Object.entries(pairs).sort((a, b) => b[1] - a[1])[0]
  let habit: { costuma: boolean; text: string; dow?: number; hour?: number; n: number; total?: number; share?: number }
  if (best && best[1] >= RULES.habit.minCount && best[1] / vs.length >= RULES.habit.minShare) {
    const [dow, h] = best[0].split('|').map(Number) as [number, number]
    habit = { costuma: true, dow, hour: h, n: best[1], total: vs.length, share: best[1] / vs.length, text: 'costuma publicar ' + WD[dow] + ' às ' + p2(h) + ':00 (' + best[1] + ' de ' + vs.length + ')' }
  } else habit = { costuma: false, n: vs.length, text: vs.length ? 'horário variado (n = ' + vs.length + ')' : 'nenhum vídeo em 13 semanas' }
  const last = ch.videos.filter(v => v.fmt === fmtId)[0] || null
  const partial = ch.sync.state === 'backfill', fetchedSince = partial && ch.videos.length ? ch.videos[ch.videos.length - 1]!.pub : null
  return {
    channel: channelId, fmt: fmtId, weeks, pw, n: vs.length, habit, lastUpload: last ? last.pub : null, lastUploadAgo: last ? clock.ago(last.pub) : null,
    partial, fetchedSince,
    partialText: partial ? 'ritmo parcial: só os ' + (ch.sync.backfill ? ch.sync.backfill.done : ch.videos.length) + ' vídeos mais recentes foram buscados' + (fetchedSince != null ? ' (desde ' + clock.dmOrDmy(fetchedSince) + ')' : '') : null,
  }
}

const snapAt = (ch: ObsChannel, ms: number) => { let best = null; for (const x of ch.snapshots) { if (x.t <= ms) best = x; else break } return best }
function roundingOf(ctx: EngineCtx, ch: ObsChannel, growth: { abs: number | null }) {
  const { fmt } = ctx
  const unit = ch.subs < 1000 ? 1 : Math.pow(10, Math.floor(Math.log10(ch.subs)) - 2)
  const err = ch.subs < 1000 ? 0 : unit / 2
  return {
    roundingUnit: unit, roundingError: err, roundingText: err ? '±' + fmt.num(err) : 'exato',
    withinRounding: growth.abs == null ? null : Math.abs(growth.abs) <= unit, uncertainty: ch.subs < 1000 ? 0 : unit,
    text: growth.abs == null ? null : Math.abs(growth.abs) <= unit ? '≈ 0 (dentro do arredondamento do YouTube, ±' + fmt.num(unit) + ')'
      : (growth.abs > 0 ? '+' : '') + fmt.num(growth.abs) + (unit > 1 ? ' (±' + fmt.num(unit) + ')' : ''),
  }
}
function maxBelow(ctx: EngineCtx, ch: Ch, fmtId: Fmt) {
  const cand = vids(ctx, ch).filter(v => v.tracked && v.fmt === fmtId && v.ageDays <= 90 && v.mult && v.mult.value != null && v.mult.value < RULES.outlierMin)
    .sort((a, b) => b.mult!.value! - a.mult!.value!)[0]
  return cand ? { id: cand.id, value: cand.mult!.value, n: cand.mult!.n, weak: cand.mult!.weak, label: ctx.fmt.mult(cand.mult!.value) + ' a mediana' } : null
}
const strong90 = (ctx: EngineCtx, ch: Ch, fmtId: Fmt) => vids(ctx, ch).filter(v => v.tracked && v.fmt === fmtId && v.ageDays <= 90 && v.mult && v.mult.value != null && !v.mult.weak)
function engagementOf(ctx: EngineCtx, ch: Ch, fmtId: Fmt) {
  const a = vids(ctx, ch).filter(v => v.tracked && v.fmt === fmtId && v.ageDays <= 90 && v.views != null && v.views > 0 && v.likes != null).map(v => (v.likes + v.comments) / v.views!)
  const m = median(a)
  return { median: m, n: a.length, window: '90 dias', label: a.length ? ctx.fmt.dec1(m! * 100) + '% (n = ' + a.length + ')' : 'sem vídeos com contagem' }
}

export function syncText(ctx: EngineCtx, ch: ObsChannel): string {
  const s = ch.sync, { clock } = ctx
  if (s.state === 'backfill') return (s.added != null ? 'adicionado ' + clock.ago(s.added) + ' — ' : '') + (s.backfill ? s.backfill.done + ' de ' + s.backfill.total : 'alguns') + ' vídeos buscados'
  if (s.last == null) return (s.state === 'erro' ? 'erro — ' : s.state === 'atrasado' ? 'atrasado — ' : '') + NEVER_SYNCED + (s.state === 'erro' && s.msg ? ' — ' + s.msg : '')
  if (s.state === 'erro') return 'sem sincronização desde ' + clock.dm(s.last) + ' ' + clock.hm(s.last) + ' — ' + s.msg
  if (s.state === 'atrasado') return 'atrasado: última sincronização ' + clock.dm(s.last) + ' ' + clock.hm(s.last) + ' (' + clock.agoHours(s.last) + ')'
  return 'sincronizado ' + clock.ago(s.last)
}

export function channelStats(ctx: EngineCtx, channelId: string, fmtId: Fmt = 'long'): Record<string, unknown> {
  const { clock } = ctx
  const ch = ctx.CH.get(channelId)!
  const vp = vids(ctx, ch).filter(v => v.tracked && v.fmt === fmtId && v.vpd != null).map(v => v.vpd as number)
  const outs = outliers(ctx, { niche: 'todos', fmt: fmtId, ages: DEFAULT_AGES, channel: channelId, includeOwn: ch.own })
  const now = ch.snapshots.length ? ch.snapshots[ch.snapshots.length - 1]! : null, prev = now ? snapAt(ch, now.t - 30 * DAY) : null
  const growth: { abs: number | null; pct: number | null; from?: number; to?: number; pending?: string } = (now && prev && now.t - prev.t >= 29 * DAY)
    ? { abs: now.subs - prev.subs, pct: (now.subs - prev.subs) / prev.subs, from: prev.t, to: now.t }
    : { abs: null, pct: null, pending: now ? 'faltam ' + Math.ceil(30 - (now.t - ch.snapshots[0]!.t) / DAY) + ' d (primeira contagem ' + clock.dm(ch.snapshots[0]!.t) + ')' : 'sem contagem' }
  const mults = strong90(ctx, ch, fmtId).map(v => v.mult!.value as number)
  const vpdMedian = median(vp)
  const s90 = strong90(ctx, ch, fmtId)
  return {
    channel: channelId, fmt: fmtId,
    vpdMedian, vpdN: vp.length, vpdWindow: 'desde ' + clock.dm(ctx.ds.seriesStart),
    perMilSubs: vpdMedian != null ? vpdMedian / (ch.subs / 1000) : null,
    typicalMult: median(mults), typicalMultN: mults.length,
    bestOutlier: outs.items[0] || null, outliers90: outs.count,
    changes30: changesIn(ctx, { days: 30, channel: channelId }).length,
    growth30: Object.assign(growth, roundingOf(ctx, ch, growth)),
    maxMultBelowMin: maxBelow(ctx, ch, fmtId),
    pctOutliers: s90.length ? s90.filter(v => v.mult!.value! >= RULES.outlierMin).length / s90.length : null, pctOutliersN: s90.length,
    vpd7Median: median7(ctx, channelId, fmtId),
    engagement: engagementOf(ctx, ch, fmtId),
    tracked: ch.videos.filter(v => v.tracked).length, total: ch.videos.length, video_limit: ch.video_limit,
    syncText: syncText(ctx, ch),
  }
}

export function channelSlots(ctx: EngineCtx, limit: number): { used: number; limit: number; free: number } {
  const used = ctx.ds.channels.filter(c => !c.own).length
  return { used, limit, free: Math.max(0, limit - used) }
}

/** @internal mockup parity only; product uses syncResultToast */
export function runSyncText(ok: string[], problems: Array<{ id: string; label: string }>, outOfRound: Array<{ id: string; label: string }>, names: (id: string) => string): string {
  return (ok.length ? ok.length + ' ' + (ok.length === 1 ? 'canal sincronizado agora' : 'canais sincronizados agora') : 'nenhum canal sincronizado')
    + (problems.length ? '; ' + problems.length + ' com problema' : '')
    + (outOfRound.length ? '; fora da rodada: ' + outOfRound.map(p => names(p.id) + ' (' + p.label + ')').join(', ') : '')
}

export interface SyncRun { ok: string[]; problems: Array<{ id: string; label: string }>; outOfRound: Array<{ id: string; label: string }> }
export interface SyncToast { kind: 'ok' | 'warn'; title: string; body: string; more: string; text: string }
/** Channel lookup for the sync result: a name, or the name and niche (problems are listed Viagem before IA). */
export type SyncLookup = (id: string) => string | { name: string; niche: string | null } | undefined
const NICHE_ORDER = ['viagem', 'ia']

/**
 * Product text of "Sincronizar concorrentes" (ruling R40; CHROME 2.2 M3, spec 2.2). Never a fabricated success.
 * text = "11 de 13 canais sincronizados agora; 2 com problema · Fora da rodada: Vou sem volta (buscando vídeos)".
 * The body lists the problems Viagem before IA (the mockup's list()).
 */
export function syncResultToast(run: SyncRun, lookup: SyncLookup): SyncToast {
  const info = (id: string) => { const x = lookup(id); return typeof x === 'string' ? { name: x, niche: null } : x ?? { name: id, niche: null } }
  const ok = run.ok.length, p = run.problems.length, total = ok + p
  const out = run.outOfRound.map(x => `${info(x.id).name} (${x.label})`)
  const moreCore = out.length ? `Fora da rodada: ${out.join('; ')}` : ''
  const canais = (n: number) => (n === 1 ? 'canal sincronizado' : 'canais sincronizados')
  if (ok === 0 && p === 0) {
    return { kind: 'warn', title: 'Nenhum canal sincronizado', body: 'Nenhum concorrente estava pronto para sincronizar.', more: moreCore ? moreCore + '.' : '', text: 'nenhum canal sincronizado' + (moreCore ? ' · ' + moreCore : '') }
  }
  if (p === 0) {
    const head = `${ok} de ${total} ${canais(total)} agora`
    return { kind: 'ok', title: 'Concorrentes sincronizados', body: head + '.', more: moreCore ? moreCore + '.' : '', text: head + (moreCore ? ' · ' + moreCore : '') }
  }
  const head = `${ok} de ${total} ${canais(total)} agora; ${p} com problema`
  const rank = (id: string) => NICHE_ORDER.indexOf(info(id).niche ?? '')
  const sorted = run.problems.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x.id) - rank(b.x.id) || a.i - b.i).map(o => o.x)
  return { kind: 'warn', title: head, body: sorted.map(x => `${info(x.id).name}: ${x.label}`).join('; ') + '.', more: moreCore ? moreCore + '.' : '', text: head + (moreCore ? ' · ' + moreCore : '') }
}
