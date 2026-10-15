// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams, type CanaisRow, type GrowthCell } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { REGRAS_INSCRITOS } from '@/lib/youtube/observatorio/inscritos-28d'
import type { Dataset } from '@/lib/youtube/observatorio/types'

// Re-revisão C3: um `it` sem asserção passa em verde e deixa o mutante vivo. Todo teste deste arquivo TEM de afirmar algo.
beforeEach(() => { expect.hasAssertions() })

const DAY = 86_400_000
const NB = ' '
function retratos(ds: Dataset, id: string, de: number, ganho: number) {
  const ch = ds.channels.find(c => c.id === id)!, fim = ds.now
  ch.subs = de + ganho
  ch.snapshots = [{ t: fim - 30 * DAY, date: '', subs: de, views: 1 }, { t: fim, date: '', subs: de + ganho, views: 2 }]
}
const rowOf = (rows: CanaisRow[], id: string) => rows.find(r => r.id === id)!
const todas = (v: ReturnType<typeof buildCanaisView>) => [...v.list.ranked, ...v.list.unranked]
const comRetratosProprios = (w: ReturnType<typeof a3World>, retratos: Array<{ t: number; subs: number }>, oculto = false) => {
  const own = w.obs.ownChannels()[0]!
  return { own, retratosProprios: new Map([[own.id, { oculto, retratos: retratos.map((r, i) => ({ t: r.t, date: '', subs: r.subs, views: i + 1 })) }]]) }
}

describe('Crescimento: + e −, sem setas', () => {
  it('ganho: "+1,7%" e "+20 mil em 30 d"', () => {
    let id = ''
    const { obs } = a3World(ds => { id = ds.channels.find(c => !c.own)!.id; retratos(ds, id, 1_200_000, 20_000) })
    const v = buildCanaisView(obs, { niche: 'todos', limit: 75, sort: 'growth' })
    const g = rowOf([...v.list.ranked, ...v.list.unranked], id).cells.growth
    expect(g).toMatchObject({ kind: 'ok', big: '+1,7%' })
    expect(g.kind === 'ok' && g.cap.startsWith(`+20${NB}mil em 30${NB}d`)).toBe(true)
  })
  it('perda usa o sinal de menos U+2212', () => {
    let id = ''
    const { obs } = a3World(ds => { id = ds.channels.find(c => !c.own)!.id; retratos(ds, id, 1_200_000, -30_000) })
    const g = rowOf(buildCanaisView(obs, { niche: 'todos', limit: 75 }).list.ranked, id).cells.growth
    expect(g.kind === 'ok' && g.big).toBe('−2,5%')
  })
  it('dentro do arredondamento: "sem variação" e "dentro do arredondamento (±20 mil)"', () => {
    let id = ''
    const { obs } = a3World(ds => { id = ds.channels.find(c => !c.own)!.id; retratos(ds, id, 1_200_000, 10_000) })
    const g = rowOf(buildCanaisView(obs, { niche: 'todos', limit: 75 }).list.ranked, id).cells.growth
    expect(g).toMatchObject({ kind: 'flat', big: 'sem variação', cap: `dentro do arredondamento (±20${NB}mil)` })
  })
})

