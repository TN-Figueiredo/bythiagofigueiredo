import type { Dataset, ObsChannel, ObsVideo, Fmt as VideoFmt } from './types'
import type { NicheScope } from './niche'
export type { Dataset } from './types'
import { createClock, type Clock } from './time'
import { createFmt, type Fmt } from './fmt'
import { RULES, AGE_BANDS, OUT_WINDOWS, DEFAULT_AGES, NICHES, bandOf, winOf, tierOf } from './rules'
import { median, quant } from './stats'
import { viewsAtIdx, rate, vpdSince, vpd7, periodRate, expectedCurve, type Derived, type PeriodRate, type ExpectedCurve } from './series'
import { diffLines, titleDiff } from './text-diff'
import { effect, effectAt, type EffectResult } from './effect'
import { multiplierAt, multiplierCardText, type MultiplierResult, type MultiplierCardText } from './multiplier'
import { phaseOf, phases, outliers, tabCounts, TAB_TITLES, type Phase, type OutlierQuery, type OutliersResult } from './outliers'
import type { SyncRun, SyncToast } from './channels'
import { cadence, channelStats, channelSlots, syncText, runSyncText, syncResultToast, problemLabel, problemPhrase, syncLabel } from './channels'
import { deriveChanges, changesIn, caveats, REWRITE_GROUPS, type ObsChange } from './changes'
import { link } from './links'
import { FORMULAS, FORMULA, THEMES, THEME, formulasOf, type Formula, type Theme } from './catalog'
import { heatmap, nicheStats, themeTrend, ownCoverage, patternsNow, ownChannels, nicheRef, ownNicheStats, type NicheRef, type OwnNicheStats } from './insights'
import type { ForjaRequest, FrozenReading, Niche, RequestState, Fmt as ReadingFmt } from './types'
import { REQUEST_STATES, STATES, FORJA_QUEUE, machineOf, summarize, compose as composeScenario, statusLabel, queueOrder, type Machine, type Scenario, type NewRequest } from './forja/states'
import { createSession, type SessionScope, type SessionTarget, type AskOutcome, type SessionOpts } from './forja/session'
import { quotaFor, type QuotaStatus } from './forja/quota'
import { eligibleChannels, readingScope, readingTypes, readingTypeFor, latest, timing, SHORTS_NOTE, type ForjaCtx, type Eligible, type ReadingScope, type ScopeFilter, type Timing, type ReadingTypeWithTiming } from './forja/scope'
import { since, type SinceResult } from './forja/since'
import { preview, type Preview } from './forja/preview'
import { buildSentCtx, type SentPack, type SentTarget } from './forja/sent'

/** What a test scenario generator targets (the mockup's requestScenario target). */
export interface ScenarioTarget { type?: string; niche?: Niche | 'todos' | 'all'; video?: string; fmt?: ReadingFmt; createdAt?: number }
/** What the facade hands a test scenario generator. */
export interface ScenarioEnv {
  clock: Clock; videoNiche(id: string): Niche | null; lastPollAt: number; tickMinutes: number
  /** A scenario reading the generator produced becomes visible to the engine (forja.byId, since, readingScope). */
  registerReading?: (r: FrozenReading) => void
}
/** TEST-ONLY request generator (the mockup's REQ_SCENARIOS). Production requests come from the DB. */
export interface TestScenarios {
  requestStates: readonly RequestState[]; showcase: string
  build(state: string, target?: ScenarioTarget): { requests: ForjaRequest[]; machine: Machine; scopeTodos: boolean } | null
  /** The readings the generator published for 'publicado' scenarios (the mockup's scenarioReadings). */
  scenarioReadings?: Record<string, FrozenReading>
}
export interface FacadeSession {
  key: string; bases: string[]
  current(scope: SessionScope, o?: SessionTarget): Scenario
  ask(scope: SessionScope, o?: SessionTarget): AskOutcome
  cancel(scope: SessionScope, o?: SessionTarget): Scenario
  /** Replaces what exists by a test scenario's requests (mockup state bar); needs injected test scenarios. */
  setBase(state: string, o?: SessionTarget): Scenario
  reset(): Scenario; replay(): ReturnType<FacadeSession['state']>
  state(): { base: string; type: string; video: string | null; asks: unknown[]; cancels: unknown[]; seq: number }
}
export interface ForjaFacade {
  readings: FrozenReading[]; requests: ForjaRequest[]; requestStates: readonly RequestState[]; states: readonly RequestState[]
  queue: typeof FORJA_QUEUE & { lastPollAt: number | null; capabilities: string[] }; quotaScope: typeof FORJA_QUEUE.quotaScope
  compose(base: Parameters<typeof composeScenario>[0], req: NewRequest, opts?: { niche?: 'todos' | Niche | null; createdAt?: number } | null): Scenario
  session: FacadeSession; quotaFor(type: string, niche: Niche): QuotaStatus
  statusLabel(req: ForjaRequest, o?: { prefixNiche?: boolean; ahead?: ForjaRequest | null }): string; queueOrder: typeof queueOrder
  /** The frozen readings by id (published readings; with test scenarios also the scenario readings). */
  byId: Record<string, FrozenReading>
  latest(type: string, niche: Niche): FrozenReading | null
  /** "Desde então": what changed since a reading (text / shortText / textNoAsk). */
  since(readingId: string): SinceResult | null
  eligibleChannels(niche: Niche | 'todos'): Eligible
  preview(type: string, niche: Niche | 'todos', fmt?: ReadingFmt | null): Preview
  readingScope(id: string, filt?: ScopeFilter | null): ReadingScope | null
  timing(type: string, niche?: Niche | 'todos' | null, o?: { count?: number } | null): Timing
  readingTypes: ReadingTypeWithTiming[]; readingTypeFor: typeof readingTypeFor; shortsNote: string
  /** The frozen data one request sends to the forja (capped at RULES.forja.maxVideos). */
  buildSent(type: string, target: SentTarget): SentPack
  /** Present only when test scenarios are injected (createObservatory(ds, { testScenarios })). */
  requestScenario?: (state: string, target?: ScenarioTarget) => Scenario | null
  scenarioReadings?: Record<string, FrozenReading>
}

