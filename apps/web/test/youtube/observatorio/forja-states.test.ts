// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createClock } from '@/lib/youtube/observatorio/time'
import type { ForjaRequest, Niche, RequestState } from '@/lib/youtube/observatorio/types'
import { requestStateOf, statusLabel, summarize, machineOf, queueOrder, compose } from '@/lib/youtube/observatorio/forja/states'
import { quotaFor } from '@/lib/youtube/observatorio/forja/quota'
import { createSession } from '@/lib/youtube/observatorio/forja/session'

// Every test runs at 24/10 15:02 in São Paulo (the mockup's NOW); fixtures are relative to it.
const probe = createClock(0, 0, 0)
const NOW = probe.sp(2026, 10, 24, 15, 2)
const clock = createClock(NOW, NOW - 30 * 864e5, NOW - 30 * 864e5)
const T = (h: number, mi: number) => clock.sp(2026, 10, 24, h, mi)
const iso = (ms: number) => new Date(ms).toISOString()
const minAgo = (m: number) => iso(NOW - m * 6e4)
const alive = machineOf(T(14, 55), clock)
const dead = machineOf(T(12, 55), clock)

const row = (o: Partial<Parameters<typeof requestStateOf>[0]>): Parameters<typeof requestStateOf>[0] => ({
  status: 'pending', retry_count: 0, requested_at: minAgo(4), started_at: null, completed_at: null, failed_at: null, refused_at: null, released_at: null, ...o,
})
const req = (state: RequestState, o: Partial<ForjaRequest> = {}, niche: Niche = 'ia'): ForjaRequest => ({
  id: 'req-' + niche + '-' + state, type: 'padroes-titulo', niche, target: { kind: 'niche', niche, fmt: 'long' }, state,
  createdAt: T(14, 58), claimedAt: null, startedAt: null, publishedAt: null, failedAt: null, attempt: 1, maxAttempts: 3,
  refusedReason: null, readingId: null, ...o,
})

describe('requestStateOf — DB row → state (CONVENCOES "Fila")', () => {
  const m = { lastPollAt: T(14, 55) }
  it.each([
    ['pending 4 min, machine alive', row({}), m, 'na fila'],
    ['pending 32 min, machine alive', row({ requested_at: minAgo(32) }), m, 'atrasado'],
    ['pending, last poll 2 h ago', row({}), { lastPollAt: NOW - 2 * 36e5 }, 'sem máquina'],
    ['pending, no heartbeat ever', row({}), { lastPollAt: null }, 'sem máquina'],
    ['pending for more than 24 h, machine alive', row({ requested_at: iso(NOW - 25 * 36e5) }), m, 'sem máquina'],
    ['running', row({ status: 'running', started_at: minAgo(10) }), m, 'trabalhando'],
    ['pending, released by the vigia, retry 1', row({ retry_count: 1, released_at: minAgo(6) }), m, 'liberado pelo vigia'],
    ['pending, retry 1, no released_at', row({ retry_count: 1 }), m, 'nova tentativa'],
    ['refused', row({ status: 'refused', refused_at: minAgo(6) }), m, 'recusado (dado velho)'],
    ['failed', row({ status: 'failed', failed_at: minAgo(30) }), m, 'falhou'],
    ['completed', row({ status: 'completed', completed_at: minAgo(12) }), m, 'publicado'],
  ] as const)('%s → %s', (_n, task, machine, want) => {
    expect(requestStateOf(task, machine, NOW)).toBe(want)
  })
  it('an unknown status throws instead of guessing a state', () => {
    expect(() => requestStateOf(row({ status: 'weird' }), m, NOW)).toThrow(/weird/)
  })
})

