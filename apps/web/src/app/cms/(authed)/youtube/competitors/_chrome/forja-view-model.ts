/**
 * The forja in the Observatório (Task 35): ONE view model for the header segment, the buttons, the per-screen cards and
 * the drawer (ports of chrome.js forjaHtml/forjaFromScenario, moldura-forja.html drawer/runCard and the forja cards of
 * canais/mudancas/outliers/insights/historico-video). Pure: requests come from obs.forja.session (DB rows in production),
 * texts from the engine (statusLabel/statusLines/statusText, quota, since, preview, timing). Nothing reads the clock.
 *
 * "Falha em verde" (CLAUDE.md): every branch answers "what if the data does not exist?" — no heartbeat row, no
 * capability, no reading, a reading without items, a frozen `sent` missing — with its own honest text.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { NicheScope } from '@/lib/youtube/observatorio/niche'
import type { Fmt, ForjaRequest, FrozenReading, Niche } from '@/lib/youtube/observatorio/types'
import type { Scenario } from '@/lib/youtube/observatorio/forja/states'
import type { ObsType } from '@/lib/pipeline/services/forja-queue'
import { ACTIVE_STATES } from '@/lib/youtube/observatorio/forja/states'
import { NOT_ANNOUNCED } from '@/lib/youtube/observatorio/forja/session'

export type { ObsType }
export type ForjaScreen = 'canais' | 'mudancas' | 'outliers' | 'insights' | 'historico'
export const INCAPABLE_TEXT = NOT_ANNOUNCED
/** CONVENCOES F9: the type each screen asks. */
export function screenType(screen: ForjaScreen, fmt?: Fmt | null): ObsType {
  if (screen === 'canais' || screen === 'mudancas') return 'resumo-trocas'
  if (screen === 'historico') return 'leitura-video'
  return fmt === 'short' ? 'padroes-titulo-shorts' : 'padroes-titulo'
}

export interface ForjaReadingView {
  id: string; niche: Niche | null; nicheLabel: string
  /** "forja · Gemma 12B · fórmulas, 6 meses · 20/10 06:10 (SP)": the model comes from the reading (R49). */
  seal: string
  /** LITERAL reading text: the only text under the seal. */
  title: string; lead: string; items: string[]; theme: string | null
  /** The literal items split for the collapsed hero: the ones whose pattern passes the rule, then the rest. */
  keyItems: string[]; moreItems: string[]
  /** "Do site" (outside the seal). */
  sentText: string
  since: { shortText: string; text: string } | null
  siteNotes: string[]
  /** "Ver os N vídeos com a fórmula (hoje, nos 6 canais da leitura)"; `text` = what the reading saw (site sentence). */
  evidenceLinks: Array<{ label: string; href: string; n: number; text: string }>
  when: string; isNew: boolean
  /** "Fórmulas (6 meses, 20/10)" — the label of this reading's "Desde então" line. */
  sinceLabel: string
  /** "7 trocas" — what the reading read (resumo das trocas); null when the frozen data does not say. */
  countText: string | null
  /**
   * Resumo das trocas: the literal items carry their "Ver as N trocas" inline ONLY when the item count is exactly
   * groups + (reverts ? 1 : 0); otherwise the links are listed in "Do site" by the group's verdict (never mis-paired).
   */
  inlineEvidence: boolean
}
export interface ForjaNicheBlock {
  niche: Niche; label: string; reading: ForjaReadingView | null
  /** Honest sentence when there is no reading of this type for the niche. */
  emptyText: string | null
  /** "IA: na fila · pedido 14:58" when the niche has a request. */
  statusLine: string | null; active: boolean
  /** "Paddy Doyle fica fora: sem sincronização há 39 h". */
  out: string[]
}
export interface ForjaStatus {
  text: string; active: boolean; terminal: boolean; warn: boolean; lines: string[]; statusText: string
  /** Finished lines of the other niche(s) while one is active (secondary pills, chrome.js forjaFromScenario). */
  secondary: string[]
}
export interface ForjaButton { mode: 'free' | 'busy' | 'free-niche' | 'disabled'; label: string; short?: string; ariaLabel: string; disabledText?: string }
export interface ForjaView {
  ready: boolean
  capable: boolean
  incapableText: typeof INCAPABLE_TEXT | null
  variant: 'solid' | 'outline' | 'none'
  /** The chrome header's own variant: Histórico keeps the button in the screen (mockup forjaVariant 'none'). */
  headerVariant: 'solid' | 'outline' | 'none'
  /**
   * What the header button does (R58, the binding mockups): Insights, Canais and Outliers ASK directly for the screen's
   * type and niche; Mudanças opens its inline preview + "Confirmar pedido"; Histórico has no header button. The selector
   * drawer is the moldura's registered exception (CONVENCOES:225): 'drawer' only where the moldura opens it.
   */
  headerAction: 'ask' | 'confirm' | 'drawer' | 'none'
  button: ForjaButton
  status: ForjaStatus | null
  machine: { alive: boolean; text: string; time: string | null; title: string }
  reading: ForjaReadingView | null
  /* ---- context the cards and actions need */
  screen: ForjaScreen; type: ObsType; typeLabel: string; niche: NicheScope; videoId: string | null; fmt: Fmt | null
  niches: ForjaNicheBlock[]
  /** What a click on the button sends: the scope and the niches the engine would accept (click order). */
  ask: { scope: NicheScope; niches: Niche[] } | null
  /** Niches whose request is still waiting (a running one belongs to the machine). */
  cancel: Niche[]
  card: {
    /** Chip of the request state ("na fila", "em andamento"); null without a request. */
    stateLabel: string | null; stateKind: 'ok' | 'warn' | 'bad' | 'run' | null
    statusText: string | null; lines: string[]
    /** "Pedido de IA enviado agora." — a request created in the last minute. */
    sentNow: string | null
    /** Only with the quota used and nothing in progress. */
    quotaNote: string | null
    previewText: string
  }
  blockedBy: { reason: string; href: string; title: string } | null
}

const MIN = 6e4
const WARN_STATES = ['atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia']
const DEAD = ['falhou', 'recusado (dado velho)']
const isActiveQ = (q: Pick<ForjaRequest, 'state'>) => (ACTIVE_STATES as readonly string[]).includes(q.state)
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const period = (t: string) => { const s = t.trim(); return !s || /[.!?]$/.test(s) ? s : s + '.' }
const NL: Record<Niche, string> = { viagem: 'Viagem', ia: 'IA' }
const nicheLabel = (n: NicheScope) => (n === 'todos' ? 'Todos' : NL[n])
const joinE = (xs: string[]) => xs.join(' e ')
/** Seal kind per type (insights.html sealShort: "fórmulas", "temas"). */
const SEAL_KIND: Record<string, string> = {
  'padroes-titulo': 'fórmulas', 'padroes-titulo-shorts': 'fórmulas dos Shorts', 'temas': 'temas', 'resumo-trocas': 'trocas', 'leitura-video': 'vídeo',
}
const windowLabel = (d: number | null | undefined) => d == null ? null : d >= 180 ? Math.round(d / 30) + ' meses' : d + ' dias'

