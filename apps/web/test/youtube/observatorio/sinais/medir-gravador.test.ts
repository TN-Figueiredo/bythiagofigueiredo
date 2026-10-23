// @vitest-environment node
/**
 * F2 · T1: funções puras do script de custo do gravador (só leitura): projeção de idas, proxy de só leitura,
 * classificação do erro 42P01 e o Jaccard provisório.
 */
import { describe, expect, it } from 'vitest'
import { projetarIdas, somenteLeitura, ehRelacaoAusente, jaccard, tokensDe, histogramaJaccard } from '../../../../scripts/f2-medir-gravador'

describe('projetarIdas', () => {
  it('14.814 linhas em 19 dias, alvo 365 d: cerca de 285 idas (±5)', () => {
    const n = projetarIdas(14_814, 19, 365, 1000)
    expect(Math.abs(n - 285)).toBeLessThanOrEqual(5)
  })
  it('alvo 90 d e o caso sem linhas', () => {
    expect(projetarIdas(14_814, 19, 90, 1000)).toBe(71)
    expect(projetarIdas(0, 19, 365, 1000)).toBe(0)
    expect(projetarIdas(100, 0, 365, 1000)).toBe(0)
  })
})

describe('somenteLeitura', () => {
  const falso = () => {
    const construtor = { select: () => 'sel', insert: () => 'x', update: () => 'x', upsert: () => 'x', delete: () => 'x' }
    return { from: () => construtor, rpc: () => 'x' } as never
  }
  it('lança em .rpc e nas escritas de tabela, deixa o select passar', () => {
    const sb = somenteLeitura(falso())
    expect(() => (sb as unknown as { rpc: () => void }).rpc()).toThrow(/somente leitura/)
    const t = sb.from('x') as unknown as Record<string, () => unknown>
    for (const m of ['insert', 'update', 'upsert', 'delete']) expect(() => t[m]()).toThrow(/somente leitura/)
    expect(t.select()).toBe('sel')
  })
  it('deny-by-default: schema, storage, functions, auth, channel e qualquer outro lançam', () => {
    const sb = somenteLeitura({ schema: () => 1, storage: {}, functions: {}, auth: {}, channel: () => 1, outra: () => 1 } as never) as unknown as Record<string, () => void>
    for (const m of ['rpc', 'schema', 'storage', 'functions', 'auth', 'channel', 'outra']) expect(() => sb[m]()).toThrow(/somente leitura/)
  })
  it('depois do select, filtros passam e escrita encadeada lança', () => {
    const fim = { range: () => fim, eq: () => fim, order: () => fim, upsert: () => 'x', rpc: () => 'x', then: (f: (v: string) => void) => f('ok') }
    const sb = somenteLeitura({ from: () => ({ select: () => fim }) } as never)
    const q = (sb.from('t') as unknown as { select: () => Record<string, (...a: unknown[]) => unknown> }).select()
    expect(() => (q.eq('a', 1) as Record<string, () => void>).range(0, 1)).not.toThrow()
    expect(() => q.upsert()).toThrow(/somente leitura/)
    expect(() => q.rpc()).toThrow(/somente leitura/)
  })
})

describe('ehRelacaoAusente', () => {
  it('42P01 é ausente; outro código ou sem erro não é', () => {
    expect(ehRelacaoAusente({ code: '42P01', message: 'relation "video_lugares" does not exist' })).toBe(true)
    expect(ehRelacaoAusente({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(ehRelacaoAusente({ code: 'PGRST205', message: "Could not find the table 'public.video_lugares' in the schema cache" })).toBe(true)
    expect(ehRelacaoAusente(null)).toBe(false)
  })
})

describe('jaccard provisório', () => {
  it('tokens: minúsculas, sem acento, só 3+ letras', () => {
    expect([...tokensDe('Praia de São Miguel', ['Açores'])].sort()).toEqual(['acores', 'miguel', 'praia', 'sao'])
  })
  it('jaccard e histograma em degraus de 0,05', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3)
    expect(jaccard(new Set(), new Set())).toBe(0)
    const h = histogramaJaccard([0, 0.04, 0.05, 0.99, 1])
    expect(h['0.00']).toBe(2)
    expect(h['0.05']).toBe(1)
    expect(h['0.95']).toBe(1)
    expect(h['1.00']).toBe(1)
  })
})