describe('statusLabel — the ONLY header format (CONVENCOES line 218)', () => {
  it.each([
    [req('na fila', { createdAt: T(14, 58) }), alive, 'na fila · pedido 14:58'],
    [req('trabalhando', { createdAt: T(14, 41), claimedAt: T(14, 45), startedAt: T(14, 45) }), alive, 'trabalhando desde 14:45'],
    [req('atrasado', { createdAt: T(14, 33) }), alive, 'atrasado · pedido 14:33'],
    [req('sem máquina', { createdAt: T(14, 48) }), dead, 'sem máquina desde 12:55'],
    [req('nova tentativa', { createdAt: T(14, 42), releasedAt: T(14, 57), attempt: 2 }), alive, 'nova tentativa · 15:05'],
    [req('liberado pelo vigia', { createdAt: T(14, 5), releasedAt: T(14, 56), attempt: 2 }), alive, 'liberado pelo vigia · 15:05'],
    [req('falhou', { createdAt: T(13, 50), failedAt: T(14, 21), attempt: 3 }), alive, 'falhou às 14:21'],
    [req('recusado (dado velho)', { createdAt: T(14, 50), refusedAt: T(14, 56) }), alive, 'recusado às 14:56'],
    [req('publicado', { createdAt: T(14, 31), publishedAt: T(14, 50) }), alive, 'publicado às 14:50'],
  ] as const)('%#: %s', (r, machine, want) => {
    expect(statusLabel(r, clock, { machine })).toBe(want)
  })
  it('a request behind another active one gets the queue suffix; the niche prefix is optional', () => {
    const ahead = req('trabalhando', { claimedAt: T(14, 45) }, 'ia')
    const me = req('na fila', { createdAt: T(14, 41) }, 'viagem')
    expect(statusLabel(me, clock, { machine: alive, ahead })).toBe('na fila · pedido 14:41 (atrás do de IA)')
    expect(statusLabel(me, clock, { machine: alive, prefixNiche: true })).toBe('Viagem: na fila · pedido 14:41')
  })
})

describe('summarize — canonical texts', () => {
  it('"sem máquina" with one niche: the singular sentence', () => {
    const sc = summarize([req('sem máquina', { createdAt: T(14, 48) })], dead, false, clock)
    expect(sc.statusText).toBe('Seu pedido das 14:48 está na fila e roda quando a máquina voltar.')
    expect(sc.statusLabel).toBe('sem máquina desde 12:55')
    expect(sc.statusLines).toBeNull()
  })
  it('"sem máquina" with Todos: the plural sentence naming both niches', () => {
    const sc = summarize([
      req('sem máquina', { createdAt: T(14, 48) }, 'ia'),
      req('sem máquina', { createdAt: T(14, 48), stateNote: 'atrás do de IA', behind: 'req-ia-sem máquina' }, 'viagem'),
    ], dead, true, clock)
    expect(sc.statusText).toBe('Seus pedidos das 14:48 (IA e Viagem) estão na fila e rodam quando a máquina voltar.')
    expect(sc.statusLines).toEqual(['IA: sem máquina desde 12:55', 'Viagem: sem máquina desde 12:55 (atrás do de IA)'])
    expect(sc.split).toBe(true)
  })
  it('a finished request with another still active is not terminal: "pedido em andamento"', () => {
    const sc = summarize([
      req('publicado', { createdAt: T(14, 31), claimedAt: T(14, 35), publishedAt: T(14, 50) }, 'ia'),
      req('trabalhando', { createdAt: T(14, 31), claimedAt: T(14, 55), startedAt: T(14, 55) }, 'viagem'),
    ], alive, true, clock)
    expect(sc.statusLabel).toBe('pedido em andamento')
    expect(sc.terminal).toBe(false)
    expect(sc.anyActive).toBe(true)
    expect(sc.statusLines).toEqual(['Viagem: trabalhando desde 14:55', 'IA: publicado às 14:50'])
  })
  it('the input requests are never mutated', () => {
    const r = req('na fila')
    const before = structuredClone(r)
    summarize([r], alive, false, clock)
    expect(r).toEqual(before)
  })
})

describe('queueOrder — one machine, one queue', () => {
  it('active requests by createdAt first, finished ones after, stable', () => {
    const a = req('publicado', { createdAt: T(14, 0), publishedAt: T(14, 20) }, 'ia')
    const b = req('na fila', { createdAt: T(14, 58) }, 'viagem')
    const c = req('trabalhando', { createdAt: T(14, 41), claimedAt: T(14, 45) }, 'ia')
    expect(queueOrder([a, b, c]).map(q => q.state)).toEqual(['trabalhando', 'na fila', 'publicado'])
  })
})

describe('compose — a new request over what exists', () => {
  it('lands behind an active request of the other niche', () => {
    const base = summarize([req('trabalhando', { createdAt: T(14, 41), claimedAt: T(14, 45) })], alive, false, clock)
    const c = compose(base, { niche: 'viagem' }, {}, clock)
    expect(c.statusLines).toEqual(['IA: trabalhando desde 14:45', 'Viagem: na fila · pedido 15:02 (atrás do de IA)'])
  })
})

