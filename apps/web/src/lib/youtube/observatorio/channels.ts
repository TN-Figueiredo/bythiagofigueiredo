// Port of dados.js:858-935, 1035-1058, 1966-1985 (+ sync.label at 415): channel stats, cadence, sync labels, problem phrase.
import { computeSlots, type ChannelSlots } from '../competitor-slots-math'
import { RULES, DEFAULT_AGES } from './rules'
import { median } from './stats'
import { inicioDoRitmo, baseDoRitmo, PISO_RITMO_DIAS } from './medidas/ritmo'
import { DAY, H, WD } from './time'
import { changesIn } from './changes'
import { outliers, median7 } from './outliers'
import { assertSiteScope, type EngineCtx, type Derived } from './series'
import type { ChannelSnapshot, Fmt, ObsChannel, ObsVideo, SyncState } from './types'
import { passoDoYouTube, REGRAS_INSCRITOS } from './inscritos-28d'
import { BUILTIN_NICHES, tabOrder } from './niche'

type V = ObsVideo & Derived
type Ch = ObsChannel & { videos: ObsVideo[] }
const p2 = (n: number) => (n < 10 ? '0' : '') + n

export function syncLabel(state: SyncState): 'sincronizado' | 'atrasado' | 'erro' | 'buscando vídeos' {
  return ({ ok: 'sincronizado', atrasado: 'atrasado', erro: 'erro', backfill: 'buscando vídeos' } as const)[state]
}

