/**
 * The ask planner — a pure port of OBS.forja.session (dados.js:1689-1825 and its quota wrappers at 1887-1893),
 * minus the storage: the mockup kept its state in sessionStorage, here it is an in-memory list.
 *
 * `requests` are the requests that exist (DB rows, already mapped to states); `ask` and `cancel` plan on top of them
 * in click order, the way the DB service will apply them. A request is keyed by (type, target): the target is the
 * niche (padrões, temas, resumo) or the video (leitura-video). Quota and "busy" are per niche + type.
 */
import type { Clock } from '../time'
import type { ForjaRequest, Niche } from '../types'
import { BUILTIN_NICHES, nicheLabel, tabOrder } from '../niche'
import { liveRequests } from './quota'
import {
  TYPE_SHORT, aheadNote, composeRaw, describeRequests, isActive, nextSpMidnight, queueOrder, resummarize, withQuota,
  todosNiches, FORJA_QUEUE, type Machine, type NicheCtx, type Scenario,
} from './states'

export type SessionScope = Niche | 'todos' | 'all' | null | undefined
export interface SessionTarget { type?: string; video?: string | null; createdAt?: number }
export interface AskResult { niche: Niche; video?: string; ok: boolean; reason: string | null; channelsOut?: Array<{ id: string; reason: string }> }
export interface AskOutcome { ok: boolean; reason: string | null; results: AskResult[]; scenario: Scenario }
export interface SessionOpts {
  /** Types the machine announced it reads (heartbeat). Asking another type sends nothing. */
  capabilities: readonly string[]
  /** Channels in / out of a niche's request (sync > 24 h stays out); reported on each sent ask. */
  eligible: (niche: Niche) => { in: string[]; out: Array<{ id: string; reason: string }> }
  /** Video lookup (leitura-video): its niche and title. */
  videoOf?: (id: string) => { niche: Niche | null; title: string } | undefined
  /** Type and video used when a call names none (the mockup's base type). */
  defaultType?: string; defaultVideo?: string | null
  /**
   * @internal Test seam — production leaves it unset.
   * The requests the base holds when viewed for ONE niche. Default: the base's own request of that niche, so a
   * single-niche view of an untouched request gets the canonical texts. (The mockup's generator builds a single-niche
   * scenario with its own times; the test facade injects it here.)
   */
  singleBase?: (niche: Niche, type: string) => ForjaRequest[] | null
  /** Os nichos do site (rótulos, e a lista em que "Todos" se divide). Ausente = os dois de fábrica. */
  niches?: NicheCtx
  /**
   * Há o que pedir para o nicho? Um nicho sem concorrente não tem (o pedido é recusado com
   * "Nenhum concorrente em <Nicho> ainda" e fica fora de "Todos"). Ausente = todo nicho pode ser pedido.
   */
  askable?: (niche: Niche) => boolean
  /** O nicho tem lista de temas? Sem lista, a leitura de temas não tem o que classificar. Ausente = todo nicho tem. */
  hasThemes?: (niche: Niche) => boolean
}

export const NOT_ANNOUNCED = 'A forja ainda não lê pedidos do observatório.'
/** ask(null) for a niche type: nothing to send. With the built-in niches: "…(Viagem, IA ou Todos)." */
export const noNicheText = (labels: readonly string[]) => 'Nada enviado: escolha um nicho (' + [...labels, 'ou Todos'].join(', ').replace(/, ou Todos$/, ' ou Todos') + ').'
export const NO_NICHE = noNicheText(tabOrder(BUILTIN_NICHES).map(n => nicheLabel(BUILTIN_NICHES, n)))
/** Nicho sem concorrente (mockup multi-canal, resposta 7): o botão fica desabilitado com este texto e nada é enviado. */
export const noCompetitorsText = (label: string) => 'Nenhum concorrente em ' + label + ' ainda'
/** "Todos" sem nenhum nicho com concorrente. */
export const NO_COMPETITORS_ANY = 'Nenhum concorrente em nenhum nicho ainda'
/** Leitura de temas pedida para um nicho sem lista de temas (todo nicho criado pelo dono, por enquanto). */
export const noThemesAskText = (label: string) => 'Nada enviado: ' + label + ' ainda não tem lista de temas.'
/** Com "Todos", o nicho sem lista de temas fica fora do pedido e entra na resposta com esta linha. */
export const noThemesLine = (label: string) => label + ': sem lista de temas'
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const isVid = (t: string) => t === 'leitura-video'
const vidOf = (q: ForjaRequest) => q.video ?? q.target.video ?? null
const todosOf = (scope: SessionScope) => scope === 'todos' || scope === 'all'
const NO_QUOTA = ['falhou', 'recusado (dado velho)']
const stripBehind = (s: string) => s.replace(/ \(atrás do de [^)]+\)$/, '')