export interface Observatory {
  NOW: number; SERIES_START: number; DAY: number; H: number
  /** When the observatory began watching (the earliest channel added; dados.js OBS_START). */
  OBS_START: number
  channels: ObsChannel[]; videos: (ObsVideo & Derived)[]
  channel(id: string): ObsChannel | undefined; video(id: string): (ObsVideo & Derived) | undefined
  seriesOf(id: string): ObsVideo['series']; viewsAt(id: string, idx: number): number | null; rate(id: string, a: number, b: number): number | null
  periodRate(id: string, fromMs: number, toMs: number): PeriodRate; expectedCurve(id: string): ExpectedCurve
  diffLines: typeof diffLines; titleDiff: typeof titleDiff; rewriteGroups: { id: string; label: string }[]
  change(id: string): ObsChange | undefined; changesIn(o?: Parameters<typeof changesIn>[1]): ObsChange[]; caveats(id: string): string[]
  effect(id: string): EffectResult | null; effectAt(id: string, Lcap: number | null): EffectResult | null
  multiplier(id: string): MultiplierResult; multiplierAt(id: string, t: number | null): MultiplierResult
  /** Outliers card wording of the video's multiplier (reference and n note). */
  multiplierCard(id: string): MultiplierCardText
  /** Accepts the id or the video object (dados.js:2000). */
  phaseOf(x: string | { id: string }, o?: { m7?: number | null }): Phase; PHASES: Phase[]
  outliers(q?: OutlierQuery): OutliersResult; tabCounts(niche?: NicheScope): { canais: number; mud: number; out: number }
  integrity: { ok: boolean; errors: string[] }
  TAB_TITLES: typeof TAB_TITLES; TAB_COUNTS: Record<NicheScope, { canais: number; mud: number; out: number }>
  changes: ObsChange[]; forja: ForjaFacade
  RULES: typeof RULES; AGE_BANDS: typeof AGE_BANDS; OUT_WINDOWS: typeof OUT_WINDOWS; DEFAULT_AGES: typeof DEFAULT_AGES; NICHES: typeof NICHES
  date: Clock; fmt: Fmt; median: typeof median; quant: typeof quant; bandOf: typeof bandOf; winOf: typeof winOf; tierOf: typeof tierOf
  cadence: (id: string, f?: VideoFmt) => ReturnType<typeof cadence>; channelStats: (id: string, f?: VideoFmt) => ReturnType<typeof channelStats>
  channelSlots(limit?: number): ReturnType<typeof channelSlots>; syncText(id: string): string; runSyncText: typeof runSyncText
  /** Product text of a manual sync run (R40); problems sorted Viagem before IA. */
  syncResultToast(run: SyncRun): SyncToast
  SYNC: { last: number | null; next: number | null; text: string; title: string; nextText: string | null; cadence: string; cadenceHours: number; slots: number[]; dailyBefore: string }
  formulas: ReadonlyArray<Formula>; formula(id: string): Formula | undefined; formulasOf: typeof formulasOf; themes: ReadonlyArray<Theme>; theme(id: string): Theme | undefined
  heatmap(niche?: NicheScope, f?: VideoFmt): ReturnType<typeof heatmap>; nicheStats(niche?: NicheScope, f?: VideoFmt, ownId?: string): ReturnType<typeof nicheStats>
  themeTrend(niche?: NicheScope, f?: VideoFmt): ReturnType<typeof themeTrend>; ownCoverage(f?: VideoFmt, ownId?: string): ReturnType<typeof ownCoverage>; patternsNow(niche?: NicheScope, f?: VideoFmt): ReturnType<typeof patternsNow>
  /** Own channels in R73 order (subs desc, name, id). undefined | 'todos' → all; a niche → that niche's; null → the ones without niche. */
  ownChannels(niche?: NicheScope | null): ObsChannel[]
  /** The niche reference (competitors only), independent of any own channel. */
  nicheRef(niche?: NicheScope, f?: VideoFmt): NicheRef
  /** One block per own channel, in the order of `ownIds`; unknown and competitor ids are skipped. */
  ownNicheStats(niche: NicheScope | undefined, f: VideoFmt | undefined, ownIds: readonly string[]): OwnNicheStats
  link: typeof link
  LAST_IDX: number; TZ: string; TZ_LABEL: string; SERIES_START_LABEL: string
}
export function createObservatory(ds: Dataset, opts?: { seriesStartLabel?: string; testScenarios?: (env: ScenarioEnv) => TestScenarios }): Observatory {
  const clock = createClock(ds.now, ds.seriesStart, ds.snap0)
  let maxT = -Infinity
  for (const v of ds.videos) for (const p of v.series) if (p.t > maxT) maxT = p.t
  // No series at all (empty dataset): fall back to now, never -Infinity (Review Focus 2).
  const LAST_IDX = clock.snapIdxAtOrBefore(maxT === -Infinity ? ds.now : maxT)
  const last = ds.sync.last, next = ds.sync.next
  // Derived values live on copies: the input dataset is never mutated.
  const videos: (ObsVideo & Derived)[] = ds.videos.map(v => ({ ...v, vpd: null, vpd7: null, mult: null }))
  const V = new Map(videos.map(v => [v.id, v]))
  const fmt = createFmt(clock, id => V.get(id))
  const CH = new Map(ds.channels.map(c => [c.id, { ...c, sync: { ...c.sync }, videos: videos.filter(v => v.ch === c.id).sort((a, b) => b.pub - a.pub) }]))
  // The frozen readings by id: since/readingScope/outliers({reading}) read them; scenario readings join it in tests.
  // A null-prototype dictionary: reading ids are data, never inherited keys ("constructor", "__proto__").
  const READ: Record<string, FrozenReading> = Object.assign(Object.create(null) as Record<string, FrozenReading>, Object.fromEntries(ds.readings.map(r => [r.id, r])))
  const ctx: ForjaCtx = { ds: { ...ds, videos }, clock, fmt, CH, V, CHG: new Map(), READ, lastIdx: LAST_IDX }
  for (const v of videos) { v.vpd = vpdSince(ctx, v); v.vpd7 = vpd7(ctx, v) }
  for (const v of videos) v.mult = multiplierAt(ctx, v, null)
  // Derived channel labels (dados.js:415, 1966-1985). Written on the engine's own copies, never on the input.
  for (const c of CH.values()) {
    c.sync.label = syncLabel(c.sync.state); c.sync.stateLabel = c.sync.label
    c.sync.problemLabel = problemLabel(ctx, c); c.sync.problemPhrase = problemPhrase(ctx, c)
    c.statusLabel = c.activity.state === 'parado' && c.sync.state === 'ok' ? 'parado' : c.sync.label
    if (c.sync.last != null) c.syncAgeHours = (ds.now - c.sync.last) / 36e5
  }
  const changes = deriveChanges(ctx)
  const TAB_COUNTS = { todos: tabCounts(ctx, 'todos'), viagem: tabCounts(ctx, 'viagem'), ia: tabCounts(ctx, 'ia') }
  // Load-time assertion (dados.js:1952): the derived tab counts must match an independent recount.
  const integrity: { ok: boolean; errors: string[] } = { ok: true, errors: [] }
  for (const n of ['todos', 'viagem', 'ia'] as const) {
    const inN = (x: { niche: string | null }) => n === 'todos' || x.niche === n
    const want = {
      canais: ds.channels.filter(c => !c.own && inN(c)).length,
      mud: changes.filter(c => c.at > ds.now - 30 * 864e5 && inN(c) && !CH.get(c.ch)!.own).length,
      out: videos.filter(v => v.tracked && v.fmt === 'long' && inN(v) && !CH.get(v.ch)!.own && v.ageDays <= 90 && v.mult!.value != null && v.mult!.value >= 2 && !v.mult!.weak).length,
    }
    for (const k of ['canais', 'mud', 'out'] as const) if (TAB_COUNTS[n][k] !== want[k]) { integrity.ok = false; integrity.errors.push('tabCounts(' + n + ').' + k + ' = ' + TAB_COUNTS[n][k] + ', esperado ' + want[k]) }
  }
  const vid = (id: string) => { const v = V.get(id); if (!v) throw new Error('unknown video ' + id); return v }
  const forja = createForja(ctx, ds, clock, CH, V, opts?.testScenarios)
  return {
    NOW: ds.now, SERIES_START: ds.seriesStart, OBS_START: ds.obsStart, DAY: 864e5, H: 36e5,
    channels: [...CH.values()], videos, channel: id => CH.get(id), video: id => V.get(id),
    seriesOf: id => vid(id).series, viewsAt: (id, idx) => viewsAtIdx(vid(id), idx), rate: (id, a, b) => rate(ctx, vid(id), a, b),
    periodRate: (id, f, t) => periodRate(ctx, id, f, t), expectedCurve: id => expectedCurve(ctx, id),
    diffLines, titleDiff, rewriteGroups: REWRITE_GROUPS.map(g => ({ id: g.id, label: g.label })),
    change: id => ctx.CHG.get(id), changesIn: o => changesIn(ctx, o), caveats: id => caveats(ctx, id),
    effect: id => effect(ctx, id), effectAt: (id, L) => effectAt(ctx, id, L),
    multiplier: id => vid(id).mult!, multiplierAt: (id, t) => multiplierAt(ctx, vid(id), t), multiplierCard: id => multiplierCardText(ctx, vid(id).mult!),
    phaseOf: (x, o) => phaseOf(ctx, vid(typeof x === 'string' ? x : x.id), o), PHASES: phases(ctx),
    outliers: q => outliers(ctx, q), tabCounts: n => tabCounts(ctx, n), TAB_TITLES, TAB_COUNTS, integrity,
    RULES, AGE_BANDS, OUT_WINDOWS, DEFAULT_AGES, NICHES, date: clock, fmt, median, quant, bandOf, winOf, tierOf,
    SYNC: { last, next, text: last == null ? 'nunca sincronizado' : 'sincronizado ' + clock.ago(last), title: last == null ? 'nunca sincronizado' : clock.dm(last) + ' ' + clock.hm(last) + ' (SP)', nextText: next ? 'próxima às ' + clock.hm(next) : null,
      // 6 h slots rule (dados.js:1963); the mockup fixes it in data, production fixes it in the cron schedule.
      cadence: 'a cada 6 h (00, 06, 12, 18) desde ' + clock.dm(ds.seriesStart) + '; diária às 09:00 antes', cadenceHours: 6, slots: [0, 6, 12, 18], dailyBefore: '09:00' },
    LAST_IDX, TZ: 'America/Sao_Paulo', TZ_LABEL: 'Horários em São Paulo', SERIES_START_LABEL: clock.dm(ds.seriesStart),
    cadence: (id, f) => cadence(ctx, id, f), channelStats: (id, f) => channelStats(ctx, id, f), channelSlots: (limit = RULES.channelLimit) => channelSlots(ctx, limit),
    syncText: id => syncText(ctx, CH.get(id)!), runSyncText,
    syncResultToast: run => syncResultToast(run, id => { const c = CH.get(id); return c ? { name: c.name, niche: c.niche } : undefined }),
    formulas: FORMULAS, formula: id => FORMULA[id], formulasOf, themes: THEMES, theme: id => THEME[id],
    heatmap: (n, f) => heatmap(ctx, n, f), nicheStats: (n, f, o) => nicheStats(ctx, n, f, o), themeTrend: (n, f) => themeTrend(ctx, n, f), ownCoverage: (f, o) => ownCoverage(ctx, f, o), patternsNow: (n, f) => patternsNow(ctx, n, f),
    ownChannels: n => ownChannels(ctx, n), nicheRef: (n, f) => nicheRef(ctx, n, f), ownNicheStats: (n, f, ids) => ownNicheStats(ctx, n, f, ids),
    link,
    changes, forja,
  }
}