/** Maps the DB `sync_error` text to the owner-facing reason. Unknown text is returned as is, never hidden. */
export function humanizeSyncError(msg: string): string {
  // o 404 que não conseguiu registrar a falta traz a frase junto: ela não pode ser engolida pelo 404
  if (/YouTube API 404|\b404\b/.test(msg) && msg.includes('a falta não foi registrada')) return 'não encontrado no YouTube (404), e a falta não foi registrada'
  if (/YouTube API 404|\b404\b/.test(msg)) return 'não encontrado no YouTube (404)'
  if (/quotaExceeded|\b403\b/.test(msg)) return 'cota diária da API do YouTube esgotada'
  if (/timeout|aborted/i.test(msg) && !msg.startsWith('não foi possível')) return 'tempo de resposta do YouTube esgotado'
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

export const SEM_MENSAGEM = 'erro sem mensagem registrada'
export const NEVER_SYNCED = 'nunca sincronizado com sucesso'

/** Owner-facing reason for a channel in trouble; null when ok. */
export function problemLabel(ctx: EngineCtx, ch: ObsChannel): string | null {
  const s = ch.sync
  if (s.state === 'erro') return s.msg ? humanizeSyncError(s.msg) : SEM_MENSAGEM
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

/**
 * O texto da base real do ritmo (a tela não pode dizer "13 semanas" quando a base é outra). Sem corte, as 13 semanas da regra.
 * TODO Logan: rótulo final (só texto; marca, cor e desenho esperam o mockup).
 */
export function baseDoRitmoTexto(k: { corte: 'criacao' | 'cobertura' | null; diasBase: number }, semanasDaRegra: number): { media: string; periodo: string } {
  if (k.corte === 'criacao') return { media: `média desde a criação, ${k.diasBase} dias`, periodo: `${k.diasBase} dias, desde a criação` }
  if (k.corte === 'cobertura') return { media: `média dos ${k.diasBase} dias guardados`, periodo: `${k.diasBase} dias guardados` }
  return { media: `média de ${semanasDaRegra} semanas`, periodo: `${semanasDaRegra} semanas` }
}

export function cadence(ctx: EngineCtx, channelId: string, fmtId: Fmt = 'long') {
  const { clock } = ctx, NOW = clock.now
  const ch = ctx.CH.get(channelId)!
  const W = RULES.habit.weeks
  // Mesma regra do ritmo das medidas (parecer Phil 19/10): a janela começa no max(13 semanas, criação, cobertura da lista cortada).
  const lb = baseDoRitmo({
    publicacoesMs: ch.videos.map(v => v.pub), criadoEmMs: ch.createdMs ?? null, guardados: ch.videos.length + ch.undated.length,
    totalNoYoutube: ch.youtubeVideoCount ?? null, limiteDeVideos: ch.video_limit, proprio: ch.own === true,
  })
  const base = inicioDoRitmo({ agoraMs: NOW, semanasDaRegra: W, criadoEmMs: lb.criadoEmMs, coberturaDesdeMs: lb.coberturaDesdeMs })
  const from = NOW - W * 7 * DAY
  const vs = ch.videos.filter(v => v.fmt === fmtId && v.pub > from && v.pub >= base.inicioMs)
  // semana inteira antes do início da base (criação/cobertura) não é "zero publicações": é fora do período (n: null)
  const weeks = Array.from({ length: W }, (_, w) => { const a = from + w * 7 * DAY, b = a + 7 * DAY; return { from: a, to: b, n: b <= base.inicioMs ? null : vs.filter(v => v.pub > a && v.pub <= b).length } })
  // abaixo do piso de dias não há taxa (mesma regra da API: canal_novo / ritmo_parcial)
  const pw = base.dias < PISO_RITMO_DIAS ? null : Math.round(vs.length / base.semanas * 10) / 10
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
    channel: channelId, fmt: fmtId, weeks, pw, n: vs.length,
    // TODO Logan: rótulo final (a tela passa a dizer a base real do período)
    semanas: Math.round(base.semanas * 100) / 100, diasBase: Math.round(base.dias), corte: base.corte, habit, lastUpload: last ? last.pub : null, lastUploadAgo: last ? clock.ago(last.pub) : null,
    partial, fetchedSince,
    partialText: partial ? 'ritmo parcial: só os ' + (ch.sync.backfill ? ch.sync.backfill.done : ch.videos.length) + ' vídeos mais recentes foram buscados' + (fetchedSince != null ? ' (desde ' + clock.dmOrDmy(fetchedSince) + ')' : '') : null,
  }
}

const snapAt = (snaps: readonly ChannelSnapshot[], ms: number) => { let best: ChannelSnapshot | null = null; for (const x of snaps) { if (x.t <= ms) best = x; else break } return best }

export interface Crescimento30 {
  abs: number | null; pct: number | null; from?: number; to?: number; pending?: string
  /** Inscritos nas duas pontas da comparação: a célula e a dica não refazem `snapshots.find`. */
  fromSubs?: number; toSubs?: number
  /** Quantos dias de retrato existem (primeiro → mais novo), para a dica de canal novo. null sem retrato. */
  diasDeRegistro: number | null
  /** Primeiro retrato + 30 dias (ms), quando ainda falta; null fora disso. */
  fechaEm: number | null
  roundingUnit: number; roundingError: number; roundingText: string
  /** |abs| < 2 × passo (passo da maior das duas contagens); abaixo de mil inscritos só o zero exato. null sem contagem ou sem medida. */
  withinRounding: boolean | null
  /** 2 × passo: o "±N" que a tela mostra. 0 abaixo de mil inscritos. */
  limiteArred: number
  uncertainty: number; text: string | null
}

export function crescimento30(deps: Pick<EngineCtx, 'clock' | 'fmt'>, snapshots: readonly ChannelSnapshot[], subs: number | null): Crescimento30 {
  const { clock, fmt } = deps
  const now = snapshots.length ? snapshots[snapshots.length - 1]! : null
  const first = snapshots.length ? snapshots[0]! : null
  const prev = now ? snapAt(snapshots, now.t - 30 * DAY) : null
  // Phil I3: "em 30 dias" não pode ser 31 a 90. Só mede com 29 <= dias <= 33; fora disso é buraco na coleta, fora da numeração.
  const dias = now && prev ? (now.t - prev.t) / DAY : null
  const medido = dias != null && dias >= 29 && dias <= 33
  const buraco = dias != null && dias > 33
  const growth: { abs: number | null; pct: number | null; from?: number; to?: number; fromSubs?: number; toSubs?: number; pending?: string } = medido
    ? { abs: now!.subs - prev!.subs, pct: prev!.subs > 0 ? (now!.subs - prev!.subs) / prev!.subs : null, from: prev!.t, to: now!.t, fromSubs: prev!.subs, toSubs: now!.subs }
    : { abs: null, pct: null, pending: buraco ? 'buraco na contagem (última comparação de ' + Math.round(dias!) + ' d)' : now ? 'faltam ' + Math.ceil(30 - (now.t - first!.t) / DAY) + ' d (primeira contagem ' + clock.dm(first!.t) + ')' : 'sem contagem' }
  const diasDeRegistro = now && first ? Math.floor((now.t - first.t) / DAY) : null
  const fechaEm = !medido && !buraco && first ? first.t + 30 * DAY : null
  // Phil M1: o passo sai da maior das duas contagens comparadas (como inscritos-28d.ts); `subs` só decide "oculto".
  const base = medido ? Math.max(prev!.subs, now!.subs) : subs
  return { ...growth, diasDeRegistro, fechaEm, ...roundingOf(fmt, subs, base, growth.abs) }
}

function roundingOf(fmt: EngineCtx['fmt'], subs: number | null, base: number | null, abs: number | null) {
  // subs null = o YouTube esconde a contagem: nada a arredondar, nada a comparar.
  if (subs == null) return { roundingUnit: 1, roundingError: 0, roundingText: 'sem contagem', withinRounding: null as boolean | null, limiteArred: 0, uncertainty: 0, text: null as string | null }
  const b = base ?? subs
  const unit = b < 1000 ? 1 : Math.pow(10, Math.floor(Math.log10(b)) - 2)
  const err = b < 1000 ? 0 : unit / 2
  // A5 2ª leva, D1: a mesma regra da seção Inscritos: menos de 2 passos pode ser só arredondamento
  const limite = REGRAS_INSCRITOS.multiploDoPasso * passoDoYouTube(b)
  // I1: abaixo de mil não há arredondamento (limite 0); o zero exato continua "sem variação", senão a célula escreveria "−0,0%".
  const dentro: boolean | null = abs == null ? null : limite > 0 ? Math.abs(abs) < limite : abs === 0
  return {
    roundingUnit: unit, roundingError: err,
    // D1b (Logan, doc oficial: o YouTube CORTA para baixo): o número real é este ou um pouco maior
    roundingText: err ? 'o número real é este ou um pouco maior, em menos de ' + fmt.num(unit) : 'exato',
    withinRounding: dentro, limiteArred: limite, uncertainty: b < 1000 ? 0 : unit,
    text: abs == null ? null : dentro ? (limite > 0 ? '≈ 0 (dentro do arredondamento do YouTube, ±' + fmt.num(limite) + ')' : '0 (mesmo número nas duas contagens)')
      : (abs > 0 ? '+' : '') + fmt.num(abs) + (unit > 1 ? ' (±' + fmt.num(unit) + ')' : ''),
  }
}
function maxBelow(ctx: EngineCtx, ch: Ch, fmtId: Fmt) {
  const cand = vids(ctx, ch).filter(v => v.tracked && v.fmt === fmtId && v.ageDays <= 90 && v.mult && v.mult.value != null && v.mult.value < RULES.outlierMin)
    .sort((a, b) => b.mult!.value! - a.mult!.value!)[0]
  return cand ? { id: cand.id, value: cand.mult!.value, n: cand.mult!.n, weak: cand.mult!.weak, label: ctx.fmt.mult(cand.mult!.value) + ' a mediana' } : null
}
const strong90 = (ctx: EngineCtx, ch: Ch, fmtId: Fmt) => vids(ctx, ch).filter(v => v.tracked && v.fmt === fmtId && v.ageDays <= 90 && v.mult && v.mult.value != null && !v.mult.weak)
function engagementOf(ctx: EngineCtx, ch: Ch, fmtId: Fmt) {
  const a = vids(ctx, ch).filter(v => v.tracked && v.fmt === fmtId && v.ageDays <= 90 && v.views != null && v.views > 0 && v.likes != null && v.comments != null).map(v => (v.likes! + v.comments!) / v.views!)
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

export function channelStats(ctx: EngineCtx, channelId: string, fmtId: Fmt = 'long') {
  const { clock } = ctx
  const ch = ctx.CH.get(channelId)!
  const vp = vids(ctx, ch).filter(v => v.tracked && v.fmt === fmtId && v.vpd != null).map(v => v.vpd as number)
  const outs = outliers(ctx, { niche: 'todos', fmt: fmtId, ages: DEFAULT_AGES, channel: channelId, includeOwn: ch.own })
  const mults = strong90(ctx, ch, fmtId).map(v => v.mult!.value as number)
  const vpdMedian = median(vp)
  const s90 = strong90(ctx, ch, fmtId)
  return {
    channel: channelId, fmt: fmtId,
    vpdMedian, vpdN: vp.length, vpdWindow: 'desde ' + clock.dm(ctx.ds.seriesStart),
    perMilSubs: vpdMedian != null && ch.subs != null && ch.subs > 0 ? vpdMedian / (ch.subs / 1000) : null,
    typicalMult: median(mults), typicalMultN: mults.length,
    bestOutlier: outs.items[0] || null, outliers90: outs.count,
    changes30: changesIn(ctx, { days: 30, channel: channelId }).length,
    growth30: crescimento30(ctx, ch.snapshots, ch.subs),
    maxMultBelowMin: maxBelow(ctx, ch, fmtId),
    pctOutliers: s90.length ? s90.filter(v => v.mult!.value! >= RULES.outlierMin).length / s90.length : null, pctOutliersN: s90.length,
    vpd7Median: median7(ctx, channelId, fmtId),
    engagement: engagementOf(ctx, ch, fmtId),
    tracked: ch.videos.filter(v => v.tracked).length, total: ch.videos.length, video_limit: ch.video_limit,
    syncText: syncText(ctx, ch),
  }
}

/** The shape channelStats() returns: single source for the view-models and insights. */
export type ChannelStats = ReturnType<typeof channelStats>

/** Competitors only (the own channel never takes a slot); the formula is computeSlots, shared with the actions. */
export function channelSlots(ctx: EngineCtx, limit: number): ChannelSlots {
  assertSiteScope(ctx, 'channelSlots')
  return computeSlots(ctx.ds.channels.filter(c => !c.own).length, limit)
}

/** @internal mockup parity only; product uses syncResultToast */
export function runSyncText(ok: string[], problems: Array<{ id: string; label: string }>, outOfRound: Array<{ id: string; label: string }>, names: (id: string) => string): string {
  return (ok.length ? ok.length + ' ' + (ok.length === 1 ? 'canal sincronizado agora' : 'canais sincronizados agora') : 'nenhum canal sincronizado')
    + (problems.length ? '; ' + problems.length + ' com problema' : '')
    + (outOfRound.length ? '; fora da rodada: ' + outOfRound.map(p => names(p.id) + ' (' + p.label + ')').join(', ') : '')
}

export interface SyncRun { ok: string[]; problems: Array<{ id: string; label: string }>; outOfRound: Array<{ id: string; label: string }> }
export interface SyncToast { kind: 'ok' | 'warn'; title: string; body: string; more: string; text: string }
/** Channel lookup for the sync result: a name, or the name and niche (problems are listed in the niche tab order: Viagem before IA). */
export type SyncLookup = (id: string) => string | { name: string; niche: string | null } | undefined
const NICHE_ORDER: readonly string[] = tabOrder(BUILTIN_NICHES)

/**
 * Product text of "Sincronizar concorrentes" (ruling R40; CHROME 2.2 M3, spec 2.2). Never a fabricated success.
 * text = "11 de 13 canais sincronizados agora; 2 com problema · Fora da rodada: Vou sem volta (buscando vídeos)".
 * The body lists the problems Viagem before IA (the mockup's list()).
 */
export function syncResultToast(run: SyncRun, lookup: SyncLookup, order: readonly string[] = NICHE_ORDER): SyncToast {
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
  const rank = (id: string) => order.indexOf(info(id).niche ?? '')
  const sorted = run.problems.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x.id) - rank(b.x.id) || a.i - b.i).map(o => o.x)
  return { kind: 'warn', title: head, body: sorted.map(x => `${info(x.id).name}: ${x.label}`).join('; ') + '.', more: moreCore ? moreCore + '.' : '', text: head + (moreCore ? ' · ' + moreCore : '') }
}
