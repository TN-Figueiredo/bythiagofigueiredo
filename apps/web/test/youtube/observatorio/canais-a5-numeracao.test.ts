// @vitest-environment node
// A5 2ª leva, D3: a coluna P numera toda ordenação (posição canônica, empate de competição), empate A–Z nos dois sentidos,
// Direção ordenável, sem medida no fim e nunca zero.
import { describe, it, expect } from 'vitest'
import { a3World } from './a3-fixture'
import { medidasDoMotor, direcaoMedida } from './canais-e5a-fixture'
import { naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import { buildCanaisView, type CanaisParams, type CanaisRow, type CanaisSort, type CanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'

const DAY = 86_400_000
const all = (v: CanaisView): CanaisRow[] => [...v.list.ranked, ...v.list.unranked]
const view = (obs: Observatory, p: Partial<CanaisParams> = {}) => buildCanaisView(obs, { niche: 'todos', limit: 75, ...p })
const comps = (ds: Dataset) => ds.channels.filter(c => !c.own)

/** Retratos sintéticos de 31 dias com o ganho pedido (o último é "hoje" do mundo). */
function retratos(ds: Dataset, id: string, de: number, ganho: number) {
  const ch = ds.channels.find(c => c.id === id)!
  const fim = ds.now
  ch.subs = de + ganho
  ch.snapshots = [
    { t: fim - 30 * DAY, date: new Date(fim - 30 * DAY).toISOString().slice(0, 10), subs: de, views: 1 },
    { t: fim, date: new Date(fim).toISOString().slice(0, 10), subs: de + ganho, views: 2 },
  ]
}

describe('numeração (coluna P)', () => {
  it('Ritmo, Outliers, Trocas e Crescimento também numeram: 1º é o maior', () => {
    const { obs } = a3World()
    for (const sort of ['active', 'outliers', 'swaps', 'growth'] as CanaisSort[]) {
      const v = view(obs, { sort })
      const com = v.list.ranked.filter(r => r.numero)
      expect(com.length, sort).toBeGreaterThan(0)
      const max = Math.max(...com.map(r => r.valor[sort]!))
      expect(com.find(r => r.valor[sort] === max)!.numero!.pos, sort).toBe(1)
      expect(v.list.unranked.every(r => r.numero === null), sort).toBe(true)
    }
  })
  it('pos (as frases do dono) só existe em Inscritos e Views/dia', () => {
    const { obs } = a3World()
    expect(all(view(obs, { sort: 'growth' })).every(r => r.pos === null)).toBe(true)
    expect(all(view(obs, { sort: 'subs' })).some(r => r.pos !== null)).toBe(true)
  })
  it('ordem crescente inverte a lista mas não a posição (1º continua o maior)', () => {
    const { obs } = a3World()
    const desc = view(obs, { sort: 'subs', dir: 'desc' }).list.ranked
    const asc = view(obs, { sort: 'subs', dir: 'asc' }).list.ranked
    expect(asc[0]!.numero!.pos).toBe(Math.max(...asc.map(r => r.numero!.pos)))
    expect(desc[0]!.numero!.pos).toBe(1)
  })
})

describe('empate', () => {
  it('zero exato e dentro do arredondamento dividem a posição, A–Z nos dois sentidos, entre quem cresceu e quem perdeu', () => {
    const { obs } = a3World(ds => {
      const [a, b, c, d] = comps(ds)
      a!.name = 'Zeta'; b!.name = 'Alfa'
      retratos(ds, a!.id, 1_200_000, 0)          // zero exato
      retratos(ds, b!.id, 1_200_000, 10_000)     // 1 passo: dentro de 2 passos
      retratos(ds, c!.id, 1_200_000, 60_000)     // cresceu
      retratos(ds, d!.id, 1_200_000, -60_000)    // perdeu
    })
    for (const dir of ['desc', 'asc'] as const) {
      const r = view(obs, { sort: 'growth', dir }).list.ranked
      // Afirma sobre o subconjunto com chave "0" (valor 0): não depende de nenhum outro canal do a3World cair no meio de "Alfa" e "Zeta".
      const zeros = r.filter(x => x.valor.growth === 0)
      expect(zeros.map(x => x.name), dir).toEqual(zeros.map(x => x.name).sort((p, q) => p.localeCompare(q, 'pt-BR'))) // A–Z também no crescente
      expect(zeros.length).toBeGreaterThanOrEqual(2)
      expect(new Set(zeros.map(x => x.numero!.pos)).size).toBe(1)
      expect(zeros.every(x => x.numero!.empate)).toBe(true)
      expect(zeros.map(x => x.name)).toEqual(expect.arrayContaining(['Alfa', 'Zeta']))
    }
  })
})

describe('Direção ordenável', () => {
  it('abre com quem mais sobe; não medido e não carregou no fim, nunca 0; canal próprio fora', () => {
    const { obs } = a3World()
    const [a, b, c, d] = obs.channels.filter(x => !x.own)
    // `medidasDoMotor` dá a todo concorrente SEM entrada `m3a: direcaoMedida(120, 100)` (+20% medido): o "não medido" tem de ser declarado.
    const medidas = medidasDoMotor(obs, {
      [a!.id]: { m3a: direcaoMedida(1500, 1000) },   // +50%
      [b!.id]: { m3a: direcaoMedida(900, 1000) },    // −10%
      [c!.id]: 'nao_carregou',
      [d!.id]: { m3a: naoMedido('pouco_registro', { n: 20, fechaEm: '2026-11-15' }) }, // import de medidas/tipos
    })
    const v = view(obs, { sort: 'direcao', medidas })
    expect(v.list.ranked[0]!.id).toBe(a!.id)
    expect(v.list.ranked.every(r => r.valor.direcao !== null)).toBe(true)
    const fim = v.list.unranked.map(r => r.id)
    expect(fim).toContain(c!.id)
    expect(fim).toContain(d!.id)
    expect(v.list.unranked.filter(r => r.own).every(r => r.valor.direcao === null)).toBe(true)
  })
  it('sem medida no fim: concorrentes antes dos próprios, A–Z dentro de cada grupo (inscritos em ordem oposta ao nome)', () => {
    // 3 concorrentes "não carregou", nomes e inscritos em ordem oposta: o mutante "manter subsDesc no fim" não sobrevive.
    const ids: string[] = [] // capturados dentro do mutador: nada de adivinhar o acessor do dataset (Re-revisão M-d)
    const { obs } = a3World(ds => {
      const [x, y, z] = comps(ds)
      ids.push(x!.id, y!.id, z!.id)
      x!.name = 'Canal Ômega'; x!.subs = 900_000
      y!.name = 'Canal Beta'; y!.subs = 50_000
      z!.name = 'Canal Alfa'; z!.subs = 10_000
    })
    const medidas = medidasDoMotor(obs, Object.fromEntries(ids.map(id => [id, 'nao_carregou'])))
    const v = view(obs, { sort: 'direcao', medidas })
    const u = v.list.unranked
    const ultimoComp = u.map(r => r.own).lastIndexOf(false), primeiroOwn = u.findIndex(r => r.own)
    if (primeiroOwn >= 0) expect(ultimoComp).toBeLessThan(primeiroOwn)
    const nomes = u.filter(r => !r.own).map(r => r.name)
    expect(nomes.length).toBeGreaterThanOrEqual(3)
    expect(nomes).toEqual([...nomes].sort((x, y) => x.localeCompare(y, 'pt-BR')))
  })
})

describe('conjunto', () => {
  it('canal próprio sem nicho num nicho: aparece, sem número, e não pula a numeração', () => {
    const { obs } = a3World(ds => { const o = ds.channels.find(c => c.own)!; o.niche = null })
    const nicho = obs.channels.find(c => !c.own)!.niche!
    const v = view(obs, { niche: nicho, sort: 'subs' })
    const own = all(v).find(r => r.own && r.niche == null)!
    expect(own.numero).toBeNull()
    const ns = v.list.ranked.filter(r => r.numero).map(r => r.numero!.pos)
    expect(ns[0]).toBe(1)
  })
  it('filtro "só com problema" não renumera', () => {
    const { obs } = a3World()
    const todos = new Map(all(view(obs, { sort: 'growth' })).map(r => [r.id, r.numero?.pos]))
    const filtrados = all(view(obs, { sort: 'growth', filter: 'problemas' }))
    // Pré-condição: se nenhum canal filtrado tem posição > 1, o mutante "numerar sobre os visíveis" sobreviveria.
    expect(filtrados.some(r => r.numero!.pos > 1)).toBe(true)
    for (const r of filtrados) expect(r.numero?.pos).toBe(todos.get(r.id))
  })
})