/** Model of a reading: the DB column, else the reading's own seal ("forja · <model> · …"); never assumed (R49). */
export function readingModel(r: Pick<FrozenReading, 'model' | 'seal'>): string {
  const fromSeal = r.seal && r.seal.startsWith('forja · ') ? r.seal.split(' · ')[1] : undefined
  return r.model || fromSeal || 'modelo não registrado'
}
export function readingSeal(obs: Observatory, r: FrozenReading): string {
  const t = obs.forja.readingTypes.find(x => x.id === r.type)
  const days = r.base?.windowDays ?? (typeof r.sent.windowDays === 'number' ? r.sent.windowDays : null) ?? t?.windowDays ?? null
  const win = r.type === 'leitura-video' ? null : windowLabel(days)
  return 'forja · ' + readingModel(r) + ' · ' + (SEAL_KIND[r.type] ?? r.type) + (win ? ', ' + win : '') + ' · ' + obs.date.dm(r.generatedAt) + ' ' + obs.date.hm(r.generatedAt) + ' (SP)'
}

/* ------------------------------------------------------------------ frozen analysis (jsonb, narrowed) */
export interface PatternLite { formula: string; nUse: number; verdict: { id: string; text: string }; evidence: string[]; attribution: string | null; diff: number | null }
interface GroupLite { changeIds: string[]; verdict: { text: string } }
const isRec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])
export function patternsOf(r: FrozenReading): PatternLite[] {
  const ps = Array.isArray(r.analysis.patterns) ? (r.analysis.patterns as unknown[]) : []
  return ps.filter(isRec).filter(p => typeof p.formula === 'string' && isRec(p.verdict) && typeof p.verdict.id === 'string')
    .map(p => ({ formula: p.formula as string, nUse: typeof p.nUse === 'number' ? p.nUse : 0, evidence: strs(p.evidence),
      attribution: isRec(p.attribution) && typeof p.attribution.text === 'string' ? p.attribution.text : null, diff: typeof p.diff === 'number' ? p.diff : null, verdict: { id: (p.verdict as Record<string, unknown>).id as string, text: String((p.verdict as Record<string, unknown>).text ?? '') } }))
}
function groupsOf(r: FrozenReading): GroupLite[] {
  const gs = Array.isArray(r.analysis.groups) ? (r.analysis.groups as unknown[]) : []
  return gs.filter(isRec).map(g => ({ changeIds: strs(g.changeIds), verdict: { text: isRec(g.verdict) ? String(g.verdict.text ?? '') : '' } })).filter(g => g.changeIds.length)
}

/* ------------------------------------------------------------------ evidence links */
const verOut = (n: number) => (n === 1 ? 'Ver o outlier' : 'Ver os ' + n + ' outliers')
const verTrocas = (n: number) => (n === 1 ? 'Ver a troca' : 'Ver as ' + n + ' trocas')
/** insights.html evLink: reading=<id> plus the reading's own scope (channels, window, asof); N = what Outliers shows. */
export function evLink(obs: Observatory, r: FrozenReading, params: { min: number; formula?: string; theme?: string }): { href: string; n: number; nCh: number } | null {
  const S = obs.forja.readingScope(r.id)
  if (!S) return null
  const q = { reading: r.id, ...params }
  const n = obs.outliers(q).count
  const ages = (S.ages ?? []).filter(id => { const w = obs.OUT_WINDOWS.find(x => x.id === id); return !!w && S.windowDays != null && w.hi <= S.windowDays })
  // a content theme travels as topic= (theme= is the colour scheme, CONVENCOES F4)
  const { theme, ...rest } = q
  const href = obs.link.outliers({ ...(S.niche ? { niche: S.niche } : {}), ...(S.fmt ? { fmt: S.fmt } : {}), ages, ...rest, ...(theme ? { topic: theme } : {}) })
  return { href, n, nCh: S.channels.length }
}
/** insights.html buildReading `best`: the patterns that pass the rule; none → the one with the largest difference (used). */
export function bestPatterns(r: FrozenReading): PatternLite[] {
  const pats = patternsOf(r), pass = pats.filter(p => p.verdict.id === 'padrao')
  if (pass.length) return pass
  const top = pats.filter(p => p.diff != null && p.nUse > 0).sort((a, b) => b.diff! - a.diff!)[0]
  return top ? [top] : []
}
function evidenceOf(obs: Observatory, r: FrozenReading): ForjaReadingView['evidenceLinks'] {
  const out: ForjaReadingView['evidenceLinks'] = []
  if (r.type === 'resumo-trocas') {
    for (const g of groupsOf(r)) out.push({ label: verTrocas(g.changeIds.length), href: obs.link.mudancas({ changes: g.changeIds }), n: g.changeIds.length, text: g.verdict.text })
    const rv = strs(r.analysis.reverts)
    if (rv.length) out.push({ label: verTrocas(rv.length), href: obs.link.mudancas({ changes: rv }), n: rv.length, text: 'Trocas que voltaram à versão anterior' })
    return out
  }
  if (r.type === 'leitura-video') return out
  const scope = (nCh: number) => ' (hoje, nos ' + nCh + ' canais da leitura)'
  for (const p of bestPatterns(r)) {
    const lk = evLink(obs, r, { min: 0, formula: p.formula })
    if (lk) out.push({ label: obs.fmt.verVideos(lk.n) + ' com a fórmula' + scope(lk.nCh), href: lk.href, n: lk.n, text: p.verdict.text + '; a leitura viu ' + obs.fmt.plural(p.nUse, 'vídeo', 'vídeos') + ' com a fórmula.' })
  }
  const base = evLink(obs, r, { min: obs.RULES.outlierMin })
  const nThen = typeof r.analysis.nOutliers === 'number' ? r.analysis.nOutliers : null
  if (base) out.push({ label: verOut(base.n) + scope(base.nCh), href: base.href, n: base.n, text: (r.sent.text ? cap(r.sent.text) : 'Dados enviados à forja não registrados') + (nThen != null ? '; a leitura viu ' + obs.fmt.plural(nThen, 'outlier', 'outliers') + '.' : '.') })
  return out
}

