// @vitest-environment node
// Nicho como dado no motor: um nicho criado pelo dono (Jogos), um recém-criado sem nada (Pessoal), e os caminhos
// "o dado não existe". O oráculo é carregado UMA vez.
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { BUILTIN_NICHES, type NicheDef } from '@/lib/youtube/observatorio/niche'
import { FORMULAS, formulasFor, hasThemes } from '@/lib/youtube/observatorio/catalog'
import type { Dataset } from '@/lib/youtube/observatorio/types'

const O = loadOracle()
const base = (): Dataset => datasetFromOracle(O)
const jogos: NicheDef = { id: 'jogos', label: 'Jogos', color: { dark: '#D29AE8', light: '#7B2A91' }, order: 100, builtin: false }
const pessoal: NicheDef = { id: 'pessoal', label: 'Pessoal', color: { dark: '#F293C2', light: '#A3216B' }, order: 100, builtin: false }
const UNIVERSAL = ['preco', 'numero', 'pergunta', 'superlativo', 'primeira-pessoa']

/** O dataset do oráculo com Jogos (um concorrente que era de IA, com os vídeos dele) e Pessoal (vazio). */
function three(): { ds: Dataset; moved: string } {
  const ds = base()
  const moved = ds.channels.find(c => !c.own && c.niche === 'ia' && c.sync.state === 'ok')!.id
  ds.channels.find(c => c.id === moved)!.niche = 'jogos'
  for (const v of ds.videos) if (v.ch === moved) v.niche = 'jogos'
  return { ds: { ...ds, niches: [...BUILTIN_NICHES, jogos, pessoal] }, moved }
}
const { ds: DS3, moved: MOVED } = three()
const obs3 = createObservatory(DS3)
const obs2 = createObservatory(base())

