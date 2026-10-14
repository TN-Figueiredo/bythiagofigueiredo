// @vitest-environment node
// E5b Tarefa 20b: os testes do A/B Lab de um vídeo (guarda, escopo, tetos, status, datas, ciclos).
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { leituraDe } from './leitura-teste'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { lerTestesAb, TETO_TESTES_AB, TETO_CICLOS_AB } from '@/lib/youtube/observatorio/proprio/ler-testes-ab'
import { ObservatoryLoadError } from '@/lib/youtube/observatorio/niches-db'
import { dayPt } from '@/lib/youtube/coleta/day-pt'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const S = 'site-a', C = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10', V = '9a1d2c3e-4b5f-4a6b-8c7d-0e1f2a3b4c5d', HOJE = dayPt(new Date())
let leitura: LeituraPrivadaDoSite
beforeAll(async () => { leitura = await leituraDe(S) })
const ped = () => ({ leitura, canalId: C, hoje: HOJE, videoUuid: V })
const teste = (id: string, over: Row = {}): Row => ({
  id, site_id: S, youtube_video_id: V, test_type: 'thumbnail', status: 'completed', started_at: '2026-09-01T10:00:00+00:00', paused_at: null,
  completed_at: '2026-09-05T10:00:00+00:00', completed_reason: 'auto_resolve', winner_applied_at: null, original_title: 'Titulo original', ...over,
})
const ciclo = (testId: string, n: number, over: Row = {}): Row => ({ id: `c-${testId}-${n}`, test_id: testId, cycle_number: n, started_at: `2026-09-0${n}T10:00:00+00:00`, ended_at: `2026-09-0${n}T20:00:00+00:00`, ...over })
const ok = async (db: ReturnType<typeof fakeSupabase>, over: Partial<ReturnType<typeof ped>> = {}) => {
  const r = await lerTestesAb(db.client, { ...ped(), ...over })
  if (r.acesso !== 'ok') throw new Error('esperava ok, veio ' + r.acesso)
  return r.dado
}