/* ------------------------------------------------------------------ readings */
function videoReading(obs: Observatory, videoId: string): FrozenReading | null {
  return obs.forja.readings.filter(r => r.type === 'leitura-video' && r.target?.video === videoId).sort((a, b) => b.generatedAt - a.generatedAt)[0] ?? null
}
export function forjaReadingView(obs: Observatory, r: FrozenReading, o: { active: boolean; isNew: boolean; activeNote: string | null }): ForjaReadingView {
  // since() says it when the reading cites data that no longer exists (engine `gone`), never throws
  const s = obs.forja.since(r.id)
  const items = [...r.text.items]
  const siteNotes: string[] = []
  // a reading without items says so; temas readings carry only the lead and the theme by design
  if (!items.length && !r.text.lead) siteNotes.push('A leitura chegou sem texto: a forja não escreveu nada que o validador aceitasse.')
  else if (!items.length && r.type !== 'temas') siteNotes.push('Esta leitura não trouxe itens; só o resumo acima.')
  // a formula that passes the rule with fewer than 3 outliers behind it says little about what breaks out (insights.html)
  for (const p of patternsOf(r)) if (p.verdict.id === 'padrao' && p.evidence.length < 3) {
    const lbl = obs.formula(p.formula)?.label ?? p.formula
    siteNotes.push('Sobre ' + obs.fmt.lcfirst(lbl) + ': a diferença passa a regra, mas com ' + (p.evidence.length === 1 ? 'um só outlier' : p.evidence.length === 0 ? 'nenhum outlier' : p.evidence.length + ' outliers') + ' por trás ela diz pouco sobre o que estoura.')
  }
  if (o.activeNote) siteNotes.push(o.activeNote)
  const t = obs.forja.readingTypes.find(x => x.id === r.type)
  // items[i] is the sentence of patterns[i] (the forja writes one item per formula, in the analysis order)
  const pats = patternsOf(r), pass = (i: number) => pats[i]?.verdict.id === 'padrao'
  const outlierType = r.type.startsWith('padroes')
  const days = r.base?.windowDays ?? (typeof r.sent.windowDays === 'number' ? r.sent.windowDays : null) ?? t?.windowDays ?? null
  const kind = r.type === 'temas' ? 'Temas' : outlierType ? 'Fórmulas' : 'Leitura'
  return {
    id: r.id, niche: r.niche, nicheLabel: r.niche ? NL[r.niche] : '—',
    seal: readingSeal(obs, r),
    title: r.text.title || (t ? t.label : r.type) + (r.niche ? ' — ' + NL[r.niche] : ''),
    lead: r.text.lead, items, theme: r.text.theme ?? null,
    keyItems: outlierType ? items.filter((_, i) => pass(i)) : items, moreItems: outlierType ? items.filter((_, i) => !pass(i)) : [],
    inlineEvidence: r.type === 'resumo-trocas' && items.length === groupsOf(r).length + (strs(r.analysis.reverts).length ? 1 : 0),
    countText: typeof r.sent.nChanges === 'number' ? obs.fmt.plural(r.sent.nChanges, 'troca', 'trocas') : null,
    sinceLabel: kind + ' (' + (windowLabel(r.type === 'leitura-video' ? null : days) ? windowLabel(days) + ', ' : '') + obs.date.dm(r.generatedAt) + ')',
    // the frozen data sent with the reading; missing on an old row → said, never invented
    sentText: r.sent.text ? cap(r.sent.text).replace(/\.$/, '') + '.' : 'Os dados enviados à forja não ficaram registrados com esta leitura.',
    // "Desde então" on its own line, capitalised, no final period (CONVENCOES F11 conjunto, ruling 20b)
    since: s ? { shortText: cap(s.shortText).replace(/\.$/, ''), text: o.active ? s.textNoAsk : s.text } : null,
    siteNotes,
    evidenceLinks: evidenceOf(obs, r),
    when: obs.date.dm(r.generatedAt) + ' ' + obs.date.hm(r.generatedAt), isNew: o.isNew,
  }
}

/* ------------------------------------------------------------------ the scenario of a screen */
function scenarioOf(obs: Observatory, type: ObsType, niche: NicheScope, videoId: string | null): Scenario {
  return type === 'leitura-video' ? obs.forja.session.current(null, { type, video: videoId }) : obs.forja.session.current(niche, { type })
}
const hasReq = (sc: Scenario) => !sc.empty && sc.requests.length > 0

/** chrome.js forjaFromScenario: the header follows the active request; never a terminal pill while one is active. */
export function statusOf(sc: Scenario): ForjaStatus | null {
  if (!hasReq(sc)) return null
  const reqs = sc.requests, lines = sc.statusLines ?? []
  if (sc.statusLines && reqs.length > 1) {
    const ai = reqs.findIndex(isActiveQ)
    if (sc.anyActive && ai >= 0) return { text: sc.statusLines[ai] ?? sc.statusLabel ?? '', active: true, terminal: false, warn: WARN_STATES.includes(reqs[ai]!.state), lines, statusText: sc.statusText, secondary: sc.statusLines.filter((_, i) => i !== ai && !isActiveQ(reqs[i]!)) }
    return { text: sc.statusLines.join(' · '), active: false, terminal: sc.terminal, warn: reqs.some(x => DEAD.includes(x.state)), lines, statusText: sc.statusText, secondary: [] }
  }
  const r = sc.request!
  return { text: sc.statusLabel ?? r.state, active: sc.anyActive, terminal: sc.terminal, warn: WARN_STATES.includes(r.state) || DEAD.includes(r.state), lines, statusText: sc.statusText, secondary: [] }
}

export function machineView(obs: Observatory, sc: Scenario): ForjaView['machine'] {
  const m = sc.machine
  if (m.lastPollAt == null) return { alive: false, text: 'forja sem máquina · nenhuma consulta registrada', time: null, title: m.text }
  const t = obs.date.hm(m.lastPollAt)
  return m.alive ? { alive: true, text: 'forja consultou às ' + t, time: t, title: m.text } : { alive: false, text: 'forja sem máquina · ' + t, time: t, title: m.text }
}

export interface ForjaViewOpts { screen: ForjaScreen; type?: ObsType; niche: NicheScope; videoId?: string | null; fmt?: Fmt | null }