describe('motor com um nicho criado pelo dono', () => {
  it('integridade ok; nichos na ordem das abas (de fábrica primeiro, criados depois por order e slug)', () => {
    expect(obs3.integrity).toEqual({ ok: true, errors: [] })
    expect(obs3.niches.map(n => n.id)).toEqual(['viagem', 'ia', 'jogos', 'pessoal'])
    expect(Object.keys(obs3.NICHES)).toEqual(['viagem', 'ia', 'jogos', 'pessoal'])
  })
  it('contagens por aba: Jogos tem o canal movido; IA perdeu um; TAB_COUNTS cobre todos + cada nicho', () => {
    expect(obs3.tabCounts('jogos').canais).toBe(1)
    expect(obs3.TAB_COUNTS.jogos).toEqual(obs3.tabCounts('jogos'))
    expect(obs3.tabCounts('ia').canais).toBe(obs2.tabCounts('ia').canais - 1)
    expect(obs3.tabCounts('todos')).toEqual(obs2.tabCounts('todos'))
    expect(Object.keys(obs3.TAB_COUNTS)).toEqual(['todos', 'viagem', 'ia', 'jogos', 'pessoal'])
  })
  it('rótulo, cor e escopo: nicho desconhecido vira o slug, sem cor, e abre em Todos', () => {
    expect(obs3.nicheLabel('jogos')).toBe('Jogos')
    expect(obs3.nicheLabel('sumiu')).toBe('sumiu')
    expect(obs3.nicheColor('jogos')).toEqual({ dark: '#D29AE8', light: '#7B2A91' })
    expect(obs3.nicheColor('sumiu')).toBeNull()
    expect(obs3.scopeOf('jogos')).toBe('jogos')
    expect(obs3.scopeOf('todos')).toBe('todos')
    expect(obs3.scopeOf('sumiu')).toBe('todos')
    expect(obs3.scopeOf(null)).toBe('todos')
    expect(obs3.scopeOf(undefined)).toBe('todos')
  })
  it('fórmulas: nicho criado só usa as universais; os de fábrica mantêm as do catálogo', () => {
    expect(formulasFor('jogos').map(f => f.id)).toEqual(UNIVERSAL)
    expect(obs3.patternsNow('jogos').patterns.map(p => p.formula)).toEqual(UNIVERSAL)
    expect(formulasFor('ia').map(f => f.id)).toEqual(FORMULAS.filter(f => f.niches.includes('ia')).map(f => f.id))
    expect(formulasFor('viagem').map(f => f.id)).toEqual(FORMULAS.filter(f => f.niches.includes('viagem')).map(f => f.id))
    // como hoje: sem nicho (ou Todos) nenhuma fórmula é analisada
    expect(formulasFor(undefined)).toEqual([])
    expect(formulasFor('todos')).toEqual([])
  })
  it('temas: nicho criado não tem lista; themeTrend não lança e não tem linhas', () => {
    expect(hasThemes('jogos')).toBe(false)
    expect(obs3.hasThemes('jogos')).toBe(false)
    expect(obs3.hasThemes('viagem')).toBe(true)
    expect(obs3.hasThemes('ia')).toBe(true)
    expect([...obs3.themeTrend('jogos')]).toEqual([])
  })
  it('forja: o canal de Jogos é elegível; a ordem da forja é IA, Viagem, Jogos (Pessoal fica fora: sem concorrentes)', () => {
    const e = obs3.forja.eligibleChannels('jogos')
    expect([...e.in, ...e.out.map(o => o.id)]).toEqual([MOVED])
    expect(obs3.hasCompetitors('jogos')).toBe(true)
    expect(obs3.hasCompetitors('pessoal')).toBe(false)
    expect(obs3.forja.niches).toEqual(['ia', 'viagem', 'jogos'])
    expect(['ia', 'viagem', 'jogos', 'pessoal'].map(n => obs3.forja.askable(n))).toEqual([true, true, true, false])
  })
  it('pedido em Todos: um por nicho com concorrente, na ordem da forja, com os rótulos do site', () => {
    const o = createObservatory(DS3)
    const r = o.forja.session.ask('todos', { type: 'resumo-trocas' })
    expect(r.results.map(x => [x.niche, x.ok])).toEqual([['ia', true], ['viagem', true], ['jogos', true]])
    expect(r.scenario.statusLines!.map(l => l.split(':')[0])).toEqual(['IA', 'Viagem', 'Jogos'])
    expect(r.scenario.quota.text.split(' · ').map(t => t.split(':')[0])).toEqual(['IA', 'Viagem', 'Jogos'])
    expect(JSON.stringify(r)).not.toMatch(/undefined|NaN/)
  })
  it('pedido para nicho sem concorrentes: nada enviado, com o motivo; a sessão continua vazia', () => {
    const o = createObservatory(DS3)
    const r = o.forja.session.ask('pessoal', { type: 'resumo-trocas' })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('Nenhum concorrente em Pessoal ainda')
    expect(r.results).toEqual([{ niche: 'pessoal', ok: false, reason: 'Nenhum concorrente em Pessoal ainda' }])
    expect(o.forja.session.state().asks).toEqual([])
  })
  it('nicho recém-criado, sem concorrentes e sem canal próprio: tudo responde vazio, nada lança', () => {
    expect(obs3.tabCounts('pessoal')).toEqual({ canais: 0, mud: 0, out: 0 })
    expect(obs3.ownChannels('pessoal')).toEqual([])
    expect(obs3.nicheRef('pessoal').channels).toEqual([])
    expect(obs3.outliers({ niche: 'pessoal' }).count).toBe(0)
    expect(obs3.patternsNow('pessoal').nVideos).toBe(0)
    expect(obs3.heatmap('pessoal').n).toBe(0)
    expect(obs3.forja.eligibleChannels('pessoal')).toEqual({ in: [], out: [] })
    expect(obs3.forja.latest('temas', 'pessoal')).toBeNull()
    expect(obs3.forja.preview('resumo-trocas', 'pessoal').channelsIn).toEqual([])
  })
  it('a ordem do aviso de sincronização segue a ordem das abas (Viagem, IA, Jogos)', () => {
    const via = obs3.channels.find(c => !c.own && c.niche === 'viagem')!, ia = obs3.channels.find(c => !c.own && c.niche === 'ia')!
    const t = obs3.syncResultToast({ ok: [], problems: [{ id: MOVED, label: 'c' }, { id: ia.id, label: 'b' }, { id: via.id, label: 'a' }], outOfRound: [] })
    expect(t.body).toBe(`${via.name}: a; ${ia.name}: b; ${obs3.channel(MOVED)!.name}: c.`)
  })
})

