// @vitest-environment node
/** F4 T7: titulo-complementar no serviço da fila (cliente PostgREST falso, como forja-queue.test.ts). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceContext } from '@/lib/pipeline/services/types'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
const H = vi.hoisted(() => ({
  OBS_NOW: Date.parse('2026-10-29T15:00:00Z'), caps: { v: ['titulo-complementar'] as string[] }, OWN_CH: 'ch-own',
  OWN_VID: '33333333-3333-4333-8333-333333333333', OWN_VID_2: '33333333-3333-4333-8333-333333333334',
  SIG: '55555555-5555-4555-8555-555555555555', T1: '66666666-6666-4666-8666-666666666661',
}))
const { OBS_NOW, OWN_CH, OWN_VID, OWN_VID_2, SIG, T1 } = H
vi.mock('@/lib/youtube/observatorio/load', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/youtube/observatorio/load')>()),
  loadDataset: vi.fn(async () => ({ queue: { lastPollAt: H.OBS_NOW - 60_000, tickMinutes: 10, capabilities: H.caps.v } })),
}))
vi.mock('@/lib/youtube/observatorio', async () => {
  const { createClock } = await import('@/lib/youtube/observatorio/time')
  const { BUILTIN_NICHES, nicheLabel } = await import('@/lib/youtube/observatorio/niche')
  const vids: Record<string, { id: string; ch: string; title: string }> = {
    [H.OWN_VID]: { id: H.OWN_VID, ch: H.OWN_CH, title: 'Vietnã em 3 dias' }, [H.OWN_VID_2]: { id: H.OWN_VID_2, ch: H.OWN_CH, title: 'Outro vídeo' },
    t1: { id: 't1', ch: 'ch-t1', title: 'Da Nang: 10 praias' }, t2: { id: 't2', ch: 'ch-t2', title: 'O que ninguém conta' },
  }
  const chs: Record<string, { own: boolean; niche: string | null; name: string }> = {
    [H.OWN_CH]: { own: true, niche: 'viagem', name: 'Eu' }, 'ch-t1': { own: false, niche: 'viagem', name: 'Canal 1' }, 'ch-t2': { own: false, niche: null, name: 'Canal 2' },
  }
  return { createObservatory: () => ({
    date: createClock(H.OBS_NOW, H.OBS_NOW - 30 * 864e5, H.OBS_NOW - 30 * 864e5), niches: BUILTIN_NICHES, nicheLabel: (n: string) => nicheLabel(BUILTIN_NICHES, n),
    scopeOf: (n: string) => n, video: (id: string) => vids[id], channel: (id: string) => chs[id],
    forja: { planOpts: { capabilities: H.caps.v, eligible: () => ({ in: [], out: [] }), novidade: () => ({ pode: true, porque: 'sem-leitura' }) } },
  }) }
})

import { askReading, cancelReading, completeReading, claimFilter, readSent } from '@/lib/pipeline/services/forja-queue'

interface Op { op: string; args: unknown[] }
interface Query { table: string; ops: Op[] }
interface Res { data: unknown; error: unknown }
function fakeClient(respond: (q: Query) => Res) {
  const queries: Query[] = []
  const client = { from(table: string) {
    const q: Query = { table, ops: [] }; queries.push(q)
    const b: object = new Proxy({}, { get(_t, prop) {
      if (prop === 'then') return (ok: (v: Res) => unknown, ko: (e: unknown) => unknown) => Promise.resolve().then(() => respond(q)).then(ok, ko)
      if (prop === 'maybeSingle' || prop === 'single') return () => { q.ops.push({ op: String(prop), args: [] }); return Promise.resolve().then(() => respond(q)) }
      return (...args: unknown[]) => { q.ops.push({ op: String(prop), args }); return b }
    } })
    return b
  } }
  return { client: client as unknown as SupabaseClient, queries }
}
const has = (q: Query, op: string, ...args: unknown[]) => q.ops.some(o => o.op === op && JSON.stringify(o.args.slice(0, args.length)) === JSON.stringify(args))
const insertOf = (qs: Query[]) => qs.find(q => q.table === 'youtube_intelligence_tasks' && q.ops.some(o => o.op === 'insert'))
const ctxOf = (supabase: SupabaseClient): ServiceContext => ({ siteId: 'site-1', permissions: ['read', 'intelligence'], keyId: 'key-forja', supabase, source: 'api_key' })
const USER = '77777777-7777-4777-8777-777777777777'
const evidence = { outliers: [
  { video_id: 't1', canal_id: 'ch-t1', published_at: 'x', mult_vpd7: 9, mult_tela: 9, vpd7: 1500, formato: 'long' },
  { video_id: 't2', canal_id: 'ch-t2', published_at: 'x', mult_vpd7: 5, mult_tela: 5, vpd7: 900, formato: 'long' },
  { video_id: 'gone', canal_id: 'ch-x', published_at: 'x', mult_vpd7: 4, mult_tela: 4, vpd7: 800, formato: 'long' },
], outliers_total: 3, canais: 2, proprios: [] }

interface World { signal?: unknown; active?: unknown[]; last?: unknown[]; insert?: Res }
function world(w: World = {}) {
  const f = fakeClient(q => {
    if (q.table === 'niche_signals') return { data: w.signal === undefined ? { id: SIG, subject_key: 'pais:vn', status: 'aberto', evidence } : w.signal, error: null }
    if (q.table === 'competitor_readings') return { data: w.last ?? [], error: null }
    if (q.table === 'youtube_intelligence_tasks') {
      if (q.ops.some(o => o.op === 'insert')) return w.insert ?? { data: { id: T1 }, error: null }
      if (q.ops.some(o => o.op === 'in' && o.args[0] === 'status')) return { data: w.active ?? [], error: null }
      return { data: [], error: null }
    }
    return { data: null, error: null }
  })
  return f
}
const ask = (f: ReturnType<typeof world>, over: Record<string, unknown> = {}) =>
  askReading(ctxOf(f.client), { type: 'titulo-complementar', scope: 'todos', ownVideoId: OWN_VID, signalId: SIG, userId: USER, ...over } as never, OBS_NOW)

beforeEach(() => { vi.clearAllMocks(); H.caps.v = ['titulo-complementar'] })

describe('askReading titulo-complementar', () => {
  it('recusa sem ownVideoId/signalId ou com videoId de terceiro (400, nada gravado)', async () => {
    for (const over of [{ ownVideoId: undefined }, { signalId: undefined }, { videoId: OWN_VID }]) {
      const f = world()
      await expect(ask(f, over)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
      expect(insertOf(f.queries)).toBeUndefined()
    }
  })
  it('grava o par vídeo nosso x sinal, o nicho do canal do outlier mais forte e os outliers congelados no sent', async () => {
    const f = world(); const r = await ask(f)
    expect(r.data?.ok).toBe(true)
    const ins = insertOf(f.queries)!.ops.find(o => o.op === 'insert')!.args[0] as Record<string, unknown>
    expect(ins).toMatchObject({ task_type: 'titulo-complementar', target_niche: 'viagem', target_own_video_id: OWN_VID, target_signal_id: SIG, status: 'pending' })
    const pedido = (ins.sent as { pedido: { lugar: string; outliers: Array<{ video_id: string; titulo: string }> } }).pedido
    expect(pedido.lugar).toBe('Vietnã')
    expect(pedido.outliers.map(o => o.video_id)).toEqual(['t1', 't2'])   // 'gone' não existe mais: fica de fora
    expect(pedido.outliers[0]!.titulo).toBe('Da Nang: 10 praias')
  })
  it('dois vídeos nossos diferentes do mesmo nicho passam', async () => {
    expect((await ask(world())).data?.ok).toBe(true)
    expect((await ask(world(), { ownVideoId: OWN_VID_2 })).data?.ok).toBe(true)
  })
  it('o mesmo vídeo x sinal ativo volta "já há um pedido"; a corrida (23505) também', async () => {
    const a = await ask(world({ active: [{ id: T1 }] }))
    expect(a.data?.ok).toBe(false); expect(a.data?.reason).toMatch(/já há um pedido/)
    const f = world({ insert: { data: null, error: { code: '23505', message: 'dup' } } })
    const b = await ask(f)
    expect(b.data?.ok).toBe(false); expect(b.data?.reason).toMatch(/já há um pedido/)
  })
  it('sem dado novo desde a última leitura do mesmo vídeo x sinal: nega e não grava', async () => {
    const f = world({ last: [{ sent: { titulo_complementar: { outlier_ids: ['t2', 't1'], titulo_alvo: 'Vietnã em 3 dias' } } }] })
    const r = await ask(f)
    expect(r.data?.ok).toBe(false); expect(r.data?.reason).toMatch(/dado mais recente/)
    expect(insertOf(f.queries)).toBeUndefined()
  })
  it('sem nicho derivável do sinal: recusa ANTES de gravar', async () => {
    const f = world({ signal: { id: SIG, subject_key: 'pais:vn', status: 'aberto', evidence: { ...evidence, outliers: [evidence.outliers[1]] } } })
    const r = await ask(f)
    expect(r.data?.ok).toBe(false); expect(r.data?.reason).toMatch(/nicho/)
    expect(insertOf(f.queries)).toBeUndefined()
  })
  it('sinal fechado ou ausente: recusa; forja sem a capacidade: recusa', async () => {
    expect((await ask(world({ signal: { id: SIG, subject_key: 'pais:vn', status: 'dispensado', evidence } }))).data?.ok).toBe(false)
    expect((await ask(world({ signal: null }))).data?.ok).toBe(false)
    H.caps.v = ['temas']
    const f = world(); const r = await ask(f)
    expect(r.data?.ok).toBe(false); expect(insertOf(f.queries)).toBeUndefined()
  })
})

describe('cancelReading titulo-complementar (R2-Y1)', () => {
  it('filtra pelo par vídeo x sinal além do nicho: o pendente de outro vídeo permanece', async () => {
    const f = fakeClient(() => ({ data: [{ id: T1 }], error: null }))
    const r = await cancelReading(ctxOf(f.client), { type: 'titulo-complementar', niche: 'viagem', ownVideoId: OWN_VID, signalId: SIG })
    expect(r.data?.cancelled).toBe(true)
    const q = f.queries[0]!
    expect(has(q, 'eq', 'target_own_video_id', OWN_VID)).toBe(true)
    expect(has(q, 'eq', 'target_signal_id', SIG)).toBe(true)
    expect(has(q, 'eq', 'status', 'pending')).toBe(true)
  })
  it('C-P7: o nicho nem entra no filtro (o par é único): cancela mesmo se o nicho do pedido mudou, e sem nicho', async () => {
    const f = fakeClient(() => ({ data: [{ id: T1 }], error: null }))
    const r = await cancelReading(ctxOf(f.client), { type: 'titulo-complementar', ownVideoId: OWN_VID, signalId: SIG })
    expect(r.data?.cancelled).toBe(true)
    expect(f.queries[0]!.ops.some(o => o.op === 'eq' && o.args[0] === 'target_niche')).toBe(false)
  })
  it('leitura-video continua exigindo nicho', async () => {
    const f = fakeClient(() => ({ data: [], error: null }))
    await expect(cancelReading(ctxOf(f.client), { type: 'leitura-video', videoId: OWN_VID } as never)).rejects.toMatchObject({ status: 400 })
  })
  it('sem ownVideoId/signalId: 400, nada apagado', async () => {
    const f = fakeClient(() => ({ data: [], error: null }))
    await expect(cancelReading(ctxOf(f.client), { type: 'titulo-complementar', niche: 'viagem' })).rejects.toMatchObject({ status: 400 })
    expect(f.queries).toHaveLength(0)
  })
})

describe('claim e conclusão', () => {
  it('o filtro do claim leva o tipo novo quando a forja o anuncia', () => {
    expect(claimFilter([], ['titulo-complementar'])).toContain('task_type.in.(titulo-complementar)')
  })
  const frozen = { text: 't', ids: [OWN_VID, 't1'], numbers: ['3', '9×'], titulo_complementar: { normalizados_proprios: ['vietna em 3 dias'], normalizados_outliers: ['da nang 10 praias'], outlier_ids: ['t1'], titulo_alvo: 'x' } }
  const held = (sent: unknown) => ({ id: T1, status: 'running', task_type: 'titulo-complementar', target_niche: 'viagem', target_video_id: null, target_own_video_id: OWN_VID, target_signal_id: SIG, target_fmt: null, result_summary: { claimed_by: 'key-forja' }, started_at: 'x', sent })
  const sub = (items: string[]) => ({ task_id: T1, model: 'gemma', generated_at: '2026-10-29T12:00:00-03:00', text: { lead: '', items } })
  it('título repetido: a tarefa é recusada com o motivo e a resposta é 400, sem gravar leitura', async () => {
    const f = fakeClient(q => ({ data: q.table === 'youtube_intelligence_tasks' && q.ops.some(o => o.op === 'select') && !q.ops.some(o => o.op === 'update') ? held(frozen) : { id: T1, status: 'refused' }, error: null }))
    await expect(completeReading(ctxOf(f.client), sub(['Vietnã em 3 dias']), OBS_NOW)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/repetido/) })
    expect(f.queries.some(q => q.table === 'competitor_readings')).toBe(false)
    const upd = f.queries.find(q => q.ops.some(o => o.op === 'update'))!
    expect((upd.ops.find(o => o.op === 'update')!.args[0] as { refused_reason: string }).refused_reason).toBe('validador-repetido')
  })
  it('C-P6: a recusa do validador guarda os títulos recusados (<= 5, cortados a 100) em result_summary.recusados', async () => {
    const f = fakeClient(q => ({ data: q.table === 'youtube_intelligence_tasks' && q.ops.some(o => o.op === 'select') && !q.ops.some(o => o.op === 'update') ? held(frozen) : { id: T1, status: 'refused' }, error: null }))
    const longo = 'x'.repeat(130)
    await expect(completeReading(ctxOf(f.client), sub(['Vietnã em 3 dias', longo]), OBS_NOW)).rejects.toMatchObject({ status: 400 })
    const upd = f.queries.find(q => q.ops.some(o => o.op === 'update'))!
    const rs = (upd.ops.find(o => o.op === 'update')!.args[0] as { result_summary: { recusados: string[]; claimed_by: string } }).result_summary
    expect(rs.recusados).toEqual(['Vietnã em 3 dias', 'x'.repeat(100)])
    expect(rs.claimed_by).toBe('key-forja')
  })
  it('títulos válidos: a leitura grava own_video_id e signal_id', async () => {
    const f = fakeClient(q => {
      if (q.table === 'competitor_readings') return { data: { id: 'r1' }, error: null }
      if (q.ops.some(o => o.op === 'update')) return { data: { id: T1 }, error: null }
      return { data: held(frozen), error: null }
    })
    const r = await completeReading(ctxOf(f.client), sub(['Hoi An em 3 dias']), OBS_NOW)
    expect(r.data?.readingId).toBe('r1')
    const ins = f.queries.find(q => q.table === 'competitor_readings')!.ops.find(o => o.op === 'insert')!.args[0] as Record<string, unknown>
    expect(ins).toMatchObject({ task_type: 'titulo-complementar', own_video_id: OWN_VID, signal_id: SIG })
  })
  it('sent só com o contexto do pedido (sem numbers) ainda não foi lido: TASK_NOT_READY', async () => {
    const f = fakeClient(() => ({ data: held({ pedido: { subject_key: 'pais:vn', lugar: 'Vietnã', outliers: [] } }), error: null }))
    await expect(completeReading(ctxOf(f.client), sub(['Hoi An em 3 dias']), OBS_NOW)).rejects.toMatchObject({ status: 409, code: 'TASK_NOT_READY' })
  })
})

describe('readSent titulo-complementar (C-Y4)', () => {
  const heldRun = (sent: unknown) => ({ id: T1, status: 'running', task_type: 'titulo-complementar', target_niche: 'viagem', target_video_id: null, target_own_video_id: OWN_VID, target_signal_id: SIG, target_fmt: null, result_summary: { claimed_by: 'key-forja' }, started_at: 'x', sent })
  it('sent já congelado (com numbers): devolve a cópia e NÃO faz update nem lê o dataset do vídeo', async () => {
    const congelado = { text: 't', ids: [], numbers: ['3'], titulo_complementar: {} }
    const f = fakeClient(() => ({ data: heldRun(congelado), error: null }))
    const r = await readSent(ctxOf(f.client), T1, OBS_NOW)
    expect(r.data.sent).toEqual(congelado)
    expect(f.queries.some(q => q.ops.some(o => o.op === 'update'))).toBe(false)
    expect(f.queries.some(q => q.table === 'youtube_videos')).toBe(false)
  })
  it('vídeo nosso apagado: 422 TARGET_UNAVAILABLE, nada congelado; a leitura do vídeo filtra pelo site', async () => {
    const f = fakeClient(q => q.table === 'youtube_intelligence_tasks' ? { data: heldRun({ pedido: { subject_key: 'pais:vn', lugar: 'Vietnã', outliers: [] } }), error: null } : { data: null, error: null })
    await expect(readSent(ctxOf(f.client), T1, OBS_NOW)).rejects.toMatchObject({ status: 422, code: 'TARGET_UNAVAILABLE' })
    expect(f.queries.some(q => q.ops.some(o => o.op === 'update'))).toBe(false)
    const v = f.queries.find(q => q.table === 'youtube_videos')!
    expect(has(v, 'eq', 'site_id', 'site-1')).toBe(true)
  })
})
