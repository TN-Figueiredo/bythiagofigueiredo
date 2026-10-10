import { describe, it, expect } from 'vitest'
import { parseCanalState, canalQuery, CANAL_DEFAULT } from '@/app/cms/(authed)/youtube/competitors/_canal/params'

describe('estado da página do canal na URL', () => {
  it('sem parâmetro: o padrão', () => { expect(parseCanalState({})).toEqual(CANAL_DEFAULT) })
  it('ida e volta', () => {
    const s = { ...CANAL_DEFAULT, tab: 'trocas' as const, video: 'v1' }
    expect(parseCanalState(Object.fromEntries(new URLSearchParams(canalQuery(s))))).toEqual(s)
  })
  it('parâmetros inválidos caem no padrão, sem erro', () => {
    const s = parseCanalState({ tab: 'retencao', fmt: 'xyz', sort: 'imp', dir: 'cima', ver: 'mosaico', n: '-5', nums: '2' })
    expect(s).toEqual(CANAL_DEFAULT)
  })
  it('n vira o múltiplo de 40 abaixo e tem teto', () => {
    expect(parseCanalState({ n: '37' }).n).toBe(0)
    expect(parseCanalState({ n: '95' }).n).toBe(80)
    expect(parseCanalState({ n: 'abc' }).n).toBe(0)
    expect(parseCanalState({ n: '999999999' }).n).toBe(100000)
  })
  it('q é aparado e cortado em 100 caracteres', () => {
    expect(parseCanalState({ q: '  lisboa  ' }).q).toBe('lisboa')
    expect(parseCanalState({ q: 'x'.repeat(2000) }).q).toHaveLength(100)
  })
  it('video só vale na aba Trocas', () => {
    expect(parseCanalState({ video: 'v1' }).video).toBeNull()
    expect(parseCanalState({ tab: 'trocas', video: 'v1' }).video).toBe('v1')
  })
  it('dir padrão depende da ordenação: recentes, vistos, múltiplo e vpd abrem em desc', () => {
    expect(parseCanalState({ sort: 'vistos' }).dir).toBe('desc')
    expect(canalQuery({ ...CANAL_DEFAULT, sort: 'vistos' })).toBe('?sort=vistos')
  })
})
