// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fakePostgrest } from '../helpers/fake-postgrest'

const sentry = vi.hoisted(() => ({ captureMessage: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)

import { lerDiasDosTestes, lerDiasDoTeste, LOTE_DE_IDS, TETO_LINHAS_POR_TESTE } from '@/lib/youtube/ab-gravacao/placar-leitura'

type Row = Record<string, unknown>
function dia(testId: string, dayPt: string, extra: Row = {}, siteId = 'site-1'): Row {
  return {
    test_id: testId, day_pt: dayPt, site_id: siteId, variant_id: 'v-a', motivo_sem_variante: null,
    alcance_estado: 'medido', impressoes: 100, ctr: 0.04, views: 4, views_estado: 'medido',
    retratado_em: '2026-10-01T10:00:00Z', final: false, ...extra,
  }
}
const sb = (f: ReturnType<typeof fakePostgrest>) => f.client as unknown as SupabaseClient
const ids = (n: number) => Array.from({ length: n }, (_, i) => `t-${String(i).padStart(3, '0')}`)

describe('placar-leitura (fake-postgrest)', () => {
  beforeEach(() => sentry.captureMessage.mockClear())

  it('constantes do plano', () => {
    expect(LOTE_DE_IDS).toBe(100)
    expect(TETO_LINHAS_POR_TESTE).toBe(60)
  })

  it('20 ids: 1 consulta, filtros in + eq site_id, ordem test_id e day_pt', async () => {
    const t = ids(20)
    const f = fakePostgrest({ tables: { ab_test_dias: t.map(x => dia(x, '2026-10-01')) } })
    const r = await lerDiasDosTestes(sb(f), 'site-1', t)
    expect(r.ok).toBe(true)
    const qs = f.on('ab_test_dias')
    expect(qs).toHaveLength(1)
    expect(qs[0]!.filters).toContainEqual({ op: 'in', col: 'test_id', value: t })
    expect(qs[0]!.filters).toContainEqual({ op: 'eq', col: 'site_id', value: 'site-1' })
    expect(qs[0]!.orders.map(o => o.col)).toEqual(['test_id', 'day_pt'])
  })

  it('150 ids: 2 consultas (100 + 50), 150 chaves, sem linha repetida; teste sem linha = lista vazia', async () => {
    const t = ids(150)
    const rows = t.slice(0, 140).map(x => dia(x, '2026-10-01'))
    const f = fakePostgrest({ tables: { ab_test_dias: rows } })
    const r = await lerDiasDosTestes(sb(f), 'site-1', t)
    expect(f.on('ab_test_dias')).toHaveLength(2)
    if (!r.ok) throw new Error('esperava ok')
    expect(r.porTeste.size).toBe(150)
    expect([...r.porTeste.values()].reduce((s, l) => s + l.length, 0)).toBe(140)
    expect(r.porTeste.get('t-149')).toEqual([])
  })

  it('0 ids: 0 consultas, ok com Map vazio', async () => {
    const f = fakePostgrest({ tables: { ab_test_dias: [] } })
    const r = await lerDiasDosTestes(sb(f), 'site-1', [])
    expect(f.queries).toHaveLength(0)
    expect(r).toEqual({ ok: true, porTeste: new Map(), invalidos: new Map() })
  })

  it('erro numa página: erro_de_banco, sem Map parcial', async () => {
    const f = fakePostgrest({ tables: { ab_test_dias: [dia('t-1', '2026-10-01')] }, fail: () => ({ message: 'boom' }) })
    const r = await lerDiasDosTestes(sb(f), 'site-1', ['t-1'])
    expect(r).toMatchObject({ ok: false, motivo: 'erro_de_banco' })
    expect('porTeste' in r).toBe(false)
  })

  it('passou do teto: passou_do_teto', async () => {
    const rows = Array.from({ length: TETO_LINHAS_POR_TESTE + 1 }, (_, i) => dia('t-1', `2026-09-${String((i % 28) + 1).padStart(2, '0')}`, { variant_id: `v${i}` }))
    const f = fakePostgrest({ tables: { ab_test_dias: rows } })
    const r = await lerDiasDosTestes(sb(f), 'site-1', ['t-1'])
    expect(r).toMatchObject({ ok: false, motivo: 'passou_do_teto' })
  })

  it('linha inválida (ctr 4.12) isola o teste na lista e avisa o Sentry 1 vez; no detalhe vira linha_invalida', async () => {
    const f = fakePostgrest({ tables: { ab_test_dias: [dia('t-1', '2026-10-01'), dia('t-2', '2026-10-02', { ctr: 4.12 }), dia('t-3', '2026-10-01')] } })
    const r = await lerDiasDosTestes(sb(f), 'site-1', ['t-1', 't-2', 't-3'])
    if (!r.ok) throw new Error('esperava ok')
    expect([...r.porTeste.keys()].sort()).toEqual(['t-1', 't-3'])
    expect(r.invalidos.get('t-2')?.day_pt).toBe('2026-10-02')
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(sentry.captureMessage.mock.calls[0]![1]).toMatchObject({ level: 'error', fingerprint: ['ab-placar-linha-invalida', 't-2', '2026-10-02'] })

    sentry.captureMessage.mockClear()
    const d = await lerDiasDoTeste(sb(f), 'site-1', 't-2')
    expect(d).toMatchObject({ ok: false, motivo: 'linha_invalida' })
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('lerDiasDoTeste devolve as linhas do teste', async () => {
    const f = fakePostgrest({ tables: { ab_test_dias: [dia('t-1', '2026-10-02'), dia('t-1', '2026-10-01')] } })
    const d = await lerDiasDoTeste(sb(f), 'site-1', 't-1')
    if (!d.ok) throw new Error('esperava ok')
    expect(d.dias.map(x => x.day_pt)).toEqual(['2026-10-01', '2026-10-02'])
  })

  it('site: linha de site-2 do mesmo test_id não chega', async () => {
    const f = fakePostgrest({ tables: { ab_test_dias: [dia('t-1', '2026-10-01'), dia('t-1', '2026-10-02', {}, 'site-2')] } })
    const r = await lerDiasDosTestes(sb(f), 'site-1', ['t-1'])
    if (!r.ok) throw new Error('esperava ok')
    expect(r.porTeste.get('t-1')).toHaveLength(1)
    expect(r.porTeste.get('t-1')![0]!.site_id).toBe('site-1')
  })
})