interface Ask { niche: Niche; type: string; video: string | null; createdAt: number; seq: number }
interface Cancel { niche: Niche | null; type: string; video: string | null }
interface Key { type: string; video: string | null }

export function createSession(requests: ForjaRequest[], machine: Machine, clock: Clock, opts: SessionOpts) {
  const NOW = clock.now
  // What exists: active requests, plus today's finished ones (they decide the quota); the latest per (type, niche, video).
  const base0 = liveRequests(requests, NOW, clock)
  const st = { type: opts.defaultType ?? 'padroes-titulo', video: opts.defaultVideo ?? null, asks: [] as Ask[], cancels: [] as Cancel[], seq: 0 }
  const typeOf = (o?: SessionTarget) => (o && o.type) || st.type
  const sameKey = (x: { type: string; video: string | null }, type: string, video: string | null) => x.type === type && (!isVid(type) || x.video === video)
  const baseOf = (type: string, video: string | null) => base0.filter(q => sameKey({ type: q.type, video: vidOf(q) }, type, video))
  const nx: NicheCtx = opts.niches ?? { defs: BUILTIN_NICHES }
  const label = (n: Niche) => nicheLabel(nx.defs, n)
  const hasComp = (n: Niche) => opts.askable?.(n) !== false
  const themed = (n: Niche, type: string) => type !== 'temas' || opts.hasThemes?.(n) !== false
  /** A lista de um pedido (ou cancelamento) "Todos": a ordem da forja. */
  const split = (scope: SessionScope): Niche[] => todosOf(scope) ? [...todosNiches(nx)] : scope ? [scope as Niche] : []
  const LABELS_RE = nx.defs.map(d => escapeRe(d.label)).join('|')
  const releaseText = () => { const rel = nextSpMidnight(NOW, clock); return 'libera ' + clock.weekday(rel) + ', ' + clock.dm(rel) + ' às 00:00' }
  const empty = (): Scenario => ({
    state: 'sem pedido', requests: [], request: null, split: false, statusLines: [], statusLabel: null, statusText: 'Nenhum pedido em andamento.',
    active: false, anyActive: false, terminal: false, empty: true, machine,
    quota: { usedToday: 0, perTypePerNiche: FORJA_QUEUE.quotaPerDayPerType, note: FORJA_QUEUE.quotaNote, releasesAt: null, text: 'cota de hoje livre (' + FORJA_QUEUE.quotaNote + ')' },
  })

  function recompose(reqs: ForjaRequest[]): Scenario | null {
    if (!reqs.length) return null
    const ids = new Set(reqs.map(q => q.id))
    const clean = reqs.map(q => q.behind && !ids.has(q.behind) ? { ...q, behind: null, stateNote: null, statusLabel: stripBehind(q.statusLabel ?? '') } : { ...q })
    return resummarize(queueOrder(clean), machine, true, clock, nx)
  }
  // scenario of one key: what exists − cancels + new asks in click order
  function all(type: string, video: string | null): Scenario {
    const b = baseOf(type, video)
    let sc: Scenario | null = b.length ? describeRequests(b, machine, clock, nx) : null
    const cancels = st.cancels.filter(c => sameKey(c, type, video)).map(c => c.niche)
    if (sc && cancels.length) { const keep = sc.requests.filter(q => !(cancels.includes(q.niche) && isActive(q))); sc = keep.length ? recompose(keep) : null }
    for (const a of st.asks.filter(x => sameKey(x, type, video)).sort((x, y) => x.seq - y.seq)) {
      sc = composeRaw(sc, { niche: a.niche, createdAt: a.createdAt, type, seq: 100 + a.seq }, { niche: isVid(type) ? null : 'todos', machine, niches: nx }, clock)
      if (isVid(type)) for (const q of sc.requests) { q.target = { kind: 'video', video: video ?? undefined }; q.video = video }
    }
    return sc || empty()
  }
  // the single queue: every active request of every type; "trabalhando" in front, then createdAt and seq
  function keysAll(): Key[] {
    const ks: Key[] = []
    const add = (t: string, v: string | null) => { if (!ks.some(k => k.type === t && k.video === v)) ks.push({ type: t, video: v }) }
    for (const q of base0) add(q.type, isVid(q.type) ? vidOf(q) : null)
    for (const a of st.asks) add(a.type, isVid(a.type) ? a.video : null)
    return ks
  }
  function globalQueue(): Array<ForjaRequest & { type: string }> {
    const act: ForjaRequest[] = []
    for (const k of keysAll()) for (const q of all(k.type, k.video).requests) if (isActive(q)) act.push({ ...q, type: k.type, video: k.video })
    const w = (q: ForjaRequest) => (q.state === 'trabalhando' ? 1 : 0)
    return act.sort((a, b) => (w(b) - w(a)) || (a.createdAt - b.createdAt) || ((a.seq || 0) - (b.seq || 0)) || ((a.behind ? 1 : 0) - (b.behind ? 1 : 0)))
  }
  function allG(type: string, video: string | null): Scenario {
    const sc = all(type, video)
    if (!sc.requests.length) return sc
    const gq = globalQueue()
    let changed = false
    const reqs = sc.requests.map(q => {
      const r: ForjaRequest = { ...q }, i = gq.findIndex(g => g.id === q.id)
      if (i >= 0) { r.queuePos = i + 1; r.firstInQueue = i === 0; r.queueSize = gq.length }
      if (i > 0 && ['na fila', 'atrasado', 'sem máquina'].includes(q.state)) {
        const ah = gq[i - 1]!, note = aheadNote(ah, { ...r, type }, nx)
        if (r.stateNote !== note) { changed = true; r.stateNote = note; r.behind = ah.id; r.statusLabel = (r.statusLabel ?? '').replace(/ \(atrás d[^)]+\)$/, '') + ' (' + note + ')' }
      }
      return r
    })
    if (!changed) { sc.requests = reqs; sc.request = reqs[0] ?? null; return sc }
    return resummarize(queueOrder(reqs), sc.machine, !!sc.split, clock, nx)
  }
  function nicheReqs(niche: Niche, type: string): ForjaRequest[] {
    if (!isVid(type)) return all(type, null).requests.filter(r => r.niche === niche)
    const vids = new Set([...base0.filter(q => isVid(q.type)).map(vidOf), ...st.asks.filter(a => isVid(a.type)).map(a => a.video)]
      .filter((v): v is string => !!v && opts.videoOf?.(v)?.niche === niche))
    return [...vids].flatMap(v => all(type, v).requests)
  }
  // machine busy with a request of ANOTHER type (or another video): say what it is reading and since when
  function runningElsewhere(type: string, video: string | null) {
    for (const k of keysAll()) {
      if (k.type === type && (!isVid(type) || k.video === video)) continue
      const q = all(k.type, k.video).requests.find(r => r.state === 'trabalhando')
      if (q) return { q, type: k.type, video: k.video }
    }
    return null
  }
  function addBusy(sc: Scenario, type: string, video: string | null): Scenario {
    const mine = sc.requests.find(q => q.state === 'na fila' || q.state === 'atrasado'), run = mine ? runningElsewhere(type, video) : null
    if (run) {
      sc.machineBusy = { type: run.type, niche: run.q.niche, video: run.video, since: run.q.claimedAt }
      sc.statusText = (sc.statusText ? sc.statusText + ' ' : '') + 'A máquina está lendo outro pedido (' + TYPE_SHORT[run.type] + (isVid(run.type) ? '' : ' de ' + label(run.q.niche)) + ') desde ' + (run.q.claimedAt == null ? '—' : clock.hm(run.q.claimedAt)) + '.'
    } else sc.machineBusy = null
    return sc
  }
  function current(scope: SessionScope, o?: SessionTarget): Scenario {
    const type = typeOf(o), video = o && o.video ? o.video : (isVid(type) ? st.video : null)
    if (isVid(type)) {
      const sc: Scenario = { ...allG(type, video), type, video }
      // the text speaks of the video, not of the niche
      if (sc.statusText) sc.statusText = sc.statusText.replace(new RegExp('O pedido de (' + LABELS_RE + ') ', 'g'), 'O pedido de leitura deste vídeo ').replace(new RegExp('Leitura de (' + LABELS_RE + ') publicada', 'g'), 'Leitura deste vídeo publicada')
      // another video of the same niche with an active request: the button is born blocked
      const n = video ? opts.videoOf?.(video)?.niche ?? null : null
      const other = n ? nicheReqs(n, type).find(q => isActive(q) && vidOf(q) !== video) : null
      if (other && n) {
        const ov = vidOf(other)!, title = opts.videoOf?.(ov)?.title ?? ov
        sc.blockedBy = { video: ov, title, statusLabel: other.statusLabel ?? '', reason: 'Nada enviado: já há uma leitura de vídeo de ' + label(n) + ' ' + stripBehind(other.statusLabel ?? '') + ', do vídeo “' + title + '”.' }
      } else sc.blockedBy = null
      return addBusy(sc, type, video)
    }
    const sc = allG(type, null)
    if (!scope || todosOf(scope)) return { ...sc, type }
    const niche = scope as Niche
    const q = sc.requests.find(r => r.niche === niche)
    if (!q) return { ...empty(), niche, type }
    const b = baseOf(type, null)
    const oneReqs = b.length && !st.asks.some(a => a.niche === niche && sameKey(a, type, null)) ? (opts.singleBase ? opts.singleBase(niche, type) : b.filter(r => r.niche === niche)) : null
    const one = oneReqs && oneReqs.length ? describeRequests(oneReqs, machine, clock, nx) : null
    const TK = ['createdAt', 'claimedAt', 'publishedAt', 'failedAt', 'refusedAt', 'releasedAt'] as const
    const sameTimes = one && TK.every(k => (one.request![k] || null) === (q[k] || null))
    if (one && !q.stateNote && one.request!.state === q.state && sameTimes) return { ...one, niche, type, active: isActive(one.request!), anyActive: isActive(one.request!) }
    // a one-niche view keeps the queue suffix when an active request of another niche is in front (same rule as compose)
    return { ...resummarize([{ ...q }], sc.machine, false, clock, nx), niche, type }
  }
  function ask(scope: SessionScope, o?: SessionTarget): AskOutcome {
    const type = typeOf(o), res: AskResult[] = []
    const createdAt = Math.min((o && o.createdAt) || NOW, NOW)
    if (isVid(type)) {
      const video = o && o.video ? o.video : null, v = video ? opts.videoOf?.(video) : undefined
      if (!video || !v || !v.niche) return { ok: false, reason: 'vídeo desconhecido', results: [], scenario: empty() }
      const n = v.niche
      if (!opts.capabilities.includes(type)) return { ok: false, reason: NOT_ANNOUNCED, results: [{ niche: n, video, ok: false, reason: NOT_ANNOUNCED }], scenario: current(n, { type, video }) }
      const mine = all(type, video).requests[0], others = nicheReqs(n, type)
      if (mine && isActive(mine)) res.push({ niche: n, video, ok: false, reason: 'Nada enviado: já há um pedido de leitura deste vídeo ' + stripBehind(mine.statusLabel ?? '') + (mine.stateNote ? ', ' + mine.stateNote : '') + '.' })
      else if (others.some(isActive)) res.push({ niche: n, video, ok: false, reason: 'já há uma leitura de vídeo de ' + label(n) + ' em andamento' })
      else if (others.some(q => !NO_QUOTA.includes(q.state))) res.push({ niche: n, video, ok: false, reason: 'cota de hoje usada para leituras de vídeo de ' + label(n) + ' (' + releaseText() + ')' })
      else {
        st.asks = st.asks.filter(a => !sameKey(a, type, video)); st.cancels = st.cancels.filter(c => !sameKey(c, type, video))
        st.asks.push({ niche: n, type, video, createdAt, seq: ++st.seq }); res.push({ niche: n, video, ok: true, reason: null, channelsOut: opts.eligible(n).out })
      }
      const ok = res.some(r => r.ok)
      return { ok, results: res, reason: ok ? null : res[0]!.reason, scenario: current(n, { type, video }) }
    }
    // sem concorrente não há o que pedir: "Todos" deixa o nicho de fora; o pedido de um nicho só é recusado com o motivo
    const wanted: Niche[] = split(scope).filter(n => !todosOf(scope) || hasComp(n))
    // temas: só os nichos com lista de temas; num pedido de um nicho só, a recusa diz o motivo; em "Todos" o nicho fica de fora
    const ns = wanted.filter(n => themed(n, type)), noThemes = wanted.filter(n => !themed(n, type))
    if (noThemes.length && !todosOf(scope)) { const reason = noThemesAskText(label(noThemes[0]!)); return { ok: false, reason, results: [{ niche: noThemes[0]!, ok: false, reason }], scenario: current(scope, { type }) } }
    const skipped: AskResult[] = noThemes.map(n => ({ niche: n, ok: false, reason: noThemesLine(label(n)) }))
    if (!ns.length && skipped.length) return { ok: false, reason: skipped.map(r => r.reason).join('; '), results: skipped, scenario: current(scope, { type }) }
    if (!ns.length) return { ok: false, reason: todosOf(scope) ? NO_COMPETITORS_ANY : noNicheText(tabOrder(nx.defs).map(label)), results: [], scenario: current(scope, { type }) }
    if (!todosOf(scope) && !hasComp(ns[0]!)) { const reason = noCompetitorsText(label(ns[0]!)); return { ok: false, reason, results: [{ niche: ns[0]!, ok: false, reason }], scenario: current(scope, { type }) } }
    if (!opts.capabilities.includes(type)) return { ok: false, reason: NOT_ANNOUNCED, results: ns.map(n => ({ niche: n, ok: false, reason: NOT_ANNOUNCED })), scenario: current(scope, { type }) }
    for (const n of ns) {
      const q = nicheReqs(n, type)[0]
      if (q && isActive(q)) { res.push({ niche: n, ok: false, reason: 'Nada enviado: já há um pedido de ' + label(n) + ' ' + stripBehind(q.statusLabel ?? '') + (q.stateNote ? ', ' + q.stateNote : '') + '.' }); continue }
      if (q && !NO_QUOTA.includes(q.state)) { res.push({ niche: n, ok: false, reason: 'cota de hoje usada para ' + label(n) + ' (' + releaseText() + ')' }); continue }
      st.asks = st.asks.filter(a => !(a.niche === n && sameKey(a, type, null))); st.cancels = st.cancels.filter(c => !(c.niche === n && sameKey(c, type, null)))
      st.asks.push({ niche: n, type, video: null, createdAt, seq: ++st.seq }); res.push({ niche: n, ok: true, reason: null, channelsOut: opts.eligible(n).out })
    }
    res.push(...skipped)
    const ok = res.some(r => r.ok)
    return { ok, results: res, reason: ok ? null : res.map(r => r.reason).join('; '), scenario: current(scope, { type }) }
  }
  function cancel(scope: SessionScope, o?: SessionTarget): Scenario {
    const type = typeOf(o)
    if (isVid(type)) {
      const video = o && o.video ? o.video : null
      st.asks = st.asks.filter(a => !sameKey(a, type, video)); st.cancels.push({ niche: video ? opts.videoOf?.(video)?.niche ?? null : null, type, video })
      return current(null, { type, video })
    }
    // cancelar "Todos" vale para todo nicho que tenha pedido, com ou sem concorrente hoje
    const ns: Niche[] = todosOf(scope) ? [...new Set([...split(scope), ...all(type, null).requests.map(q => q.niche)])] : split(scope)
    for (const n of ns) {
      st.asks = st.asks.filter(a => !(a.niche === n && sameKey(a, type, null)))
      if (!st.cancels.some(c => c.niche === n && sameKey(c, type, null))) st.cancels.push({ niche: n, type, video: null })
    }
    return current(scope, { type })
  }
  return {
    /** Per-niche quota wrappers (dados.js:1887-1893). */
    current: (scope: SessionScope, o?: SessionTarget): Scenario => withQuota(current(scope, o), todosOf(scope) && !(o && o.type === 'leitura-video'), clock, nx),
    ask: (scope: SessionScope, o?: SessionTarget): AskOutcome => { const r = ask(scope, o); r.scenario = withQuota(r.scenario, todosOf(scope), clock, nx); return r },
    cancel: (scope: SessionScope, o?: SessionTarget): Scenario => withQuota(cancel(scope, o), todosOf(scope), clock, nx),
    /** The plan so far (asks and cancels in click order). */
    state: () => structuredClone({ type: st.type, video: st.video, asks: st.asks, cancels: st.cancels, seq: st.seq }),
  }
}
export type Session = ReturnType<typeof createSession>

/** One ask over the requests that exist — what forja-queue.askReading runs before writing rows. */
export function planAsk(requests: ForjaRequest[], machine: Machine, clock: Clock, opts: SessionOpts, scope: SessionScope, o?: SessionTarget): AskOutcome {
  return createSession(requests, machine, clock, opts).ask(scope, o)
}