export function buildForjaView(obs: Observatory, o: ForjaViewOpts): ForjaView {
  const type: ObsType = o.type ?? screenType(o.screen, o.fmt)
  const isVid = type === 'leitura-video'
  const videoId = isVid ? o.videoId ?? null : null
  const video = videoId ? obs.video(videoId) : undefined
  const scopeNiche: NicheScope = isVid ? (video?.niche ?? o.niche) : o.niche
  const scopeNiches: Niche[] = isVid ? (video?.niche ? [video.niche] : []) : scopeNiche === 'todos' ? ['ia', 'viagem'] : [scopeNiche]
  const capabilities = obs.forja.queue.capabilities
  const capable = capabilities.includes(type)
  const sc = scenarioOf(obs, type, scopeNiche, videoId)
  const status = statusOf(sc)
  const typeLabel = obs.forja.readingTypes.find(t => t.id === type)?.label ?? type
  const reqOf = (n: Niche) => (hasReq(sc) ? sc.requests.find(q => q.niche === n) ?? null : null)

  // free niche = the same rule as session.ask: no active request of this type and the quota free (failure/refusal don't count)
  const quotaFree = (n: Niche) => {
    const q = reqOf(n)
    if (q) return DEAD.includes(q.state)
    return isVid ? obs.forja.quotaFor(type, n).free : true
  }
  const busy = scopeNiches.filter(n => { const q = reqOf(n); return !!q && isActiveQ(q) })
  const free = scopeNiches.filter(n => !busy.includes(n) && quotaFree(n))

  // readings per niche (a published request's own reading first)
  const NOW = obs.NOW
  const niches: ForjaNicheBlock[] = scopeNiches.map(n => {
    const q = reqOf(n)
    const fresh = q && q.state === 'publicado' && q.readingId ? obs.forja.byId[q.readingId] ?? null : null
    const r = fresh ?? (isVid ? (videoId ? videoReading(obs, videoId) : null) : obs.forja.latest(type, n))
    const active = !!q && isActiveQ(q)
    const isNew = !!r && !!q && q.state === 'publicado' && (fresh != null || r.generatedAt >= q.createdAt)
    const line = sc.statusLines?.find(l => l.startsWith(NL[n] + ': ')) ?? (q ? q.statusLabel ?? q.state : null)
    return {
      niche: n, label: NL[n], active, statusLine: q ? line : null,
      reading: r ? forjaReadingView(obs, r, { active, isNew, activeNote: active ? (isVid ? 'O pedido de leitura deste vídeo em andamento vai trazer uma leitura nova.' : 'O pedido de ' + NL[n] + ' em andamento vai trazer uma leitura nova.') : null }) : null,
      emptyText: r ? null : isVid ? 'Ainda não há leitura deste vídeo.' : 'Ainda não há leitura de ' + typeLabel.replace(/ \(.*\)$/, '').toLowerCase() + ' de ' + NL[n] + '.',
      out: obs.forja.eligibleChannels(n).out.map(x => x.reason),
    }
  })
  const reading = scopeNiches.length === 1 ? niches[0]!.reading : null
  const hasAny = niches.some(b => b.reading) || hasReq(sc)
  const baseLabel = hasAny ? 'Pedir nova leitura à forja' : 'Pedir leitura à forja'

  // leitura-video: another video of the same niche with an active request blocks the button (spec 2.6)
  const blockedBy = isVid && sc.blockedBy ? { reason: sc.blockedBy.reason, href: obs.link.historico(sc.blockedBy.video), title: sc.blockedBy.title } : null
  const untracked = isVid && video && !video.tracked ? 'Vídeo fora dos acompanhados: não há dados para a forja ler.' : null
  const chOut = isVid && video ? obs.forja.eligibleChannels(video.niche ?? 'todos').out.find(x => x.id === video.ch)?.reason ?? null : null

  let button: ForjaButton
  if (!capable) button = { mode: 'disabled', label: baseLabel, ariaLabel: baseLabel, disabledText: INCAPABLE_TEXT }
  else if (untracked || chOut) button = { mode: 'disabled', label: baseLabel, ariaLabel: baseLabel, disabledText: (untracked ?? chOut)! }
  else if (blockedBy) button = { mode: 'disabled', label: baseLabel, ariaLabel: baseLabel, disabledText: blockedBy.reason }
  else if (scopeNiche === 'todos' && free.length && free.length < scopeNiches.length) {
    // CONVENCOES F10/F11: Todos with a niche busy (or its quota used) keeps the button for the free one
    const fl = joinE(free.map(n => NL[n])), label = 'Pedir leitura de ' + fl + ' à forja'
    button = { mode: 'free-niche', label, short: 'Ler ' + fl, ariaLabel: label }
  } else if (status?.active && !free.length) button = { mode: 'busy', label: 'Pedido em andamento', ariaLabel: 'Pedido em andamento' }
  else if (!free.length) {
    const qt = cap(isVid && !hasReq(sc) ? obs.forja.quotaFor(type, scopeNiches[0]!).text : sc.quota.text)
    button = { mode: 'disabled', label: baseLabel, ariaLabel: baseLabel, disabledText: qt }
  } else button = { mode: 'free', label: baseLabel, ariaLabel: baseLabel }

  const quotaUsed = !free.length && !status?.active && hasReq(sc)
  const r0 = hasReq(sc) ? sc.requests[0]! : null
  const stateLabel = !r0 ? null : sc.requests.length > 1 ? (sc.anyActive ? 'em andamento' : sc.requests.some(q => DEAD.includes(q.state)) ? 'terminou com falha' : 'publicado') : r0.state
  const stateKind: ForjaView['card']['stateKind'] = !r0 ? null
    : sc.requests.some(q => DEAD.includes(q.state)) && !sc.anyActive ? 'bad'
      : sc.requests.some(q => WARN_STATES.includes(q.state)) ? 'warn' : sc.anyActive ? 'run' : 'ok'
  const sent = hasReq(sc) ? sc.requests.filter(q => isActiveQ(q) && q.createdAt >= NOW - MIN && q.createdAt <= NOW).map(q => NL[q.niche]) : []
  const pv = obs.forja.preview(type, scopeNiche, type === 'padroes-titulo-shorts' ? 'short' : o.fmt ?? undefined)
  const headerVariant = o.screen === 'historico' ? 'none' : o.screen === 'insights' ? 'solid' : 'outline'

  return {
    // the forja tables exist after Task 29's migration (the loader throws without them): the chrome guard keys on this
    ready: true, capable, incapableText: capable ? null : INCAPABLE_TEXT,
    variant: o.screen === 'insights' || o.screen === 'historico' ? 'solid' : 'outline', headerVariant,
    headerAction: o.screen === 'historico' ? 'none' : o.screen === 'mudancas' ? 'confirm' : 'ask',
    button, status, machine: machineView(obs, sc), reading,
    screen: o.screen, type, typeLabel, niche: scopeNiche, videoId, fmt: o.fmt ?? null,
    niches,
    ask: capable && free.length && !blockedBy && !untracked && !chOut ? { scope: free.length === scopeNiches.length ? scopeNiche : free[0]!, niches: free } : null,
    cancel: hasReq(sc) ? sc.requests.filter(q => isActiveQ(q) && q.status !== 'running' && q.state !== 'trabalhando').map(q => q.niche) : [],
    card: {
      stateLabel, stateKind, statusText: hasReq(sc) ? sc.statusText : null, lines: sc.statusLines && sc.requests.length > 1 ? sc.statusLines : [],
      sentNow: sent.length ? (sent.length > 1 ? 'Pedidos de ' + joinE(sent) + ' enviados agora.' : (isVid ? 'Pedido de leitura deste vídeo enviado agora.' : 'Pedido de ' + sent[0] + ' enviado agora.')) : null,
      quotaNote: quotaUsed ? period(cap(sc.quota.text)) : null,
      previewText: pv.text,
    },
    blockedBy,
  }
}

/* ================================================================== the drawer (moldura-forja.html) */
const TYPE_COPY: Record<string, { desc: string; entrega: string; naoFaz: string; dados: string }> = {
  'padroes-titulo': { desc: 'Classifica os títulos dos vídeos longos que estouraram em fórmulas nomeadas, com contagem e exemplos.',
    entrega: 'Fórmulas de título com mediana do multiplicador de quem usa vs quem não usa, n dos dois lados, exemplos citados e quem assina. Fórmula com n < {minN} sai como “recorrência observada — pouco para concluir”.',
    naoFaz: 'Não olha thumbnails e não afirma causa.', dados: 'títulos e views da última sincronização' },
  'temas': { desc: 'Nomeia os assuntos dos vídeos que estouraram e diz se algum domina.',
    entrega: 'Temas nomeados, com quantos outliers e canais tocam cada um e exemplos citados.',
    naoFaz: 'Não prevê se o tema vai crescer e não afirma por que ele apareceu.', dados: 'títulos e descrições dos vídeos longos' },
  'resumo-trocas': { desc: 'Agrupa as trocas de título, thumbnail e descrição dos concorrentes.',
    entrega: 'Trocas agrupadas por tipo e canal; as com efeito medido (observado vs esperado, n) separadas das que aguardam os 7 dias.',
    naoFaz: 'Não julga a thumbnail nova (não vê imagens) e não diz que a troca causou a variação.', dados: 'textos antigos e novos e a média de views/dia de cada vídeo trocado' },
  'padroes-titulo-shorts': { desc: 'Classifica os títulos dos Shorts que estouraram em fórmulas nomeadas, com contagem e exemplos.',
    entrega: 'Fórmulas de título dos Shorts com mediana do multiplicador de quem usa vs quem não usa (comparando só Shorts com Shorts), exemplos citados e quem assina. Fórmula com n < {minN} sai como “recorrência observada — pouco para concluir”.',
    naoFaz: 'Não olha thumbnails nem o vídeo, não afirma causa e não mistura Shorts com vídeos longos.', dados: 'títulos e views dos Shorts da última sincronização' },
}
const DRAWER_TYPES = ['padroes-titulo', 'temas', 'resumo-trocas'] as const
const REQ_TYPES: ObsType[] = ['padroes-titulo', 'temas', 'resumo-trocas', 'padroes-titulo-shorts']
const INSIDE = 'lê os dados enviados à forja, o Gemma escreve, o validador confere cada número citado'
const SHORT_TYPE: Record<string, string> = { 'padroes-titulo': 'Padrões de título', 'padroes-titulo-shorts': 'Padrões de título (Shorts)', 'temas': 'Temas', 'resumo-trocas': 'Resumo das trocas', 'leitura-video': 'Leitura de vídeo' }

