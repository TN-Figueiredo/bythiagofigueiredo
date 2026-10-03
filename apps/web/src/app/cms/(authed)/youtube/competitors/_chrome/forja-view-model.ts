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
import type { AskOutcome, ObsType } from '@/lib/pipeline/services/forja-queue'
import { ACTIVE_STATES } from '@/lib/youtube/observatorio/forja/states'
import { NOT_ANNOUNCED } from '@/lib/youtube/observatorio/forja/session'

export type { ObsType }
/** The server actions as the client components receive them (askForjaReading / cancelForjaReading, passed as props). */
export type ForjaAsk = (type: ObsType, scope: NicheScope, videoId?: string, fmt?: Fmt) => Promise<AskOutcome>
export type ForjaCancel = (type: ObsType, niche: Niche, videoId?: string) => Promise<{ ok: boolean; reason?: string }>
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
  /** "DD/MM, há …" — the reading's day and how long ago (historico-video.html:682). */
  whenAgo: string
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
  /** The state of the niche's request (null without one): "publicado" lines are not repeated where the reading is. */
  requestState: string | null
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
   * type and niche (with Todos, one request per free niche, in click order); Mudanças opens its inline preview +
   * "Confirmar pedido"; Histórico has no header button. The moldura's selector drawer is the chrome demo, not a product
   * surface (R59): it is not ported.
   */
  headerAction: 'ask' | 'confirm' | 'none'
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
export function groupsOf(r: FrozenReading): GroupLite[] {
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
    whenAgo: obs.date.dmOrDmy(r.generatedAt) + ', ' + obs.date.ago(r.generatedAt),
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
      niche: n, label: NL[n], active, statusLine: q ? line : null, requestState: q ? q.state : null,
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
  const untracked = isVid && video && !video.tracked ? 'Vídeo fora dos acompanhados: não há dados para a forja ler' : null
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