describe('E5b T20b: lerTestesAb', () => {
  it('sem token: negado e zero consultas', async () => {
    const db = fakeSupabase({ ab_tests: [teste('t1')], ab_test_cycles: [] })
    expect(await lerTestesAb(db.client, { ...ped(), leitura: null })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('token forjado (objeto com siteId que não veio da guarda): negado e zero consultas', async () => {
    const db = fakeSupabase({ ab_tests: [teste('t1')], ab_test_cycles: [] })
    // @ts-expect-error literal não é um LeituraPrivadaDoSite
    const forjado: LeituraPrivadaDoSite = { siteId: S }
    expect(await lerTestesAb(db.client, { ...ped(), leitura: forjado })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('uuid do vídeo malformado e canal que não é uuid: negado sem consultar', async () => {
    const db = fakeSupabase({ ab_tests: [teste('t1')], ab_test_cycles: [] })
    expect(await lerTestesAb(db.client, { ...ped(), videoUuid: 'nao-e-uuid' })).toEqual({ acesso: 'negado' })
    expect(await lerTestesAb(db.client, { ...ped(), canalId: 'nao-e-uuid' })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('vídeo sem teste: lista vazia e UMA consulta (a dos ciclos não roda)', async () => {
    const db = fakeSupabase({ ab_tests: [], ab_test_cycles: [ciclo('t1', 1)] })
    expect(await ok(db)).toEqual({ testes: [], descartados: 0 })
    expect(db.trips).toEqual(['ab_tests'])
  })
  it('rascunho sem started_at não vem (e não conta como descartado)', async () => {
    const db = fakeSupabase({ ab_tests: [teste('t1'), teste('t2', { status: 'draft', started_at: null })], ab_test_cycles: [] })
    const d = await ok(db)
    expect(d.testes.map(t => t.id)).toEqual(['t1'])
    expect(d.descartados).toBe(0)
  })
  it('dois testes, cinco e três ciclos: cada ciclo no seu teste, em ordem', async () => {
    const t1 = Array.from({ length: 5 }, (_, i) => ciclo('t1', 5 - i)), t2 = [ciclo('t2', 3), ciclo('t2', 1), ciclo('t2', 2)]
    const db = fakeSupabase({ ab_tests: [teste('t1'), teste('t2', { started_at: '2026-09-10T10:00:00+00:00' })], ab_test_cycles: [...t1, ...t2] })
    const d = await ok(db)
    expect(d.testes.map(t => [t.id, t.ciclos.map(c => c.n)])).toEqual([['t1', [1, 2, 3, 4, 5]], ['t2', [1, 2, 3]]])
    expect(d.testes[0]!.ciclos[0]).toEqual({ n: 1, inicio: '2026-09-01T10:00:00.000Z', fim: '2026-09-01T20:00:00.000Z' })
  })
  it('teste de outro site com o mesmo vídeo não vem; teste de outro vídeo também não', async () => {
    const db = fakeSupabase({ ab_tests: [teste('t1'), teste('t2', { site_id: 'outro' }), teste('t3', { youtube_video_id: '11111111-2222-4333-8444-555555555555' })], ab_test_cycles: [] })
    expect((await ok(db)).testes.map(t => t.id)).toEqual(['t1'])
  })
  it('51 testes: lança; 50: lê', async () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => teste('t' + String(i).padStart(3, '0'), { started_at: `2026-0${1 + (i % 8)}-${String(1 + i % 28).padStart(2, '0')}T10:00:00+00:00` }))
    await expect(lerTestesAb(fakeSupabase({ ab_tests: mk(TETO_TESTES_AB + 1), ab_test_cycles: [] }).client, ped())).rejects.toBeInstanceOf(ObservatoryLoadError)
    expect((await ok(fakeSupabase({ ab_tests: mk(TETO_TESTES_AB), ab_test_cycles: [] }))).testes).toHaveLength(TETO_TESTES_AB)
  })
  it('ciclos acima do teto: lança, nunca corta; no teto: lê', async () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ciclo('t1', i + 1, { id: 'c' + String(i).padStart(5, '0'), started_at: '2026-09-01T10:00:00Z', ended_at: null }))
    await expect(lerTestesAb(fakeSupabase({ ab_tests: [teste('t1')], ab_test_cycles: mk(TETO_CICLOS_AB + 1) }).client, ped())).rejects.toBeInstanceOf(ObservatoryLoadError)
    expect((await ok(fakeSupabase({ ab_tests: [teste('t1')], ab_test_cycles: mk(TETO_CICLOS_AB) }))).testes[0]!.ciclos).toHaveLength(TETO_CICLOS_AB)
  })
  it('ciclo com started_at ou ended_at inválido: descartado e contado; teste com completed_at ou started_at inválido: descartado e contado', async () => {
    const db = fakeSupabase({
      ab_tests: [teste('t1'), teste('t2', { completed_at: 'lixo' }), teste('t3', { started_at: 'lixo' }), teste('t4', { winner_applied_at: 'lixo' }), teste('t5', { paused_at: 'lixo' })],
      ab_test_cycles: [ciclo('t1', 1), ciclo('t1', 2, { started_at: 'lixo' }), ciclo('t1', 3, { ended_at: 'lixo' })],
    })
    const d = await ok(db)
    expect(d.testes.map(t => t.id)).toEqual(['t1'])
    expect(d.testes[0]!.ciclos.map(c => c.n)).toEqual([1])
    expect(d.descartados).toBe(4 + 2)
  })
  it('um teste por combinação de status: o status chega como veio', async () => {
    const db = fakeSupabase({
      ab_tests: [
        teste('a', { status: 'active', completed_at: null, completed_reason: null, started_at: '2026-09-01T00:00:00Z' }),
        teste('p', { status: 'paused', completed_at: null, paused_at: '2026-09-03T00:00:00Z', started_at: '2026-09-02T00:00:00Z' }),
        teste('c', { status: 'completed', winner_applied_at: '2026-09-06T00:00:00Z', started_at: '2026-09-03T00:00:00Z' }),
        teste('r', { status: 'archived', completed_at: null, completed_reason: null, started_at: '2026-09-04T00:00:00Z' }),
      ],
      ab_test_cycles: [],
    })
    const t = (await ok(db)).testes
    expect(t.map(x => [x.id, x.status, x.pausadoEm, x.concluidoEm !== null, x.vencedorAplicadoEm !== null, x.motivo])).toEqual([
      ['a', 'active', null, false, false, null],
      ['p', 'paused', '2026-09-03T00:00:00.000Z', false, false, 'auto_resolve'],
      ['c', 'completed', null, true, true, 'auto_resolve'],
      ['r', 'archived', null, false, false, null],
    ])
  })
  it('status ou tipo fora da lista: descartado e contado', async () => {
    const db = fakeSupabase({ ab_tests: [teste('t1'), teste('t2', { status: 'novo_status' }), teste('t3', { test_type: 'video' })], ab_test_cycles: [] })
    const d = await ok(db)
    expect(d.testes.map(t => t.id)).toEqual(['t1'])
    expect(d.descartados).toBe(2)
  })
  it('as consultas pedem só colunas conhecidas e status entre elas', async () => {
    const db = fakeSupabase({ ab_tests: [teste('t1')], ab_test_cycles: [ciclo('t1', 1)] })
    await ok(db)
    expect(db.selects.every(s => s.cols !== '*')).toBe(true)
    expect(db.selects.find(s => s.table === 'ab_tests')!.cols).toContain('status')
  })
  it('erro de banco é lançado (nos testes e nos ciclos)', async () => {
    await expect(lerTestesAb(fakeSupabase({ ab_tests: [teste('t1')], ab_test_cycles: [] }, { failOn: 'ab_tests' }).client, ped())).rejects.toBeInstanceOf(ObservatoryLoadError)
    await expect(lerTestesAb(fakeSupabase({ ab_tests: [teste('t1')], ab_test_cycles: [] }, { failOn: 'ab_test_cycles' }).client, ped())).rejects.toBeInstanceOf(ObservatoryLoadError)
  })
})
