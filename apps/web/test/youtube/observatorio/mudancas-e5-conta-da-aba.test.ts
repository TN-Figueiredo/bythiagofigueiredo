// @vitest-environment node
// apps/web/test/youtube/observatorio/mudancas-e5-conta-da-aba.test.ts
// E5a Tarefa 6a: a aba Mudanças conta só título e miniatura.
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { contaComoTroca } from '@/lib/youtube/observatorio/changes'
import { contaComoTroca as reexportada, trocasDe30 } from '@/app/cms/(authed)/youtube/competitors/_canal/numeros'
import { coworkText } from '@/app/cms/(authed)/youtube/competitors/_chrome/view-model'
import { buildCanalHeader } from '@/app/cms/(authed)/youtube/competitors/_canal/header-model'
import { numerosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'

const obs = createObservatory(datasetFromOracle(loadOracle()))

describe('A conta da aba (E5a T6a)', () => {
  it('a aba conta só título e miniatura', () => {
    expect(contaComoTroca({ type: 'title' })).toBe(true)
    expect(contaComoTroca({ type: 'thumb' })).toBe(true)
    expect(contaComoTroca({ type: 'desc' })).toBe(false)
    const l = obs.changesIn({ days: 30, niche: 'todos' })
    expect(obs.tabCounts('todos').mud).toBe(l.filter(c => c.type === 'title' || c.type === 'thumb').length)
  })
  it('na fixture do oráculo a aba passa a 15, 7 e 8 (eram 18, 8 e 10: menos 3, 1 e 2 trocas de descrição)', () => {
    expect(obs.tabCounts('todos').mud).toBe(15)
    expect(obs.tabCounts('viagem').mud).toBe(7)
    expect(obs.tabCounts('ia').mud).toBe(8)
    expect(18 - 3).toBe(15); expect(8 - 1).toBe(7); expect(10 - 2).toBe(8)
  })
  it('a conta da aba é igual à da lista, à do cabeçalho do canal e à do Comparar no mesmo conjunto', () => {
    const soma = obs.channels.filter(c => !c.own).reduce((s, c) => s + trocasDe30(obs, c.id).length, 0)
    expect(soma).toBe(obs.tabCounts('todos').mud)
    expect(reexportada).toBe(contaComoTroca)
    // cabeçalho do canal e Comparar usam a mesma base (trocas30) que a aba, canal a canal
    for (const c of obs.channels.filter(c => !c.own)) {
      const v = buildCanalHeader(obs, c.id)!.todos.find(x => x.key === 'trocas30')!.value
      if (v != null) expect(Number(v)).toBe(trocasDe30(obs, c.id).length)
      const x = numerosDoCanal(obs, c.id).trocas30.x
      if (x != null) expect(x).toBe(trocasDe30(obs, c.id).length)
    }
  })
  it('integrity continua ok', () => { expect(obs.integrity).toEqual({ ok: true, errors: [] }) })
  it('o título da aba escreve a frase nova', () => {
    expect(obs.TAB_TITLES.mud(15)).toBe('15 trocas nos últimos 30 dias (título e thumbnail; longos e Shorts; contadas por evento)')
  })
  it('a frase para o Cowork não diz descrição e o resto não muda', () => {
    expect(coworkText('mudancas', 'ia')).toMatch(/^Liste as trocas de título e thumbnail dos concorrentes \(nicho IA, últimos 30 dias\) via youtube_observatory\./)
  })
  it('nada das outras mudanças entra em tabCounts: nenhuma troca de descrição na conta', () => {
    const desc = obs.changesIn({ days: 30, niche: 'todos' }).filter(c => c.type === 'desc').length
    expect(desc).toBe(3)
    expect(obs.tabCounts('todos').mud + desc).toBe(obs.changesIn({ days: 30, niche: 'todos' }).length)
  })
})
