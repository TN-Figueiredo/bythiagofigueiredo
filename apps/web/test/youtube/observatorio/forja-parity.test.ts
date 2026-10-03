// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle, createTestObservatory } from './oracle'
import { forjaScenarios } from './forja-scenarios'
import { createClock } from '@/lib/youtube/observatorio/time'
import { summarize } from '@/lib/youtube/observatorio/forja/states'
import { createObservatory, type ScenarioEnv } from '@/lib/youtube/observatorio'
import type { ForjaRequest } from '@/lib/youtube/observatorio/types'

const oracle = loadOracle()
const ds = datasetFromOracle(loadOracle())
const clock = createClock(ds.now, ds.seriesStart, ds.snap0)
const niches = new Map(ds.videos.map(v => [v.id, v.niche]))
const gen = forjaScenarios({ clock, videoNiche: id => niches.get(id) ?? null, lastPollAt: ds.queue.lastPollAt!, tickMinutes: ds.queue.tickMinutes })
const strip = (reqs: ForjaRequest[]) => reqs.map(q => { const { stateNote: _n, behind: _b, ...rest } = q; return rest as ForjaRequest })
const FIELDS = ['statusLabel', 'statusLines', 'statusText', 'terminal', 'anyActive', 'split'] as const
const pick = (sc: Record<string, unknown> & { quota: { text: string } }) => ({ ...Object.fromEntries(FIELDS.map(k => [k, sc[k]])), quotaText: sc.quota.text })

describe('forja parity — fixture requests summarised by PRODUCTION code = oracle requestScenario', () => {
  it('the request states are the oracle\'s', () => {
    expect(gen.requestStates).toEqual(oracle.forja.requestStates)
  })
  const cases = gen.requestStates.flatMap(st => (['ia', 'viagem', 'todos'] as const).flatMap(niche =>
    ['padroes-titulo', 'resumo-trocas', 'leitura-video'].map(type => [st, niche, type] as const)))
  it.each(cases)('%s × %s × %s', (st, niche, type) => {
    const built = gen.build(st, { type, niche })!
    const prod = summarize(built.requests, built.machine, built.scopeTodos, clock)
    expect(pick(prod as never)).toEqual(pick(oracle.forja.requestScenario(st, { type, niche })))
  })
  // Beyond the brief: the createdAt variants of the F4 suite test (forecasts, shifted claims).
  const cas = [ds.now, clock.spIso('2026-10-24T13:02'), clock.spIso('2026-10-24T14:31'), clock.spIso('2026-10-24T12:00')]
  it.each(gen.requestStates.flatMap(st => (['ia', 'todos'] as const).flatMap(niche => cas.map(ca => [st, niche, ca] as const))))('%s × %s × createdAt %d', (st, niche, createdAt) => {
    const built = gen.build(st, { niche, createdAt })!
    const prod = summarize(built.requests, built.machine, built.scopeTodos, clock)
    expect(pick(prod as never)).toEqual(pick(oracle.forja.requestScenario(st, { niche, createdAt })))
  })
  // Fix round 1: DB rows carry no queue relationship — production derives "atrás do …" itself.
  it.each(cases)('without stateNote/behind: %s × %s × %s', (st, niche, type) => {
    const built = gen.build(st, { type, niche })!
    const prod = summarize(strip(built.requests), built.machine, built.scopeTodos, clock)
    expect(pick(prod as never)).toEqual(pick(oracle.forja.requestScenario(st, { type, niche })))
  })
  it('the facade wires the same thing: forja.requestScenario (test-injected) = oracle', () => {
    const obs = createTestObservatory(ds)
    for (const st of gen.requestStates) for (const niche of ['ia', 'todos'] as const)
      expect(pick(obs.forja.requestScenario!(st, { niche }) as never)).toEqual(pick(oracle.forja.requestScenario(st, { niche })))
  })
  it('without injected scenarios the production facade has no requestScenario', () => {
    expect('requestScenario' in createObservatory(ds).forja).toBe(false)
  })
})

describe('forja parity — session planner (production createSession behind the facade) = oracle session', () => {
  type Sc = Record<string, unknown> & { quota: { text: string; byNiche?: unknown }; blockedBy?: unknown; machineBusy?: unknown; empty?: boolean }
  const view = (sc: Sc) => ({ ...pick(sc), byNiche: sc.quota.byNiche ?? null, blockedBy: sc.blockedBy ?? null, busy: sc.machineBusy ? true : false, empty: !!sc.empty })
  type R = { niche: string; video?: string; ok: boolean; reason?: string | null }
  const askView = (a: { ok: boolean; reason: string | null; results: R[]; scenario: Sc }) =>
    ({ ok: a.ok, reason: a.reason, results: a.results.map(r => ({ niche: r.niche, video: r.video ?? null, ok: r.ok, reason: r.reason ?? null })), scenario: view(a.scenario) })
  const LV = (video: string) => ({ type: 'leitura-video', video })
  const VIEWS: Array<[string | null, Record<string, string> | undefined]> = [['todos', undefined], ['ia', undefined], ['viagem', undefined], ['viagem', { type: 'temas' }],
    [null, LV('matt-opus55')], ['ia', LV('matt-gpt6-astra')], ['viagem', LV('luke-kfc')]]
  type S = { reset(): unknown; setBase(b: string, o?: unknown): unknown; ask(s: unknown, o?: unknown): never; cancel(s: unknown, o?: unknown): never; current(s: unknown, o?: unknown): never }
  const script = (S: S, base: string, type: string) => {
    const out: unknown[] = []
    const views = () => VIEWS.forEach(([sc, o]) => out.push(view(S.current(sc, o))))
    S.reset(); out.push(view(S.setBase(base, type === 'leitura-video' ? LV('nate-claude-code-danger') : { type }) as never)); views()
    out.push(askView(S.ask('ia'))); views()
    out.push(askView(S.ask('todos'))); views()
    out.push(view(S.cancel('viagem'))); views()
    out.push(askView(S.ask(null, LV('luke-kfc')))); out.push(askView(S.ask('viagem', { type: 'temas' }))); views()
    out.push(askView(S.ask(null, LV('matt-opus55')))); out.push(askView(S.ask(null, LV('matt-gpt6-astra')))); views()
    out.push(view(S.cancel(null, LV('matt-opus55')))); out.push(askView(S.ask(null, LV('matt-gpt6-astra')))); views()
    S.reset()
    return out
  }
  const prod = createTestObservatory(ds)
  // the same with the session base stripped of stateNote/behind (DB-shaped rows)
  const stripped = createObservatory(ds, { testScenarios: (env: ScenarioEnv) => { const g = forjaScenarios(env); return { ...g, build: (st, t) => { const b = g.build(st, t); return b && { ...b, requests: strip(b.requests) } } } } })
  it.each(['sem pedido', ...gen.requestStates].flatMap(b => ['padroes-titulo', 'leitura-video'].map(t => [b, t] as const)))('base %s × %s', (base, type) => {
    const want = script(oracle.forja.session, base, type)
    expect(script(prod.forja.session as unknown as S, base, type)).toEqual(want)
    expect(script(stripped.forja.session as unknown as S, base, type)).toEqual(want)
  })
})