describe('quotaFor — 1 per niche + type per São Paulo day; failure and refusal do not count', () => {
  const midnight = clock.sp(2026, 10, 25, 0, 0)
  it('one completed today → not free, releases at the next SP midnight', () => {
    const q = quotaFor([req('publicado', { createdAt: T(14, 31), publishedAt: T(14, 50) })], 'padroes-titulo', 'ia', NOW, clock)
    expect(q).toMatchObject({ free: false, usedToday: 1, releasesAt: midnight, text: 'cota de hoje usada; libera domingo, 25/10 às 00:00' })
  })
  it('one failed today → free, and says the failure does not count', () => {
    const q = quotaFor([req('falhou', { createdAt: T(13, 50), failedAt: T(14, 21) })], 'padroes-titulo', 'ia', NOW, clock)
    expect(q.free).toBe(true)
    expect(q.usedToday).toBe(0)
    expect(q.text).toMatch(/falha não conta na cota/)
  })
  it('one refused today → free', () => {
    const q = quotaFor([req('recusado (dado velho)', { createdAt: T(14, 50), refusedAt: T(14, 56) })], 'padroes-titulo', 'ia', NOW, clock)
    expect(q.free).toBe(true)
    expect(q.text).toMatch(/recusa não conta na cota/)
  })
  it('yesterday, another niche or another type do not count', () => {
    const y = clock.sp(2026, 10, 23, 23, 50)
    const reqs = [req('publicado', { createdAt: y, publishedAt: y + 6e5 }), req('publicado', { publishedAt: T(14, 50) }, 'viagem'), req('publicado', { type: 'temas', publishedAt: T(14, 50) })]
    expect(quotaFor(reqs, 'padroes-titulo', 'ia', NOW, clock).free).toBe(true)
  })
})

describe('createSession — the ask planner', () => {
  const videos: Record<string, { niche: Niche; title: string }> = {
    'v-a': { niche: 'ia', title: 'Vídeo A' }, 'v-b': { niche: 'ia', title: 'Vídeo B' },
  }
  const opts = (capabilities: string[]) => ({
    capabilities, eligible: () => ({ in: ['c1'], out: [] }), videoOf: (id: string) => videos[id],
  })
  it('a type the machine has not announced → nothing sent, with the canonical reason', () => {
    const s = createSession([], alive, clock, opts(['temas']))
    const r = s.ask('ia', { type: 'padroes-titulo' })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('A forja ainda não lê pedidos do observatório.')
    expect(s.current('ia', { type: 'padroes-titulo' }).empty).toBe(true)
  })
  it('an active video reading of IA blocks another IA video, naming it', () => {
    const s = createSession([], alive, clock, opts(['leitura-video']))
    expect(s.ask(null, { type: 'leitura-video', video: 'v-a' }).ok).toBe(true)
    const r = s.ask(null, { type: 'leitura-video', video: 'v-b' })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/leitura de vídeo de IA em andamento/)
    const b = s.current('ia', { type: 'leitura-video', video: 'v-b' })
    expect(b.blockedBy).toMatchObject({ video: 'v-a', title: 'Vídeo A', statusLabel: 'na fila · pedido 15:02' })
    expect(b.blockedBy?.reason).toBe('Nada enviado: já há uma leitura de vídeo de IA na fila · pedido 15:02, do vídeo “Vídeo A”.')
  })
  it('asks only free niches, in click order; a published request uses the quota', () => {
    const pub = req('publicado', { createdAt: T(14, 31), claimedAt: T(14, 35), publishedAt: T(14, 50) }, 'ia')
    const s = createSession([pub], alive, clock, opts(['padroes-titulo']))
    const r = s.ask('todos', { type: 'padroes-titulo' })
    expect(r.results).toEqual([
      { niche: 'ia', ok: false, reason: 'cota de hoje usada para IA (libera domingo, 25/10 às 00:00)' },
      expect.objectContaining({ niche: 'viagem', ok: true }),
    ])
    expect(r.scenario.statusLines).toEqual(['Viagem: na fila · pedido 15:02', 'IA: publicado às 14:50'])
  })
  it('history of past days never blocks today', () => {
    const y = clock.sp(2026, 10, 20, 6, 10)
    const s = createSession([req('publicado', { createdAt: y, publishedAt: y })], alive, clock, opts(['padroes-titulo']))
    expect(s.ask('ia', { type: 'padroes-titulo' }).ok).toBe(true)
  })
  it('cancel removes the active request and whoever was behind it loses the suffix', () => {
    const s = createSession([], alive, clock, opts(['padroes-titulo']))
    s.ask('ia', { type: 'padroes-titulo' }); s.ask('viagem', { type: 'padroes-titulo' })
    expect(s.current('viagem', { type: 'padroes-titulo' }).statusLabel).toBe('na fila · pedido 15:02 (atrás do de IA)')
    const c = s.cancel('ia', { type: 'padroes-titulo' })
    expect(c.empty).toBe(true)
    expect(s.current('todos', { type: 'padroes-titulo' }).statusLines).toEqual(['Viagem: na fila · pedido 15:02'])
  })
})
