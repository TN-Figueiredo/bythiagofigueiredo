// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { camposDoTipo, escritasDoApp, type LinhasEscrita } from '@/lib/youtube/teste-youtube/registro/escritas'
import { resolverOpcoes } from '@/lib/youtube/teste-youtube/tipos'

const J = { deMs: Date.parse('2026-10-01T00:00:00Z'), ateMs: Date.parse('2026-10-31T00:00:00Z') }
const vazio: LinhasEscrita = { testes: [], ciclos: [], restauracoes: [] }
const com = (p: Partial<LinhasEscrita>): LinhasEscrita => ({ ...vazio, ...p })
const T = (id: string, test_type: string, winner_applied_at: string | null = null) => ({ id, test_type, winner_applied_at })

describe('camposDoTipo', () => {
  it('mapeia o tipo', () => {
    expect(camposDoTipo('title')).toEqual(['titulo'])
    expect(camposDoTipo('combo')).toEqual(['titulo', 'miniatura'])
    expect(camposDoTipo('thumbnail')).toEqual(['miniatura'])
    expect(camposDoTipo('outro')).toEqual([])
  })
})

describe('escritasDoApp', () => {
  const ciclo = (end_reason: string | null, ended = '2026-10-10T12:00:00Z') =>
    com({ testes: [T('t1', 'title')], ciclos: [{ test_id: 't1', started_at: '2026-10-10T10:00:00Z', ended_at: ended, end_reason }] })

  it('ciclo rotacao contribui so started_at', () => {
    expect(escritasDoApp(ciclo('rotacao'), J)).toEqual([{ em: '2026-10-10T10:00:00Z', campo: 'titulo' }])
  })
  it('ended_at de drift, regra_v2 e valor futuro entram', () => {
    for (const r of ['drift', 'regra_v2', 'futuro']) {
      expect(escritasDoApp(ciclo(r), J).map(e => e.em)).toEqual(['2026-10-10T10:00:00Z', '2026-10-10T12:00:00Z'])
    }
  })
  it('end_reason nulo nao contribui ended_at', () => {
    expect(escritasDoApp(ciclo(null), J)).toHaveLength(1)
  })
  it('restauracoes com escreveu false ou null ficam fora', () => {
    const l = com({ testes: [T('t1', 'title')], restauracoes: [
      { test_id: 't1', campo: 'title', escreveu: false, em: '2026-10-10T10:00:00Z' },
      { test_id: 't1', campo: 'title', escreveu: null, em: '2026-10-10T11:00:00Z' },
      { test_id: 't1', campo: 'title', escreveu: true, em: '2026-10-10T12:00:00Z' },
      { test_id: 't1', campo: 'thumbnail', escreveu: true, em: '2026-10-10T13:00:00Z' },
    ] })
    expect(escritasDoApp(l, J)).toEqual([
      { em: '2026-10-10T12:00:00Z', campo: 'titulo' },
      { em: '2026-10-10T13:00:00Z', campo: 'miniatura' },
    ])
  })
  it('combo da duas escritas por instante; winner_applied_at entra', () => {
    const l = com({ testes: [T('t1', 'combo', '2026-10-12T09:00:00Z')] })
    expect(escritasDoApp(l, J)).toEqual([
      { em: '2026-10-12T09:00:00Z', campo: 'titulo' },
      { em: '2026-10-12T09:00:00Z', campo: 'miniatura' },
    ])
  })
  it('fora da janela sai, ordena e deduplica', () => {
    const l = com({ testes: [T('t1', 'title', '2026-09-01T00:00:00Z'), T('t2', 'title')], ciclos: [
      { test_id: 't1', started_at: '2026-10-10T12:00:00Z', ended_at: null, end_reason: null },
      { test_id: 't2', started_at: '2026-10-10T12:00:00Z', ended_at: null, end_reason: null },
      { test_id: 't2', started_at: '2026-10-05T12:00:00Z', ended_at: null, end_reason: null },
    ] })
    expect(escritasDoApp(l, J).map(e => e.em)).toEqual(['2026-10-05T12:00:00Z', '2026-10-10T12:00:00Z'])
  })
  it('em com +00:00 passa intacto e a regra aceita', () => {
    const l = com({ testes: [T('t1', 'title')], restauracoes: [{ test_id: 't1', campo: 'title', escreveu: true, em: '2026-10-10T10:00:00.123456+00:00' }] })
    const e = escritasDoApp(l, J)
    expect(e[0]!.em).toBe('2026-10-10T10:00:00.123456+00:00')
    expect(() => resolverOpcoes({ escritasConhecidas: e })).not.toThrow()
  })
  it('em sem fuso passa intacto e a regra lanca', () => {
    const l = com({ testes: [T('t1', 'title')], restauracoes: [{ test_id: 't1', campo: 'title', escreveu: true, em: '2026-10-10 10:00:00' }] })
    const e = escritasDoApp(l, { deMs: 0, ateMs: Date.parse('2100-01-01T00:00:00Z') })
    expect(e).toEqual([{ em: '2026-10-10 10:00:00', campo: 'titulo' }])
    expect(() => resolverOpcoes({ escritasConhecidas: e })).toThrow()
  })
})
