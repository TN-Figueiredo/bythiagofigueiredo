// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { lerPaginado } from '@/lib/youtube/coleta/paginar'

type Linha = { n: number }
/** Uma "tabela" de `total` linhas servida por `.range(de, ate)` inclusivo, como o PostgREST. */
const tabela = (total: number, falhaNaPagina: number | null = null) => {
  const chamadas: Array<[number, number]> = []
  const pagina = async (de: number, ate: number) => {
    chamadas.push([de, ate])
    if (falhaNaPagina !== null && chamadas.length === falhaNaPagina) return { data: null, error: { code: '57014', message: 'statement timeout' } }
    const data: Linha[] = []
    for (let i = de; i <= Math.min(ate, total - 1); i++) data.push({ n: i })
    return { data, error: null }
  }
  return { pagina, chamadas }
}

describe('lerPaginado', () => {
  it('2.500 linhas em três páginas de 1.000', async () => {
    const t = tabela(2500)
    const r = await lerPaginado<Linha>(t.pagina, 20_000)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.linhas).toHaveLength(2500)
      expect(r.linhas[0]).toEqual({ n: 0 })
      expect(r.linhas[2499]).toEqual({ n: 2499 })
    }
    expect(t.chamadas).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('tabela vazia: uma chamada, zero linhas', async () => {
    const t = tabela(0)
    expect(await lerPaginado<Linha>(t.pagina, 20_000)).toEqual({ ok: true, linhas: [] })
    expect(t.chamadas).toHaveLength(1)
  })

  it('múltiplo exato de 1.000: a página vazia seguinte encerra', async () => {
    const t = tabela(2000)
    const r = await lerPaginado<Linha>(t.pagina, 20_000)
    expect(r.ok && r.linhas.length).toBe(2000)
    expect(t.chamadas).toHaveLength(3)
  })

  it('passou do teto: não ok com o número lido, sem cortar em silêncio', async () => {
    const t = tabela(2500)
    const r = await lerPaginado<Linha>(t.pagina, 2000)
    expect(r).toEqual({ ok: false, motivo: 'passou_do_teto', lidas: 2500 })
  })

  it('exatamente no teto ainda é ok', async () => {
    const t = tabela(2000)
    const r = await lerPaginado<Linha>(t.pagina, 2000)
    expect(r.ok).toBe(true)
  })

  it('erro na segunda página: não ok, com as linhas já lidas', async () => {
    const t = tabela(2500, 2)
    expect(await lerPaginado<Linha>(t.pagina, 20_000)).toEqual({ ok: false, motivo: 'erro_de_banco', lidas: 1000 })
    expect(t.chamadas).toHaveLength(2)
  })

  it('promessa que rejeita vira erro_de_banco, não exceção', async () => {
    const r = await lerPaginado<Linha>(() => Promise.reject(new Error('rede')), 20_000)
    expect(r).toEqual({ ok: false, motivo: 'erro_de_banco', lidas: 0 })
  })

  it('data nula sem erro é falha com motivo, não lista vazia', async () => {
    const r = await lerPaginado<Linha>(async () => ({ data: null, error: null }), 20_000)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('erro_de_banco')
      expect(r.lidas).toBe(0)
      expect(r.detalhe).toMatch(/sem lista/)
    }
  })

  it('data nula na segunda página também é falha, com as linhas já lidas', async () => {
    let n = 0
    const r = await lerPaginado<Linha>(async () => {
      n++
      return n === 1 ? { data: Array.from({ length: 1000 }, (_, i) => ({ n: i })), error: null } : { data: null, error: null }
    }, 20_000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.lidas).toBe(1000)
  })

  it.each([NaN, Infinity, 0, -1, -Infinity])('teto inválido (%s): recusa sem chamar a fonte, nunca laço sem fim', async (teto) => {
    let chamadas = 0
    const r = await lerPaginado<Linha>(async () => {
      chamadas++
      return { data: Array.from({ length: 1000 }, (_, i) => ({ n: i })), error: null }
    }, teto)
    expect(chamadas).toBe(0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detalhe).toMatch(/teto/)
  })
})