export interface DrawerCombo {
  type: ObsType; niche: NicheScope
  /** Niche the request really takes (Todos with one niche blocked → the other). */
  effNiche: NicheScope
  blocked: null | { kind: 'active' | 'quota' | 'both'; text: string; pubText: string | null; runType: ObsType | null }
  partial: string | null
  meta: string; warn: string | null; thin: string | null; outCount: number
  /** The meta of an option that is not selected: it also says how many channels stay out. */
  metaUnselected: string
  confirm: { label: string; escopo: string; entrega: string; naoFaz: string; quando: string; limite: string }
}
export interface DrawerOption { id: (typeof DRAWER_TYPES)[number]; label: string; shortsLabel: string | null; desc: string; shortsDesc: string | null }
export interface RunStep { s: 'feito' | 'agora' | 'proximo' | 'pendente' | 'erro' | 'parado'; title: string; time: string; note: string | null }
export interface RunClock { aria: string; ticks: Array<{ left: number; label: string; s: string }>; evs: Array<{ left: number; label: string; cls: string; hi: boolean }>; fill: { from: number; to: number; cls: string } | null; cap: string; stacked: boolean }
export interface RunCard {
  type: ObsType; video: string | null
  kase: 'queued' | 'running' | 'done' | 'doneTodos' | 'late' | 'nomachine' | 'retry' | 'released' | 'failed' | 'refused'
  stateLabel: string; what: string; lines: string[]
  eta: { big: string; text: string; future: boolean; aria: boolean }
  clock: RunClock | null
  tit: string; sub: string; steps: RunStep[]
  cancel: { label: string; niches: Niche[] } | null
  again: { niches: Niche[]; disabledNote: string | null } | null
  goInsights: { label: string; niche: Niche; href: string } | null
  another: boolean
  note: string | null
  /** Which state the card shows (for the run-card data-st). */
  st: string
}
export interface ForjaDrawerView {
  niche: NicheScope
  /** alive: "forja ligada: consultou a fila às 14:55. Consulta a cada 10 min."; dead: the engine's machine text. */
  machine: { alive: boolean; strong: string; time: string | null; tickMinutes: number; nextPoll: string | null }
  options: DrawerOption[]
  combos: Record<string, DrawerCombo>
  quotaScope: string
  runs: RunCard[]
  /** Scope-free niches with at least one askable type (Todos with one niche busy → the seletor starts on the free one). */
  freeNiches: Niche[]
  anyActive: boolean
  insightsHref: string
  /** First type a niche still accepts (the seletor never opens in a quota dead end). */
  defaultType: ObsType
  defaultNiche: NicheScope
  capable: Record<string, boolean>
  incapableText: string
}
export const comboKey = (type: string, niche: NicheScope) => type + '|' + niche

