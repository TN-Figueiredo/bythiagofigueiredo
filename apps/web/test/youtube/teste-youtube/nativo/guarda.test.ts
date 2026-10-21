// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { bloqueadoPorTesteNativo, decidirGuarda, inicioDoTeste, MARGEM_FECHAMENTO_DIAS } from '@/lib/youtube/teste-youtube/nativo/guarda'
import type { LinhaAberta } from '@/lib/youtube/teste-youtube/nativo/guarda'
import { fakeSupabase } from '../../../helpers/fake-supabase'

const detectada: LinhaAberta = { id: 'n1', video_id: 'v1', confirmado_em: null, updated_at: '2026-10-20T00:00:00Z' }
const confirmada: LinhaAberta = { ...detectada, confirmado_em: '2026-10-21T00:00:00Z' }

describe('decidirGuarda', () => {
  it.each([
    ['off', 'seguir', 'seguir', 'pausar'],
    ['log', 'seguir', 'anotar', 'pausar'],
    ['on', 'seguir', 'pausar', 'pausar'],
  ] as const)('modo %s: sem linha / detectada / confirmada', (modo, s, d, c) => {
    const rot = (x: ReturnType<typeof decidirGuarda>) => (x.acao === 'seguir' ? 'seguir' : x.acao === 'seguir_e_anotar' ? 'anotar' : 'pausar')
    expect(rot(decidirGuarda(undefined, modo))).toBe(s)
    expect(rot(decidirGuarda(detectada, modo))).toBe(d)
    expect(rot(decidirGuarda(confirmada, modo))).toBe(c)
  })
  it('motivos e id', () => {
    expect(decidirGuarda(confirmada, 'off')).toEqual({ acao: 'pausar_sem_escrever', nativeTestId: 'n1', motivo: 'confirmado' })
    expect(decidirGuarda(detectada, 'on')).toEqual({ acao: 'pausar_sem_escrever', nativeTestId: 'n1', motivo: 'detectado' })
    expect(decidirGuarda(detectada, 'log')).toEqual({ acao: 'seguir_e_anotar', nativeTestId: 'n1' })
  })
  it('classificação é por confirmado_em, nunca por origem: origem detectado com confirmado_em = confirmada', () => {
    const l = { ...detectada, origem: 'detectado', confirmado_em: '2026-10-21T00:00:00Z' } as LinhaAberta
    expect(decidirGuarda(l, 'off')).toMatchObject({ acao: 'pausar_sem_escrever', motivo: 'confirmado' })
  })
})

describe('inicioDoTeste', () => {
  const c = '2026-10-10T00:00:00Z'
  it('detecção no dia 0, confirmação no dia 3: dia 0', () => {
    expect(inicioDoTeste({ primeira_vista: '2026-10-01T00:00:00Z', confirmado_em: '2026-10-04T00:00:00Z', created_at: c }).toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })
  it('só confirmado_em: ele; nenhum dos dois: created_at', () => {
    expect(inicioDoTeste({ primeira_vista: null, confirmado_em: '2026-10-04T00:00:00Z', created_at: c }).toISOString()).toBe('2026-10-04T00:00:00.000Z')
    expect(inicioDoTeste({ primeira_vista: null, confirmado_em: null, created_at: c }).toISOString()).toBe('2026-10-10T00:00:00.000Z')
  })
  it('margem nomeada', () => expect(MARGEM_FECHAMENTO_DIAS).toBe(2))
})

describe('bloqueadoPorTesteNativo', () => {
  const linha = (i: number, extra: Record<string, unknown> = {}) => ({ id: `n${i}`, site_id: 's1', video_id: `v${i}`, estado: 'em_andamento', confirmado_em: null, updated_at: '2026-10-20T00:00:00Z', ...extra })
  it('N=50 vídeos: uma ida ao banco; só linhas abertas do site pedido', async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `v${i}`)
    const db = fakeSupabase({ ab_native_tests: [linha(3), linha(7, { confirmado_em: '2026-10-21T00:00:00Z' }), linha(9, { estado: 'encerrado' }), linha(11, { site_id: 's2' })] })
    const r = await bloqueadoPorTesteNativo(db.client, 's1', ids)
    expect(db.trips).toEqual(['ab_native_tests'])
    expect(r.ok && [...r.linhas.keys()].sort()).toEqual(['v3', 'v7'])
    expect(r.ok && r.linhas.get('v7')?.confirmado_em).toBe('2026-10-21T00:00:00Z')
  })
  it('lista vazia: nenhuma ida ao banco', async () => {
    const db = fakeSupabase({ ab_native_tests: [] })
    expect(await bloqueadoPorTesteNativo(db.client, 's1', [])).toEqual({ ok: true, linhas: new Map() })
    expect(db.trips).toEqual([])
  })
  it('erro do banco: { ok: false }, nunca mapa vazio', async () => {
    const db = fakeSupabase({}, { failOn: 'ab_native_tests' })
    const r = await bloqueadoPorTesteNativo(db.client, 's1', ['v1'])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/ab_native_tests/)
  })
  it('exceção do cliente: { ok: false }', async () => {
    const sb = { from: () => { throw new Error('rede') } } as never
    expect((await bloqueadoPorTesteNativo(sb, 's1', ['v1'])).ok).toBe(false)
  })
  it('mais de 1.000 linhas: pagina', async () => {
    const linhas = Array.from({ length: 1200 }, (_, i) => linha(i))
    const db = fakeSupabase({ ab_native_tests: linhas })
    const r = await bloqueadoPorTesteNativo(db.client, 's1', linhas.map((l) => l.video_id).slice(0, 100))
    expect(r.ok && r.linhas.size).toBe(100)
  })
})
