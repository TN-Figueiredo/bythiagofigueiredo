// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { lerUnidadeInteira, lerFaixa, dividirEmPartes, MudouDuranteALeitura, GrandeDemais, type Rpc } from '@/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco'
import { exportarUnidade } from '@/lib/youtube/observatorio/arquivo/exportar'
import { randomBytes } from 'node:crypto'

const U = { site: 's', classe: 'serie' as const, tabela: 'competitor_video_daily', canal: 'c', mes: '2026-10' }

/** Um banco falso com `total` linhas; `mutar(chamada)` devolve o hash daquela chamada. */
function banco(total: number, mutar: (chamada: number) => string = () => 'h') {
  const chamadas: Array<{ fn: string; offset: number; limit: number }> = []
  const rpc: Rpc = {
    rpc: async (fn, args) => {
      const offset = Number(args.p_offset); const limit = Number(args.p_limit)
      chamadas.push({ fn, offset, limit })
      const rows = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => [`k${offset + i}`, String(offset + i)])
      return { data: [{ rows, row_count: total, control_sum: '9', hash_conteudo: mutar(chamadas.length), columns: [{ nome: 'k' }, { nome: 'views' }], schema_fp: 'fp' }], error: null }
    },
  }
  return { rpc, chamadas }
}

describe('lerUnidadeInteira', () => {
  it('2.500 linhas em chamadas de 1.000 são lidas inteiras (75)', async () => {
    const b = banco(2500)
    const r = await lerUnidadeInteira(b.rpc, U, 1000)
    expect(b.chamadas.map(c => c.offset)).toEqual([0, 1000, 2000])
    expect(r.linhas).toHaveLength(2500)
    expect(r.linhas[2499]).toEqual(['k2499', '2499'])
    expect(r).toMatchObject({ colunas: ['k', 'views'], contagem: 2500, soma: '9', hash: 'h', schemaFp: 'fp' })
  })
  it('o padrão de chamada é o teto de linhas por chamada do contrato (5.000)', async () => {
    const b = banco(12_000)
    await lerUnidadeInteira(b.rpc, U)
    expect(b.chamadas.map(c => [c.offset, c.limit])).toEqual([[0, 5000], [5000, 5000], [10000, 5000]])
  })
  it('hash que muda entre chamadas recomeça; depois de 3 tentativas, MudouDuranteALeitura (75)', async () => {
    const b = banco(2500, c => (c % 2 === 0 ? 'outro' : 'h'))
    await expect(lerUnidadeInteira(b.rpc, U, 1000)).rejects.toBeInstanceOf(MudouDuranteALeitura)
    expect(b.chamadas.length).toBe(6)   // 3 tentativas, cada uma para na 2ª chamada
  })
  it('muda uma vez e depois estabiliza: lê inteira na segunda tentativa', async () => {
    const b = banco(2500, c => (c === 2 ? 'outro' : 'h'))
    const r = await lerUnidadeInteira(b.rpc, U, 1000)
    expect(r.linhas).toHaveLength(2500)
  })
  it('acima de TETO_LINHAS_DA_UNIDADE: GrandeDemais depois da primeira chamada, sem ler as outras (D25)', async () => {
    const b = banco(60_001)
    await expect(lerUnidadeInteira(b.rpc, U, 1000)).rejects.toBeInstanceOf(GrandeDemais)
    expect(b.chamadas).toHaveLength(1)
  })
  it('página que devolve mais linhas que row_count: recomeça e acaba em MudouDuranteALeitura (mutante I)', async () => {
    const rpc: Rpc = { rpc: async (_fn, args) => {
      const rows = Array.from({ length: Number(args.p_limit) }, (_, i) => [`k${i}`, '1'])   // sempre a página cheia, mesmo na última
      return { data: [{ rows, row_count: 1500, control_sum: '9', hash_conteudo: 'h', columns: [{ nome: 'k' }, { nome: 'views' }], schema_fp: 'fp' }], error: null }
    } }
    await expect(lerUnidadeInteira(rpc, U, 1000)).rejects.toBeInstanceOf(MudouDuranteALeitura)
  })
  it('zero linha: contagem 0 e colunas', async () => {
    const r = await lerUnidadeInteira(banco(0).rpc, U, 1000)
    expect(r).toMatchObject({ contagem: 0, linhas: [], colunas: ['k', 'views'] })
  })
  it('data fora do esquema lança (nunca as)', async () => {
    const rpc: Rpc = { rpc: async () => ({ data: [{ rows: 'x' }], error: null }) }
    await expect(lerUnidadeInteira(rpc, U)).rejects.toThrow(/fora do esquema/)
  })
})