describe('o dado não existe', () => {
  it('dataset sem `niches` → os dois de fábrica, e TAB_COUNTS byte a byte igual ao do oráculo', () => {
    expect(obs2.niches).toEqual(BUILTIN_NICHES)
    expect(JSON.stringify(obs2.TAB_COUNTS)).toBe(JSON.stringify({ todos: O.TAB_COUNTS.todos, viagem: O.TAB_COUNTS.viagem, ia: O.TAB_COUNTS.ia }))
    expect(obs2.forja.niches).toEqual(['ia', 'viagem'])
    expect(obs2.NICHES).toEqual({ viagem: BUILTIN_NICHES[0], ia: BUILTIN_NICHES[1] })
  })
  it('`niches: []` também vale os de fábrica (nunca um Observatório sem nicho nenhum)', () => {
    expect(createObservatory({ ...base(), niches: [] }).niches.map(n => n.id)).toEqual(['viagem', 'ia'])
  })
  it('canal apontando para nicho fora da lista não some: fica sem nicho (com os vídeos), e continua em Todos', () => {
    const ds = base()
    const id = ds.channels.find(c => !c.own && c.niche === 'ia')!.id
    ds.channels.find(c => c.id === id)!.niche = 'sumiu'
    for (const v of ds.videos) if (v.ch === id) v.niche = 'sumiu'
    const o = createObservatory(ds)
    expect(o.integrity.ok).toBe(true)
    expect(o.channel(id)!.niche).toBeNull()
    expect(o.videos.filter(v => v.ch === id).every(v => v.niche === null)).toBe(true)
    expect(o.tabCounts('todos').canais).toBe(obs2.tabCounts('todos').canais)
    expect(o.tabCounts('ia').canais).toBe(obs2.tabCounts('ia').canais - 1)
    // o dataset de entrada não é alterado
    expect(ds.channels.find(c => c.id === id)!.niche).toBe('sumiu')
  })
  it('nicho de fábrica sem concorrente continua pedível, como sempre foi (a regra nova vale só para os criados pelo dono)', () => {
    const ds = base()
    const own = new Set(ds.channels.filter(c => c.own).map(c => c.id))
    const ia = new Set(ds.channels.filter(c => !c.own && c.niche === 'ia').map(c => c.id))
    const o = createObservatory({ ...ds, channels: ds.channels.filter(c => !ia.has(c.id)), videos: ds.videos.filter(v => !ia.has(v.ch)), readings: [], requests: [] })
    expect(own.size).toBeGreaterThan(0)
    expect(o.hasCompetitors('ia')).toBe(false)
    expect(o.forja.askable('ia')).toBe(true)
    expect(o.forja.niches).toEqual(['ia', 'viagem'])
    const r = o.forja.session.ask('todos', { type: 'resumo-trocas' })
    expect(r.results.map(x => [x.niche, x.ok])).toEqual([['ia', true], ['viagem', true]])
  })
  it('site sem um dos de fábrica na lista: a forja não inventa o nicho', () => {
    const o = createObservatory({ ...base(), niches: [BUILTIN_NICHES[0]!] })
    expect(o.niches.map(n => n.id)).toEqual(['viagem'])
    expect(o.forja.niches).toEqual(['viagem'])
    expect(o.scopeOf('ia')).toBe('todos')
  })
})