function createForja(ctx: ForjaCtx, ds: Dataset, clock: Clock, CH: Map<string, ObsChannel>, V: Map<string, ObsVideo>, testScenarios?: (env: ScenarioEnv) => TestScenarios): ForjaFacade {
  const lastPollAt = ds.queue.lastPollAt
  const machine = machineOf(lastPollAt, clock)
  const tests = testScenarios?.({ clock, videoNiche: id => V.get(id)?.niche ?? null, lastPollAt: lastPollAt ?? clock.now, tickMinutes: ds.queue.tickMinutes, registerReading: r => { ctx.READ[r.id] = r } })
  const sessionOpts = (base: string, type: string, video: string | null): SessionOpts => ({
    capabilities: ds.queue.capabilities, eligible: n => eligibleChannels(ctx, n),
    videoOf: id => { const v = V.get(id); return v ? { niche: v.niche, title: v.title } : undefined },
    defaultType: type, defaultVideo: video,
    // the mockup's single-niche scenario has its own times (see SessionOpts.singleBase); only with test scenarios
    singleBase: tests && base !== 'sem pedido' ? (n, t) => tests.build(base, { niche: n, type: t })?.requests ?? null : undefined,
  })
  // What exists: the DB requests; with injected test scenarios the mockup's session starts empty ("sem pedido").
  const initial = tests ? [] : ds.requests
  let st = { base: 'sem pedido', type: 'padroes-titulo', video: null as string | null }
  let s = createSession(initial, machine, clock, sessionOpts(st.base, st.type, st.video))
  const state = () => ({ base: st.base, ...s.state() })
  const session: FacadeSession = {
    key: 'obs-forja', bases: ['sem pedido', ...(tests ? tests.requestStates : [])],
    current: (scope, o) => s.current(scope, o), ask: (scope, o) => s.ask(scope, o), cancel: (scope, o) => s.cancel(scope, o),
    setBase(mock, o) {
      const type = (o && o.type) || 'padroes-titulo', isVid = type === 'leitura-video'
      const video = (o && o.video) || (isVid && tests ? tests.showcase : null)
      st = { base: mock || 'sem pedido', type, video }
      let reqs: ForjaRequest[] = [], m = machine
      if (st.base !== 'sem pedido') {
        if (!tests) throw new Error('forja.session.setBase needs injected test scenarios')
        const b = isVid ? tests.build(st.base, { type, video: video ?? undefined }) : tests.build(st.base, { niche: 'todos', type })
        if (b) { reqs = b.requests; m = b.machine }
      }
      s = createSession(reqs, m, clock, sessionOpts(st.base, type, video))
      return isVid ? s.current(null, { type, video }) : s.current('todos', { type })
    },
    reset() { st = { base: 'sem pedido', type: 'padroes-titulo', video: null }; s = createSession(initial, machine, clock, sessionOpts(st.base, st.type, st.video)); return s.current('todos') },
    replay: () => state(), state,
  }
  const requests = [...ds.requests]
  if (tests) for (const st0 of tests.requestStates) { const b = tests.build(st0, { type: 'padroes-titulo', niche: 'ia' }); if (b) requests.push(summarize(b.requests, b.machine, false, clock).request!) }
  return {
    readings: ds.readings, requests, requestStates: tests ? tests.requestStates : REQUEST_STATES, states: STATES,
    queue: { ...FORJA_QUEUE, lastPollAt, capabilities: ds.queue.capabilities }, quotaScope: FORJA_QUEUE.quotaScope,
    compose: (b, r, o) => composeScenario(b, r, { ...(o || {}), machine }, clock),
    session, quotaFor: (type, niche) => quotaFor(ds.requests, type, niche, clock.now, clock),
    statusLabel: (r, o) => statusLabel(r, clock, { machine, ...(o || {}) }), queueOrder,
    byId: ctx.READ, latest: (type, niche) => latest(ds.readings, type, niche), since: id => since(ctx, id), eligibleChannels: n => eligibleChannels(ctx, n),
    preview: (type, niche, f) => preview(ctx, type, niche, f), readingScope: (id, filt) => readingScope(ctx, id, filt),
    timing: (type, niche, o) => timing(requests, type, niche, o), readingTypes: readingTypes(requests), readingTypeFor, shortsNote: SHORTS_NOTE,
    buildSent: (type, target) => buildSentCtx(ctx, type, target),
    ...(tests && tests.scenarioReadings ? { scenarioReadings: tests.scenarioReadings } : {}),
    ...(tests ? { requestScenario: (st0: string, t?: ScenarioTarget) => { const b = tests.build(st0, t); return b ? summarize(b.requests, b.machine, b.scopeTodos, clock) : null } } : {}),
  }
}
