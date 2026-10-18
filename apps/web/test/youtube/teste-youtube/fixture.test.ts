// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validarLeituras } from '@/lib/youtube/teste-youtube/tipos'
import { carregarQIg9, linhasDhash, TITULO_A, TITULO_B } from '../../fixtures/teste-youtube/qIg9a7vqcNo/carregar'

const { leituras, sondas } = carregarQIg9()
const texto1 = (l: { titulosExibidos: Array<{ texto: string | null }> }) => l.titulosExibidos[0]!.texto

describe('fixture qIg9a7vqcNo', () => {
  it('60 leituras em 20 rodadas de 3', () => {
    expect(leituras.length).toBe(60)
    const por = new Map<string, number>()
    for (const l of leituras) por.set(l.rodadaId, (por.get(l.rodadaId) ?? 0) + 1)
    expect(por.size).toBe(20)
    expect([...por.values()].every(n => n === 3)).toBe(true)
  })

  it('sequência A/B por rodada', () => {
    const por = new Map<string, string>()
    for (const l of leituras) por.set(l.rodadaId, (por.get(l.rodadaId) ?? '') + (texto1(l) === TITULO_A ? 'A' : 'B'))
    expect([...por.values()].join(' ')).toBe('ABB AAA BAA ABB ABB BBA BBB BBA AAA BBA BBA BAB AAB AAA BBB AAA AAB BBB ABB AAB')
  })

  it('votos e campos fixos', () => {
    expect(leituras.filter(l => texto1(l) === TITULO_A).length).toBe(29)
    expect(leituras.filter(l => texto1(l) === TITULO_B).length).toBe(31)
    for (const l of leituras) {
      expect(l.tituloOficial).toBe(TITULO_A)
      expect(l.idioma).toBe('pt-BR')
      expect(l.origemRede).toBe('mac-casa')
      expect(l.titulosExibidos.length).toBe(3)
      expect(l.miniaturas.length).toBe(6)
    }
  })

  it('tudo passa no Zod', () => {
    expect(validarLeituras([...leituras, ...sondas]).invalidas).toBe(0)
  })

  it('sondas', () => {
    expect(sondas.length).toBe(17)
    expect(sondas.map(s => s.miniaturas.length)).toEqual([...Array(16).fill(30), 2])
    expect(sondas.reduce((n, s) => n + s.miniaturas.length, 0)).toBe(482)
    for (const s of sondas) {
      expect(s.titulosExibidos).toEqual([])
      for (const m of s.miniaturas) {
        if (m.http === 404) {
          expect([m.dhash, m.largura, m.altura]).toEqual([null, null, null])
        } else if (m.http === 200) {
          expect(m.dhash).not.toBeNull()
        }
      }
    }
  })

  it('dhash.tsv: 35 linhas e conferências do spec §2.3', () => {
    const l = linhasDhash()
    expect(l.length).toBe(35)
    const acha = (p: (x: (typeof l)[number]) => boolean) => l.find(p)!.dhash
    expect(acha(x => x.arquivo.includes('A-original'))).toBe('686068cfa7a3a3c6')
    expect(acha(x => x.arquivo.includes('B-variante'))).toBe('e9f9e90c1a3a3a9c')
    expect(acha(x => x.sha16?.startsWith('0e5ef9') === true)).toBe('106068c9a7a3c3c8')
    expect(acha(x => x.sha16?.startsWith('967c11') === true && x.origem === 'sonda')).toBe('106068cba7a3c3c8')
    expect(acha(x => x.sha16?.startsWith('20e9aa') === true)).toBe('400e716969691648')
  })

  it('miniaturas das leituras: 28 sem dhash em 7 leituras, 332 com', () => {
    const todas = leituras.flatMap(l => l.miniaturas)
    const sem = todas.filter(m => m.http === null && m.dhash === null)
    expect(sem.length).toBe(28)
    expect(todas.filter(m => m.dhash !== null).length).toBe(332)
    expect(leituras.filter(l => l.miniaturas.some(m => m.dhash === null)).length).toBe(7)
    for (const l of leituras) {
      expect(l.miniaturas.some(m => m.variante === 'hqdefault' && !m.url.includes('?'))).toBe(true)
      expect(l.miniaturas.some(m => m.variante === 'maxresdefault' && m.dhash !== null)).toBe(true)
    }
  })

  it('a pasta tem só os 6 arquivos', () => {
    const dir = fileURLToPath(new URL('../../fixtures/teste-youtube/qIg9a7vqcNo/', import.meta.url))
    expect(readdirSync(dir).sort()).toEqual(['README.md', 'carregar.ts', 'dhash.tsv', 'paginas-watch.tsv', 'sondas.tsv', 'titulos.tsv'])
  })
})