describe('lerFaixa', () => {
  it('hash que muda entre as páginas da faixa: MudouDuranteALeitura (mutante B)', async () => {
    const b = banco(5000, c => (c === 1 ? 'h' : 'outro'))
    await expect(lerFaixa(b.rpc, U, 0, 2000, 1000)).rejects.toBeInstanceOf(MudouDuranteALeitura)
  })
  it('lê só a faixa pedida, soma nula, contagem igual às linhas', async () => {
    const b = banco(5000)
    const r = await lerFaixa(b.rpc, U, 1200, 2300, 1000)
    expect(b.chamadas.map(c => [c.offset, c.limit])).toEqual([[1200, 1000], [2200, 1000], [3200, 300]])
    expect(r.linhas).toHaveLength(2300)
    expect(r.linhas[0]).toEqual(['k1200', '1200'])
    expect(r).toMatchObject({ contagem: 2300, soma: null })
  })
  it('a unidade encolheu: MudouDuranteALeitura', async () => {
    await expect(lerFaixa(banco(100).rpc, U, 50, 200, 1000)).rejects.toBeInstanceOf(MudouDuranteALeitura)
  })
})

describe('dividirEmPartes', () => {
  const aleatorias = (n: number, bytes: number) => Array.from({ length: n }, (_, i) => [`k${i}`, randomBytes(bytes / 2).toString('hex')])
  it('unidade que cabe numa parte vai inteira', () => {
    const l = aleatorias(10, 100)
    expect(dividirEmPartes(['k', 'v'], l)).toEqual([{ parte: 1, rowOffset: 0, linhas: l }])
  })
  it('parte maior que 3 MB divide, nunca trunca (25)', async () => {
    const l = aleatorias(80, 200_000)   // ~8 MB comprimidos (bytes aleatórios em hex)
    const partes = dividirEmPartes(['k', 'v'], l)
    expect(partes.length).toBeGreaterThanOrEqual(3)
    expect(partes.reduce((t, p) => t + p.linhas.length, 0)).toBe(80)
    let esperado = 0
    for (const p of partes) {
      expect(p.rowOffset).toBe(esperado); esperado += p.linhas.length
      const s = await exportarUnidade({ ler: async () => ({ colunas: ['k', 'v'], linhas: p.linhas, contagem: p.linhas.length, soma: null }) }, null, { tabela: 't', canal: 'c', de: 'x', ate: 'x', rotulo: 'x' })
      expect(s.bytes).toBeLessThanOrEqual(3 * 1024 * 1024)
    }
    expect(partes.flatMap(p => p.linhas)).toEqual(l)
  })
  it('mais de 99 partes lança GrandeDemais', () => {
    const l = aleatorias(300, 400)
    expect(() => dividirEmPartes(['k', 'v'], l, 800)).toThrow(GrandeDemais)
  })
  it('uma linha sozinha acima do teto lança GrandeDemais', () => {
    expect(() => dividirEmPartes(['k', 'v'], aleatorias(2, 20_000), 1000)).toThrow(GrandeDemais)
  })
})

describe('a soma da fonte é a do banco', () => {
  it('exportarUnidade recebe a soma de read_unit (texto)', async () => {
    const r = await lerUnidadeInteira(banco(3).rpc, U)
    const s = await exportarUnidade({ ler: async () => ({ colunas: r.colunas, linhas: r.linhas, contagem: r.contagem, soma: r.soma }) }, null, { tabela: 't', canal: 'c', de: 'x', ate: 'x', rotulo: 'x' })
    expect(s.soma).toBe('9')
  })
})
