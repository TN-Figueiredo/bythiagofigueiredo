// @vitest-environment node
// Onda final, I-2: "views/dia por mil inscritos" se escreve de um jeito só nos quatro pontos (lista, painel, cabeçalho do canal e comparação),
// e o empate de posição usa o valor escrito por esse formatador. Zero medido "0", abaixo de 0,1 "menos de 0,1", uma casa abaixo de 10.
import { describe, it, expect } from 'vitest'
import { a3World } from './a3-fixture'
import { vpdText } from '@/app/cms/(authed)/youtube/competitors/_canal/numeros'
import { numerosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { buildCanalHeader } from '@/app/cms/(authed)/youtube/competitors/_canal/header-model'
import { buildCanaisView, type CanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { posicoes } from '@/lib/youtube/observatorio/posicao'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'

const BASE = a3World()
const CH = 'leo-khev'
const sem = (t: string) => t.replace(/ /g, ' ')
const V0 = BASE.obs.channelStats(CH, 'long').vpdMedian!

/** Põe o canal com `alvo` views/dia por mil inscritos (0 = série achatada: zero medido; senão, ajusta os inscritos). */
const comPorMil = (id: string, alvo: number) => (ds: Dataset) => {
  if (alvo === 0) {
    for (const v of ds.videos.filter(x => x.ch === id)) { const p0 = v.series[0]; v.series = p0 ? v.series.map(p => ({ ...p, views: p0.views })) : [] }
  } else {
    const v0 = BASE.obs.channelStats(id, 'long').vpdMedian!
    ds.channels.find(c => c.id === id)!.subs = Math.round((v0 * 1000) / alvo)
  }
}
const lista = (obs: Observatory, extra: Partial<Parameters<typeof buildCanaisView>[1]> = {}): CanaisView => buildCanaisView(obs, { niche: 'todos', limit: 75, fmt: 'longos', scale: 'per-mil', sort: 'vpd', ...extra })
const celulaLista = (obs: Observatory, id: string) => {
  const c = [...lista(obs).list.ranked, ...lista(obs).list.unranked].find(r => r.id === id)!.cells.vpd
  return c.kind === 'ok' ? sem(c.big) : null
}
const painel = (obs: Observatory, id: string) => {
  const d = lista(obs, { channel: id }).drawer!
  return sem(d.stats.find(s => s.label.startsWith('Views/dia'))!.value)
}
const cabecalho = (obs: Observatory, id: string) => {
  const h = buildCanalHeader(obs, id)!
  return [...h.faixa, ...h.todos].find(c => c.key === 'vpdPorMil')!.value
}
const comparacao = (obs: Observatory, id: string) => numerosDoCanal(obs, id).vpdPorMil.texto

describe('o formatador: 0, 0,03, 0,1, 9,95 e 10', () => {
  it.each([[0, '0'], [0.03, 'menos de 0,1'], [0.1, '0,1'], [9.95, '10'], [10, '10']] as const)('%s → "%s"', (v, esperado) => {
    expect(vpdText(v, n => String(n))).toBe(esperado)
  })
  it('não medido continua não medido (nulo), nunca "0"', () => { expect(vpdText(null, n => String(n))).toBeNull() })
})

describe('os quatro pontos escrevem igual (por mil)', () => {
  it.each([[0, '0'], [0.03, 'menos de 0,1'], [0.1, '0,1'], [9.95, null], [10, '10']] as const)('%s por mil: lista, painel, cabeçalho e comparação dão o mesmo texto', (alvo, esperado) => {
    const w = a3World(comPorMil(CH, alvo))
    const x = numerosDoCanal(w.obs, CH).vpdPorMil.x
    expect(x).not.toBeNull()
    const textos = { lista: celulaLista(w.obs, CH), painel: painel(w.obs, CH), cabecalho: cabecalho(w.obs, CH), comparacao: comparacao(w.obs, CH) }
    expect(textos.lista, JSON.stringify(textos)).toBe(textos.comparacao)
    expect(textos.painel, JSON.stringify(textos)).toBe(textos.comparacao)
    expect(textos.cabecalho, JSON.stringify(textos)).toBe(textos.comparacao)
    expect(textos.comparacao).toBe(vpdText(x, w.obs.fmt.num))
    if (esperado != null) expect(textos.comparacao).toBe(esperado)
  })
})

describe('o empate de posição usa o valor escrito, igual na lista e na comparação', () => {
  it('dois canais com 0,03 e 0,04 por mil (os dois "menos de 0,1") empatam nas duas telas; o de zero medido não empata com eles', () => {
    const ids = BASE.ds.channels.filter(c => !c.own && c.id !== CH).map(c => c.id).slice(0, 3)
    const [a, b, c] = ids as [string, string, string]
    // o canal próprio de produção não tem o diário até a A4: sem série, a lista também não o mede (como a comparação)
    const w = a3World(ds => {
      const proprios = new Set(ds.channels.filter(x => x.own).map(x => x.id))
      for (const v of ds.videos.filter(x => proprios.has(x.ch))) { v.series = []; v.firstIdx = null }
      comPorMil(a, 0.03)(ds); comPorMil(b, 0.04)(ds); comPorMil(c, 0)(ds)
    })
    const nums = (id: string) => numerosDoCanal(w.obs, id).vpdPorMil
    expect(nums(a).texto).toBe('menos de 0,1'); expect(nums(b).texto).toBe('menos de 0,1'); expect(nums(c).texto).toBe('0')
    const todos = w.obs.channels.map(ch => ch.id)
    const naComparacao = posicoes(todos.map(id => ({ id, x: nums(id).x, chave: nums(id).texto ?? undefined })))
    const v = lista(w.obs), rows = [...v.list.ranked, ...v.list.unranked]
    for (const id of todos) {
      const r = rows.find(x => x.id === id)
      expect(r?.pos ?? null, id).toEqual(naComparacao.get(id) ?? null)
    }
    expect(rows.find(r => r.id === a)!.pos!.empate).toBe(true)
    expect(rows.find(r => r.id === b)!.pos!.empate).toBe(true)
    expect(rows.find(r => r.id === a)!.pos!.pos).toBe(rows.find(r => r.id === b)!.pos!.pos)
    expect(rows.find(r => r.id === c)!.pos!.empate).toBe(false)
  })
})
