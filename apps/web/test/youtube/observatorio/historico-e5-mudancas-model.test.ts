// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { dentroDosDiasAntes, listaDeMudancas, numerarMudancas, tipoDaMudanca } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/mudancas-model'

const H = 3600_000
const base = Date.UTC(2026, 9, 10, 15, 0, 0)
describe('E5a T20, mudanças', () => {
  it('numera na ordem do tempo e classifica o tipo', () => {
    const l = numerarMudancas([
      { campos: ['miniatura'], deMs: base - 30 * H, ateMs: base + 24 * H, precisao: 'dia' },
      { campos: ['titulo'], deMs: base - 30 * H, ateMs: base, precisao: 'dia' },
    ])
    expect(l.map((m) => m.n)).toEqual([1, 2])
    expect(l[0]!.tipo).toBe('titulo')
    expect(tipoDaMudanca(['tags', 'descricao'])).toBe('outras')
  })
  it('janela dos 14 dias antes: dia da subida e fronteira', () => {
    expect(dentroDosDiasAntes({ dia: '2026-10-02' }, '2026-10-16')).toBe(true)
    expect(dentroDosDiasAntes({ dia: '2026-10-01' }, '2026-10-16')).toBe(false)
    expect(dentroDosDiasAntes({ dia: '2026-10-16' }, '2026-10-16')).toBe(false)
  })
  it('frase-resumo e item de uma linha (trem 5.1): o tipo e a data aparecem uma vez', () => {
    const l = numerarMudancas([
      { campos: ['miniatura'], deMs: base, ateMs: base + 2 * H, precisao: '6h' },
      { campos: ['titulo'], deMs: base, ateMs: base + 3 * H, precisao: '6h' },
    ])
    const r = listaDeMudancas(l, { subidaDia: null, inicioDoHistorico: '2026-10-01' })
    expect(r.resumo).toEqual({ negrito: '2 mudanças, as duas em 10/10:', resto: ' thumbnail e título.' })
    expect(r.itens[0]!.quando.startsWith('em ')).toBe(false)
    expect(JSON.stringify(r)).not.toContain('Mudou neste dia')
    const um = listaDeMudancas(l.slice(0, 1), { subidaDia: null, inicioDoHistorico: '2026-10-01' })
    expect(um.resumo?.negrito).toBe('1 mudança, em 10/10:')
    const duas = numerarMudancas([
      { campos: ['titulo'], deMs: base, ateMs: base + H, precisao: '6h' },
      { campos: ['miniatura'], deMs: base + 48 * H, ateMs: base + 50 * H, precisao: '6h' },
    ])
    expect(listaDeMudancas(duas, { subidaDia: null, inicioDoHistorico: '2026-10-01' }).resumo?.negrito).toBe('2 mudanças entre 10/10 e 12/10.')
    expect(listaDeMudancas([], { subidaDia: null, inicioDoHistorico: '2026-10-01' }).resumo).toBeNull()
  })
})

describe('título e miniatura no mesmo instante (D3 do Gio)', () => {
  it('viram uma mudança que diz os dois, na lista e no resumo', () => {
    const l = numerarMudancas([{ campos: ['titulo', 'miniatura'], deMs: base - 30 * H, ateMs: base, precisao: 'dia' }])
    expect(tipoDaMudanca(l[0]!.campos)).toBe('titulo')
    const r = listaDeMudancas(l, { subidaDia: null, inicioDoHistorico: '2026-10-01' })
    expect(r.itens).toHaveLength(1)
    expect(r.itens[0]!.rotulo).toBe('Título e thumbnail')
    expect(r.resumo!.resto).toContain('título e thumbnail')
  })
})