export function buildForjaDrawerView(obs: Observatory, o: { niche: NicheScope; type?: ObsType }): ForjaDrawerView {
  const D = obs.date, F = obs.fmt, Q = obs.forja.queue, NOW = obs.NOW
  const RP = obs.RULES.pattern
  const scen = (type: ObsType, n: NicheScope) => obs.forja.session.current(n, { type })
  const allReqs = (type: ObsType) => { const a = scen(type, 'todos'); return a.empty ? [] : a.requests }
  const blockOf = (n: Niche, type: ObsType): DrawerCombo['blocked'] => {
    const q = allReqs(type).find(x => x.niche === n)
    if (!q || DEAD.includes(q.state)) return null
    if (isActiveQ(q)) return { kind: 'active', text: 'já há um pedido de ' + NL[n] + ' em andamento (' + (q.statusLabel ?? q.state) + ')', pubText: null, runType: type }
    const rel = scen(type, 'todos').quota.releasesAt
    return { kind: 'quota', text: 'cota de hoje usada para ' + NL[n] + (rel ? ' (libera ' + D.weekday(rel) + ', ' + D.dm(rel) + ' às 00:00)' : ''),
      pubText: q.publishedAt ? 'Pedido hoje às ' + D.hm(q.createdAt) + ' e publicado às ' + D.hm(q.publishedAt) + '. ' : null, runType: null }
  }
  const quotaOf = (type: ObsType, n: NicheScope): { blocked: DrawerCombo['blocked']; only: Niche | null; partial: string | null } => {
    if (n !== 'todos') return { blocked: blockOf(n, type), only: null, partial: null }
    const bs = (['ia', 'viagem'] as const).map(x => [x, blockOf(x, type)] as const), bl = bs.filter(x => x[1])
    if (bl.length === 2) return { blocked: { kind: 'both', text: bl.map(x => x[1]!.text).join('; '), pubText: null, runType: null }, only: null, partial: null }
    if (bl.length === 1) { const only: Niche = bl[0]![0] === 'ia' ? 'viagem' : 'ia'; return { blocked: null, only, partial: cap(bl[0]![1]!.text) + '. O pedido vai só para ' + NL[only] + '.' } }
    return { blocked: null, only: null, partial: null }
  }
  const timingFor = (type: string, ns: Niche[]) => {
    const list = ns.length ? ns : ['viagem', 'ia'] as Niche[]
    if (list.length === 1) return obs.forja.timing(type, list[0]!).text
    const order = (['viagem', 'ia'] as const).filter(x => list.includes(x)), t = order.map(x => obs.forja.timing(type, x).text)
    return t.every(x => x === t[0]) ? joinE(order.map(x => NL[x])) + ': ' + t[0] : order.map((x, i) => NL[x] + ': ' + t[i]).join(' · ')
  }
  const lastOf = (type: ObsType, n: NicheScope) => {
    const ns: Niche[] = n === 'todos' ? ['viagem', 'ia'] : [n]
    const one = (x: Niche) => { const pr = allReqs(type).find(q => q.state === 'publicado' && q.niche === x); const at = pr?.publishedAt ?? obs.forja.latest(type, x)?.generatedAt; return at != null ? D.weekdayShort(at) + ' ' + D.dm(at) : 'nunca pedida' }
    return ns.length > 1 ? 'Última leitura: ' + ns.map(x => NL[x] + ' ' + one(x)).join(' · ') + '.' : 'Última leitura: ' + one(ns[0]!) + '.'
  }
  const pvText = (pv: ReturnType<typeof obs.forja.preview>) => (pv.window && !pv.text.includes(pv.window) ? pv.text + ', últimos ' + pv.window : pv.text)
  const fmtOf = (type: ObsType) => (type === 'padroes-titulo-shorts' ? 'short' : 'long') as Fmt
  const thinWarn = (type: ObsType, n: NicheScope) => {
    if (!type.startsWith('padroes')) return null
    const ns: Niche[] = n === 'todos' ? ['viagem', 'ia'] : [n]
    const per = ns.map(x => ({ x, pv: obs.forja.preview(type, x, fmtOf(type)) })).filter(p => (p.pv.nOutliers ?? 0) < RP.minN)
    if (!per.length) return null
    const lst = per.map(p => (ns.length > 1 ? NL[p.x] + ': ' : '') + F.plural(p.pv.nOutliers ?? 0, 'outlier', 'outliers')).join(' · ')
    return 'Poucos outliers nessa janela (' + lst + '). A leitura classifica os títulos deles; fórmulas usadas por menos de ' + RP.minN + ' vídeos saem como recorrência observada.'
  }
  const nextPollOf = (last: number | null) => { if (last == null) return null; let t = last; while (t <= NOW) t += Q.tickMinutes * MIN; return t }
  const npQ = nextPollOf(Q.lastPollAt)
  const qAlive = Q.lastPollAt != null && NOW - Q.lastPollAt <= Q.HEARTBEAT_DEAD_MINUTES * MIN

  const combos: Record<string, DrawerCombo> = {}
  for (const type of REQ_TYPES) for (const n of ['todos', 'viagem', 'ia'] as const) {
    const q = quotaOf(type, n), eff: NicheScope = q.only ?? n
    const pv = obs.forja.preview(type, eff, fmtOf(type))
    const t = obs.forja.readingTypes.find(x => x.id === type)!
    const copy = TYPE_COPY[type]!
    const out = pv.channelsOut
    const outTxt = out.map(x => {
      const k = obs.outliers({ niche: eff, fmt: fmtOf(type), channels: [x.id], maxAge: t.windowDays ?? undefined }).count
      return (obs.channel(x.id)?.name ?? x.id) + ' (' + (k ? F.plural(k, 'outlier dele não entra', 'outliers dele não entram') : 'sem outliers na janela') + ')'
    }).join(', ')
    const blocked = q.blocked
    const preview = (n === 'todos' && eff !== 'todos' ? NL[eff as Niche] + ': ' : '') + period(pvText(pv))
    combos[comboKey(type, n)] = {
      type, niche: n, effNiche: eff, blocked, partial: q.partial,
      meta: blocked ? (blocked.kind === 'quota' && blocked.pubText ? blocked.pubText : '') + period(cap(blocked.text))
        : preview + ' ' + lastOf(type, eff),
      metaUnselected: blocked ? '' : preview + (out.length ? ' ' + F.plural(out.length, 'canal fica fora', 'canais ficam fora') + '.' : '') + ' ' + lastOf(type, eff),
      warn: !blocked && out.length ? out.map(x => x.reason).join('; ') + '.' : null, outCount: out.length,
      thin: thinWarn(type, eff),
      confirm: {
        label: t.label + ' · ' + nicheLabel(eff) + (eff === 'todos' ? ' · um pedido por nicho' : ''),
        escopo: pvText(pv).replace(/^Lê /, '') + ': ' + copy.dados + '.' + (type.startsWith('padroes') ? ' Para comparar, os vídeos dos mesmos canais que não estouraram.' : '') + (out.length ? ' Fica fora: ' + outTxt + '.' : ''),
        entrega: copy.entrega.replace('{minN}', String(RP.minN)),
        naoFaz: copy.naoFaz,
        quando: (Q.lastPollAt == null ? 'A forja ainda não consultou a fila; o pedido espera a primeira consulta. '
          : !qAlive ? 'A forja não consulta a fila desde ' + D.hm(Q.lastPollAt) + '; o pedido espera a máquina voltar. '
            : 'A forja consulta a fila às ' + D.hm(npQ!) + '. ') + period(cap(timingFor(type, eff === 'todos' ? ['viagem', 'ia'] : [eff as Niche]))),
        limite: Q.quotaScope.text + (q.partial ? ' ' + q.partial : ''),
      },
    }
  }

  // run cards: one per type with a request in the niche, the oldest active first (moldura scens())
  const scens = REQ_TYPES.map(type => ({ type, sc: scen(type, o.niche) })).filter(x => hasReq(x.sc))
  const oldest = (sc: Scenario) => Math.min(...sc.requests.filter(isActiveQ).map(x => x.queuePos != null ? x.queuePos * 1e15 : x.createdAt))
  scens.sort((a, b) => (Number(b.sc.anyActive) - Number(a.sc.anyActive)) || (a.sc.anyActive ? oldest(a.sc) - oldest(b.sc) : 0))
  const busyType = (n: Niche, type: ObsType) => { const b = blockOf(n, type); return !!b }
  const askable = (n: Niche) => REQ_TYPES.filter(t => !busyType(n, t))
  const scopeNs: Niche[] = o.niche === 'todos' ? ['ia', 'viagem'] : [o.niche]
  const freeNiches = scopeNs.filter(n => askable(n).length > 0)

  const runs: RunCard[] = scens.map(({ type, sc }) => runCard(obs, type, sc, { timingFor, nextPollOf, blockOf, freeNiches }))
  const anyActive = scens.some(x => x.sc.anyActive)
  const want = o.type && (DRAWER_TYPES as readonly string[]).includes(o.type === 'padroes-titulo-shorts' ? 'padroes-titulo' : o.type) ? o.type : 'padroes-titulo'
  const defaultNiche: NicheScope = anyActive && o.niche === 'todos' && freeNiches.length === 1 ? freeNiches[0]! : o.niche
  const okTypes = defaultNiche === 'todos' ? askable('ia').filter(t => askable('viagem').includes(t)) : askable(defaultNiche)
  const defaultType: ObsType = okTypes.includes(want) || !okTypes.length ? want : okTypes.find(x => x !== 'padroes-titulo-shorts') ?? okTypes[0]!

  const m = machineView(obs, scens[0]?.sc ?? scen('padroes-titulo', o.niche))
  const mm = (scens[0]?.sc ?? scen('padroes-titulo', o.niche)).machine
  return {
    niche: o.niche,
    machine: { alive: m.alive, strong: m.alive ? 'forja ligada' : mm.text, time: m.time, tickMinutes: mm.tickMinutes, nextPoll: m.alive && npQ != null ? D.hm(npQ) : null },
    options: DRAWER_TYPES.map(id => ({
      id, label: obs.forja.readingTypes.find(t => t.id === id)!.label,
      shortsLabel: id === 'padroes-titulo' ? obs.forja.readingTypes.find(t => t.id === 'padroes-titulo-shorts')!.label : null,
      desc: TYPE_COPY[id]!.desc, shortsDesc: id === 'padroes-titulo' ? TYPE_COPY['padroes-titulo-shorts']!.desc : null,
    })),
    combos, quotaScope: Q.quotaScope.text, runs, freeNiches, anyActive,
    insightsHref: obs.link.insights(o.niche === 'todos' ? undefined : { niche: o.niche }),
    defaultType, defaultNiche,
    capable: Object.fromEntries(REQ_TYPES.map(t => [t, Q.capabilities.includes(t)])),
    incapableText: INCAPABLE_TEXT,
  }
}