describe('zero, oculto, retrato velho e buraco (Yannis I1/I7, Phil I3/I4)', () => {
  it('abaixo de mil, 800 → 800: "sem variação", nunca "−0,0%" nem "−0"', () => {
    let id = ''
    const { obs } = a3World(ds => { id = ds.channels.find(c => !c.own)!.id; retratos(ds, id, 800, 0) })
    const g = rowOf(buildCanaisView(obs, { niche: 'todos', limit: 75 }).list.ranked, id).cells.growth
    expect(g).toMatchObject({ kind: 'flat', big: 'sem variação' })
    expect(JSON.stringify(g)).not.toContain('−0')
    expect(g.kind === 'flat' && g.cap).toBe('mesmo número nas duas contagens')
  })
  it('oculto, canal PRÓPRIO: subs null no dataset mas retratos não ocultos (MG20) medem como concorrente', () => {
    const w = a3World(ds => { ds.channels.find(c => c.own)!.subs = null })
    const fim = w.obs.NOW
    const { own, retratosProprios } = comRetratosProprios(w, [{ t: fim - 30 * DAY, subs: 50_000 }, { t: fim, subs: 52_000 }])
    const r = rowOf(todas(buildCanaisView(w.obs, { niche: 'todos', limit: 75, sort: 'growth', retratosProprios })), own.id)
    expect(r.cells.growth.kind).toBe('ok')
    expect(r.valor.growth).toBeCloseTo(0.04)
  })
  it('oculto, canal PRÓPRIO: retratosProprios com oculto:true fica "não medido: oculto" e fora da numeração', () => {
    const w = a3World()
    const fim = w.obs.NOW
    const { own, retratosProprios } = comRetratosProprios(w, [{ t: fim - 30 * DAY, subs: 50_000 }, { t: fim, subs: 52_000 }], true)
    const r = rowOf(todas(buildCanaisView(w.obs, { niche: 'todos', limit: 75, sort: 'growth', retratosProprios })), own.id)
    expect(r.cells.growth).toMatchObject({ kind: 'na', motivo: 'oculto' })
    expect(r.valor.growth).toBeNull()
    expect(r.numero).toBeNull()
  })
  it('oculto, CONCORRENTE: subs null (mesmo predicado `ocultoDe`) fica "não medido: oculto", sem valor e sem número', () => {
    let id = ''
    const { obs } = a3World(ds => { id = ds.channels.find(c => !c.own)!.id; retratos(ds, id, 1_200_000, 20_000); ds.channels.find(c => c.id === id)!.subs = null })
    const r = rowOf(todas(buildCanaisView(obs, { niche: 'todos', limit: 75, sort: 'growth' })), id)
    expect(r.cells.growth).toMatchObject({ kind: 'na', motivo: 'oculto' })
    expect(r.valor.growth).toBeNull()
    expect(r.numero).toBeNull()
  })
  it('canal próprio com a contagem mais nova velha demais: `atrasadoAte` preenchido e cap termina em ", até DD/MM"', () => {
    const w = a3World()
    const velho = w.obs.NOW - (REGRAS_INSCRITOS.retratoVelhoDias + 2) * DAY // 2 dias além do limite da seção Inscritos
    const { own, retratosProprios } = comRetratosProprios(w, [{ t: velho - 31 * DAY, subs: 50_000 }, { t: velho, subs: 52_000 }])
    const r = rowOf(todas(buildCanaisView(w.obs, { niche: 'todos', limit: 75, sort: 'growth', retratosProprios })), own.id)
    const g = r.cells.growth as Extract<GrowthCell, { kind: 'ok' }>
    expect(g.kind).toBe('ok')
    expect(g.atrasadoAte).toBe(velho)
    expect(g.cap).toMatch(/, até \d{2}\/\d{2}/)
    expect(g.cap.endsWith(`, até ${w.obs.date.dmhm(velho)}`)).toBe(true) // o mesmo formatador do código (`D.dmhm`)
  })
  it('canal próprio com a contagem mais nova em dia: `atrasadoAte` nulo e cap sem ", até"', () => {
    const w = a3World()
    const fim = w.obs.NOW
    const { own, retratosProprios } = comRetratosProprios(w, [{ t: fim - 30 * DAY, subs: 50_000 }, { t: fim, subs: 52_000 }])
    const g = rowOf(todas(buildCanaisView(w.obs, { niche: 'todos', limit: 75, sort: 'growth', retratosProprios })), own.id).cells.growth as Extract<GrowthCell, { kind: 'ok' }>
    expect(g.atrasadoAte).toBeNull()
    expect(g.cap).not.toContain(', até')
  })
  it('buraco: duas contagens a 60 d viram "buraco na contagem", sem valor e fora da numeração', () => {
    let id = ''
    const { obs } = a3World(ds => {
      const ch = ds.channels.find(c => !c.own)!; id = ch.id
      ch.subs = 1_300_000
      // `retratos()` acima gera 30 d; aqui as duas pontas ficam a 60 d, na mão
      ch.snapshots = [{ t: ds.now - 60 * DAY, date: '', subs: 1_200_000, views: 1 }, { t: ds.now, date: '', subs: 1_300_000, views: 2 }]
    })
    const r = rowOf(todas(buildCanaisView(obs, { niche: 'todos', limit: 75, sort: 'growth' })), id)
    expect(r.cells.growth).toMatchObject({ kind: 'na', motivo: 'buraco', title: 'Faltam registros: não há duas contagens de inscritos com cerca de 30 dias de distância. A medida volta quando houver.' })
    expect(r.valor.growth).toBeNull()
    expect(r.numero).toBeNull()
  })
})

describe('Crescimento do canal próprio pelos retratos MG20 (já lidos pela página)', () => {
  const base = (p: Partial<CanaisParams>) => { const w = a3World(); const own = w.obs.ownChannels()[0]!; return { v: buildCanaisView(w.obs, { niche: 'todos', limit: 75, ...p }), own } }
  it('com 31 dias de retrato: mede como concorrente', () => {
    const w = a3World(); const own = w.obs.ownChannels()[0]!
    const fim = w.obs.NOW
    const retratosProprios = new Map([[own.id, { oculto: false, retratos: [
      { t: fim - 30 * DAY, date: '', subs: 50_000, views: 1 }, { t: fim, date: '', subs: 52_000, views: 2 },
    ] }]])
    const v = buildCanaisView(w.obs, { niche: 'todos', limit: 75, sort: 'growth', retratosProprios })
    const r = rowOf([...v.list.ranked, ...v.list.unranked], own.id)
    expect(r.cells.growth).toMatchObject({ kind: 'ok', big: '+4,0%' })
    expect(r.valor.growth).toBeCloseTo(0.04)
  })
  it('sem retrato: "sem registro", fora da numeração', () => {
    const { v, own } = base({ sort: 'growth', retratosProprios: new Map() })
    const r = rowOf(v.list.unranked, own.id)
    expect(r.cells.growth).toMatchObject({ kind: 'na', motivo: 'sem-registro' })
    expect(r.numero).toBeNull()
  })
  it('leitura falhou: "não carregou", nunca 0', () => {
    const { v, own } = base({ sort: 'growth', retratosProprios: 'erro' })
    const r = rowOf(v.list.unranked, own.id)
    expect(r.cells.growth).toMatchObject({ kind: 'na', motivo: 'nao-carregou', title: 'Não deu para carregar os registros de inscritos do seu canal. Recarregue a página.' })
    expect(r.valor.growth).toBeNull()
  })
})
