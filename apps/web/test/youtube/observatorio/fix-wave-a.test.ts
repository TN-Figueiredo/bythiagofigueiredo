// @vitest-environment node
// Rodada de correção A: célula de crescimento sem percentual, gaveta de canal próprio (R79), lista vazia (R80), Lacunas sem concorrente (R78).
import { describe, it, expect } from 'vitest'
import { loadOracle, loadOracleOwns, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildInsightsView } from '@/app/cms/(authed)/youtube/competitors/_insights/view-model'

const DAY = 864e5
const withoutCompetitors = (b: Dataset, niche: 'viagem' | 'ia'): Dataset => {
  const ds = structuredClone(b); const gone = new Set(ds.channels.filter(c => !c.own && c.niche === niche).map(c => c.id))
  ds.channels = ds.channels.filter(c => !gone.has(c.id)); ds.videos = ds.videos.filter(v => !gone.has(v.ch))
  ds.readings = []; ds.requests = []
  return ds
}
const base = () => datasetFromOracle(loadOracle())
const rowOf = (ds: Dataset, id: string, p = {}) => buildCanaisView(createObservatory(ds), { niche: 'todos', limit: 75, ...p }).groups.flatMap(g => g.rows).find(r => r.id === id)!

describe('growthCell: sem percentual calculável não há percentual nem seta', () => {
  const comp = (subs: number | null, prevSubs: number) => {
    const ds = base()
    const c = ds.channels.find(x => !x.own && x.sync.state === 'ok' && x.niche != null)!
    c.subs = subs
    c.snapshots = [{ t: ds.now - 31 * DAY, date: 'a', subs: prevSubs, views: 0 }, { t: ds.now - DAY, date: 'b', subs: 5000, views: 0 }]
    return { ds, id: c.id }
  }
  it('pct null com abs presente: só o valor absoluto, sem "0,0%" nem "−"', () => {
    const { ds, id } = comp(5000, 0)
    const g = rowOf(ds, id).cells.growth
    expect(JSON.stringify(g)).not.toMatch(/0,0%|−/)
    expect(g.kind).toBe('na')
    expect(JSON.stringify(g)).toMatch(/5\D?mil/)
    expect(JSON.stringify(g)).toMatch(/30\D?d/)
  })
  it('a gaveta não afirma "−0,0%" nesse caso', () => {
    const { ds, id } = comp(5000, 0)
    const d = buildCanaisView(createObservatory(ds), { niche: 'todos', limit: 75, channel: id }).drawer!
    expect(JSON.stringify(d.stats)).not.toMatch(/0,0%|−0/)
  })
  it('subs === 0 de verdade NÃO vira "Inscritos ocultos"', () => {
    const { ds, id } = comp(0, 4000)
    const r = rowOf(ds, id)
    expect(r.subs).not.toBe('Inscritos ocultos')
    expect(r.vpd).not.toMatch(/ocultos/)
    expect(rowOf(ds, id, { scale: 'per-mil' }).vpd).not.toMatch(/ocultos/)
  })
  it('subs null: a linha diz "Inscritos ocultos"; sem mediana de views/dia o ramo não vale e a célula diz o que falta', () => {
    const { ds, id } = comp(null, 4000)
    expect(rowOf(ds, id, { scale: 'per-mil' }).vpd).toMatch(/Inscritos ocultos/)
    for (const v of ds.videos) if (v.ch === id) v.series = []
    const r = rowOf(ds, id, { scale: 'per-mil' })
    expect(r.subs).toBe('Inscritos ocultos')
    expect(r.vpd).not.toMatch(/Inscritos ocultos/)
  })
})

describe('R79: gaveta de canal próprio não afirma views diárias', () => {
  const own = () => { const ds = datasetFromOracle(loadOracleOwns('2')); return { ds, id: ds.channels.find(c => c.own)!.id } }
  const drawer = (ds: Dataset, id: string) => buildCanaisView(createObservatory(ds), { niche: 'todos', limit: 75, channel: id }).drawer!
  it('cobertura sem a oração de views diárias; estatística diz "sem views diárias do seu canal"', () => {
    const { ds, id } = own()
    for (const v of ds.videos) if (v.ch === id) v.series = [] // production: an own channel has no daily record
    const d = drawer(ds, id)
    expect(d.cov).toMatch(/^Acompanhando \d+ vídeos \(limite deste canal/)
    expect(d.cov).not.toMatch(/views diárias/)
    const vpd = d.stats.find(s => s.label.startsWith('Views/dia'))!
    expect(vpd.sub).toBe('sem views diárias do seu canal')
  })
  it('concorrente não muda', () => {
    const c = base().channels.find(x => !x.own && x.sync.state === 'ok')!
    const d = drawer(base(), c.id)
    expect(d.cov).toMatch(/com views diárias desde/)
  })
})

describe('R80: lista vazia de um nicho só com canais próprios', () => {
  const noComp = (niche: 'viagem' | 'ia') => {
    const ds = datasetFromOracle(loadOracleOwns('2'))
    return createObservatory(withoutCompetitors(ds, niche))
  }
  it('com canal próprio visível: "Nenhum concorrente em Viagem."', () => {
    const v = buildCanaisView(noComp('viagem'), { niche: 'viagem', limit: 75 })
    expect(v.own.rows.length).toBeGreaterThan(0)
    expect(v.emptyText).toBe('Nenhum concorrente em Viagem. Para acompanhar um canal novo, use Adicionar canal.')
  })
  it('sem canal próprio visível: continua "Nenhum canal em IA."', () => {
    const v = buildCanaisView(noComp('ia'), { niche: 'ia', limit: 75 })
    expect(v.own.rows).toHaveLength(0)
    expect(v.emptyText).toBe('Nenhum canal em IA. Para acompanhar um canal novo, use Adicionar canal.')
  })
})

describe('R78: Lacunas sem concorrente no nicho', () => {
  it('o cabeçalho (meta) fica vazio; o card diz a frase', () => {
    const ds = datasetFromOracle(loadOracleOwns('2'))
    const g = buildInsightsView(createObservatory(withoutCompetitors(ds, 'viagem')), { niche: 'viagem' }).gaps!
    expect(g.noRef).not.toBeNull()
    expect(g.meta).toBe('')
  })
})