interface RunCtx {
  timingFor: (type: string, ns: Niche[]) => string
  nextPollOf: (last: number | null) => number | null
  blockOf: (n: Niche, type: ObsType) => DrawerCombo['blocked']
  freeNiches: Niche[]
}
const STATE_CASE: Record<string, RunCard['kase']> = { 'na fila': 'queued', 'trabalhando': 'running', 'publicado': 'done', 'atrasado': 'late', 'sem máquina': 'nomachine', 'nova tentativa': 'retry', 'liberado pelo vigia': 'released', 'falhou': 'failed', 'recusado (dado velho)': 'refused' }

function runCard(obs: Observatory, type: ObsType, sc: Scenario, cx: RunCtx): RunCard {
  const D = obs.date, NOW = obs.NOW, Q = obs.forja.queue, m = sc.machine, TICK = m.tickMinutes * MIN
  const reqs = sc.requests
  const active = reqs.find(isActiveQ) ?? sc.request!
  const r = reqs.find(x => DEAD.includes(x.state)) ?? active
  const split = reqs.length > 1
  const doneTodos = split && sc.anyActive && reqs.some(x => x.state === 'publicado') && !reqs.some(x => DEAD.includes(x.state))
  const kase: RunCard['kase'] = doneTodos ? 'doneTodos' : STATE_CASE[r.state] ?? 'queued'
  const tl = obs.forja.readingTypes.find(t => t.id === type)?.label ?? type
  const what = type === 'leitura-video'
    ? 'Leitura do vídeo “' + (obs.video(r.video ?? r.target.video ?? '')?.title ?? r.video ?? '') + '” · ' + NL[r.niche]
    : tl + ' · ' + (split ? 'Todos · um pedido por nicho' : NL[r.niche])
  const lines = split && sc.statusLines ? sc.statusLines : []
  const NP = m.alive ? cx.nextPollOf(m.lastPollAt) : null
  const um = cx.timingFor(type, reqs.filter(isActiveQ).map(x => x.niche))
  const created: RunStep = { s: 'feito', title: 'Pedido registrado', time: D.hm(r.createdAt), note: null }
  const step = (s: RunStep['s'], title: string, time = '', note: string | null = null): RunStep => ({ s, title, time, note })
  const nAct = reqs.filter(isActiveQ).filter(x => x.state !== 'trabalhando').map(x => x.niche)
  const cancel = nAct.length ? { label: nAct.length > 1 ? 'Cancelar pedidos' : 'Cancelar pedido', niches: nAct } : null
  const deadNs = reqs.filter(x => DEAD.includes(x.state)).map(x => x.niche)
  const busyN = deadNs.filter(n => cx.blockOf(n, type))
  const again = { niches: deadNs, disabledNote: busyN.length ? 'Já há um pedido deste tipo para ' + joinE(busyN.map(n => NL[n])) + '; peça de novo quando ele terminar.' : null }
  const tit = period(sc.statusText)
  const base = { type, video: type === 'leitura-video' ? (r.video ?? r.target.video ?? null) : null, what, lines, tit, cancel: null, again: null, goInsights: null, another: false, note: null, clock: null }
  const linear = (a: number, b: number) => (t: number) => +(((t - a) / (b - a)) * 100).toFixed(2)
  const pollsBetween = (a: number, b: number) => { const out: number[] = []; if (m.lastPollAt == null) return out; let t = m.lastPollAt; while (t > a) t -= TICK; for (t += TICK; t <= b; t += TICK) out.push(t); return out }
  const clock = (c: Omit<RunClock, 'stacked' | 'evs'> & { evs: Array<[number, string, string?]> }): RunClock => {
    const sorted = [...c.evs].sort((a, b) => a[0] - b[0]); let prev = -99, stacked = false
    const evs = sorted.map(([p, l, cl]) => { const hi = p - prev < 18; prev = hi ? -99 : p; if (hi) stacked = true; return { left: p, label: l, cls: cl ?? '', hi } })
    return { ...c, evs, stacked }
  }
  const at = (ms: number | null | undefined) => (ms == null ? '' : D.hm(ms))
  switch (kase) {
    case 'queued': {
      if (NP == null || m.lastPollAt == null) return { ...base, kase, st: 'queued', stateLabel: r.state, cancel, eta: { big: '—', text: 'sem consulta da forja registrada; ' + um, future: false, aria: false }, sub: 'Você pode fechar este painel ou sair da página; o pedido continua.', steps: [created, step('proximo', 'A forja pega o pedido'), step('pendente', 'Leitura publicada', '', INSIDE)] }
      const x = linear(m.lastPollAt - 2 * MIN, NP + TICK + 2 * MIN)
      return { ...base, kase, st: 'queued', stateLabel: r.state, cancel,
        eta: { big: D.hm(NP), text: 'próxima consulta da forja; ' + um, future: true, aria: false },
        clock: clock({ aria: 'Pedido às ' + D.hm(r.createdAt) + '; próxima consulta às ' + D.hm(NP), ticks: [{ left: x(m.lastPollAt), label: D.hm(m.lastPollAt), s: 'seen' }, { left: x(NP), label: D.hm(NP), s: 'next' }, { left: x(NP + TICK), label: D.hm(NP + TICK), s: '' }], evs: [[x(r.createdAt), 'pedido ' + D.hm(r.createdAt)]], fill: { from: x(r.createdAt), to: x(NP), cls: '' }, cap: 'A forja consulta a fila a cada ' + m.tickMinutes + ' minutos.' }),
        sub: 'Você pode fechar este painel ou sair da página; o pedido continua.',
        steps: [created, step('proximo', 'A forja pega o pedido'), step('pendente', 'Leitura publicada', '', INSIDE)] }
    }
    case 'running':
      return { ...base, kase, st: 'running', stateLabel: r.state,
        eta: { big: r.startedAt != null ? Math.max(0, Math.round((NOW - r.startedAt) / MIN)) + ' min' : '—', text: 'trabalhando; ' + um, future: false, aria: false },
        sub: 'Lendo os dados enviados, classificando com o Gemma e conferindo cada número antes de publicar.',
        steps: [created, step('feito', 'A forja pegou', at(r.claimedAt)), step('agora', 'Leitura publicada', '', INSIDE)] }
    case 'doneTodos': {
      const pubN = reqs.find(x => x.state === 'publicado')!.niche, restN = joinE(reqs.filter(x => x.state !== 'publicado').map(x => NL[x.niche]))
      return { ...base, kase, st: 'running', stateLabel: 'pedido em andamento',
        eta: { big: reqs.filter(x => x.state === 'publicado').length + ' de ' + reqs.length, text: 'leituras publicadas; ' + um, future: false, aria: false },
        sub: 'A leitura de ' + NL[pubN] + ' já está em Insights; a de ' + restN + ' sai quando a forja terminar.',
        steps: [], goInsights: { label: 'Ir até a leitura de ' + NL[pubN], niche: pubN, href: obs.link.insights({ niche: pubN }) } }
    }
    case 'done':
      return { ...base, kase, st: 'done', stateLabel: r.state,
        eta: { big: '✓', text: r.publishedAt != null ? 'em ' + Math.round((r.publishedAt - r.createdAt) / MIN) + ' min, do pedido à publicação' : 'publicada', future: false, aria: true },
        sub: 'Está na aba Insights.',
        steps: [created, step('feito', 'A forja pegou', at(r.claimedAt)), step('feito', 'Publicada', at(r.publishedAt))],
        goInsights: { label: 'Ir até a leitura', niche: r.niche, href: obs.link.insights({ niche: r.niche }) }, another: cx.freeNiches.length > 0 }
    case 'late': {
      const busy = pollsBetween(r.createdAt, NOW)
      const ahead = r.behind ? reqs.find(x => x.id === r.behind) : null
      const why = r.busyWith ? 'A forja está ocupada com ' + r.busyWith + '; ' : ahead ? 'O pedido de ' + NL[ahead.niche] + ' está à frente; ' : ''
      const capT = why + (why ? 'c' : 'C') + 'onsultou a fila nesses horários sem pegar este pedido.'
      const x = NP != null ? linear(r.createdAt - 6 * MIN, NP + 3 * MIN) : null
      return { ...base, kase, st: 'late', stateLabel: r.state, cancel,
        eta: { big: (r.waitingMinutes ?? Math.round((NOW - r.createdAt) / MIN)) + ' min', text: 'na fila; o limite é ' + Q.LATE_AFTER_MINUTES + ' min', future: false, aria: false },
        clock: x && NP != null ? clock({ aria: 'Pedido às ' + D.hm(r.createdAt) + '; a forja consultou a fila às ' + busy.map(D.hm).join(', ') + ' sem pegar este pedido; próxima às ' + D.hm(NP), ticks: [...busy.map(t => ({ left: x(t), label: D.hm(t), s: 'busy' })), { left: x(NP), label: D.hm(NP), s: 'next' }], evs: [[x(r.createdAt), 'pedido ' + D.hm(r.createdAt)]], fill: { from: x(r.createdAt), to: x(NOW), cls: 'late' }, cap: capT }) : null,
        sub: 'Fica na fila até a forja ficar livre.',
        steps: [created, step('parado', 'A forja pega o pedido', 'aguardando'), step('pendente', 'Leitura publicada')] }
    }
    case 'nomachine': {
      const last = m.lastPollAt
      const mis = last != null ? pollsBetween(last, NOW) : []
      const x = last != null ? linear(last - 4 * MIN, NOW + 6 * MIN) : null
      return { ...base, kase, st: 'nomachine', stateLabel: r.state, cancel,
        eta: last != null ? { big: D.dur(NOW - last, true), text: 'sem consulta da forja', future: false, aria: false } : { big: '—', text: 'nenhuma consulta da forja registrada', future: false, aria: false },
        clock: x && last != null ? clock({ aria: 'Última consulta da forja às ' + D.hm(last) + '; ' + mis.length + ' consultas perdidas; pedido às ' + D.hm(r.createdAt) + '; sem previsão', ticks: [{ left: x(last), label: D.hm(last), s: 'seen' }, ...mis.map(t => ({ left: x(t), label: '', s: 'missed' }))], evs: [[x(r.createdAt), 'pedido ' + D.hm(r.createdAt)], [x(NOW), 'agora', 'now']], fill: { from: x(last), to: x(NOW), cls: 'late' }, cap: mis.length + ' consultas perdidas desde a última. Sem previsão: volta quando a máquina consultar a fila.' }) : null,
        sub: 'Nada se perde; os pedidos saem por ordem de chegada. Religar a forja é com você.',
        steps: [created, step('parado', 'A forja pega o pedido', 'sem previsão'), step('pendente', 'Leitura publicada')] }
    }
    case 'retry': case 'released': {
      const a = r.attempts && r.attempts.length ? r.attempts[r.attempts.length - 1]! : null
      const ma = r.maxAttempts ?? Q.maxAttempts
      return { ...base, kase, st: kase, stateLabel: r.state,
        eta: NP != null ? { big: D.hm(NP), text: 'tentativa ' + r.attempt + ' de ' + ma + ', na próxima consulta', future: true, aria: false } : { big: '—', text: 'tentativa ' + r.attempt + ' de ' + ma + ', quando a forja consultar a fila', future: false, aria: false },
        sub: 'Nada foi publicado. O pedido voltou para a fila' + (kase === 'released' ? ' sozinho' : '') + '; se a última tentativa também falhar, ele para e você pode pedir de novo.',
        steps: [created, step('erro', 'Tentativa ' + (r.attempt - 1), a ? at(a.claimedAt) + (a.endedAt != null ? '–' + at(a.endedAt) : '') : ''), step('proximo', 'Tentativa ' + r.attempt), step('pendente', 'Leitura publicada', '', INSIDE)] }
    }
    case 'failed': {
      const n = r.attempts?.length ?? r.attempt
      return { ...base, kase, st: 'failed', stateLabel: r.state,
        eta: { big: '!', text: n + ' de ' + (r.maxAttempts ?? Q.maxAttempts) + ' tentativas', future: false, aria: true },
        sub: 'Nada foi publicado; a leitura anterior continua valendo. ' + period(cap(sc.quota.text)),
        steps: [created, ...(r.attempts?.length ? r.attempts.map((t, i) => step('erro', 'Tentativa ' + (i + 1), at(t.claimedAt) + (t.endedAt != null ? '–' + at(t.endedAt) : ''))) : [step('erro', 'Falhou', at(r.failedAt))])],
        again }
    }
    case 'refused':
      return { ...base, kase, st: 'refused', stateLabel: r.state,
        eta: { big: '!', text: 'recusado antes de ler', future: false, aria: true },
        sub: 'O site não tinha como prever. ' + period(cap(sc.quota.text)),
        steps: [created, step('feito', 'A forja pegou', at(r.claimedAt)), step('erro', 'Recusado antes de ler', at(r.refusedAt ?? r.failedAt))],
        again, note: obs.SYNC.last != null ? 'Um pedido novo leva os dados da sincronização das ' + D.hm(obs.SYNC.last) + '.' : null }
  }
}

export { SHORT_TYPE }

/**
 * "Copiar texto da leitura" (insights.html readingBlock): one block per source — title, seal, data sent, then the
 * literal text — and the site's note apart ("Desde então" of each source).
 */
export function readingCopyText(rs: Array<ForjaReadingView | null>, note: string): string {
  const src = (R: ForjaReadingView) => [R.title, R.seal, R.sentText, '', [R.lead, ...R.items.map(i => '- ' + i), ...(R.theme ? [R.theme] : [])].filter(Boolean).join('\n')].join('\n')
  const list = rs.filter((x): x is ForjaReadingView => !!x)
  if (!list.length) return ''
  return list.map(src).join('\n\n') + '\n\n' + note + ':\n' + list.map(R => R.sinceLabel + ': ' + (R.since ? R.since.shortText : 'sem comparação com os dados de hoje')).join('\n')
}
