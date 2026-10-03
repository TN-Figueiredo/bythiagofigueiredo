// @vitest-environment node
// Revisão final: F2 (R79, aba Vídeos), F3 (R81), F4 (R80), F5, F6, F9.
import { describe, it, expect } from 'vitest'
import { loadOracle, loadOracleOwns, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildInsightsView } from '@/app/cms/(authed)/youtube/competitors/_insights/view-model'

const own2 = () => datasetFromOracle(loadOracleOwns('2'))
const canais = (ds: Dataset, p = {}) => buildCanaisView(createObservatory(ds), { niche: 'todos', limit: 75, ...p })

describe('F2 (R79): aba Vídeos da gaveta de canal próprio', () => {
  it('sem promessa de média nem de views diárias', () => {
    const ds = own2(); const id = ds.channels.find(c => c.own)!.id
    for (const v of ds.videos) if (v.ch === id) v.series = [] // produção: canal próprio não tem registro diário
    const d = canais(ds, { channel: id, tab: 'videos' }).drawer!
    expect(d.videos.rows.length).toBeGreaterThan(0)
    for (const r of d.videos.rows) { expect(r.vp.text).toBe('sem views diárias do seu canal'); expect(r.vp.text).not.toMatch(/média sai/) }
    expect(d.videos.intro).not.toMatch(/Média de views\/dia/)
    expect(d.videos.intro).toMatch(/^Lista completa: /)
  })
  it('concorrente não muda', () => {
    const ds = datasetFromOracle(loadOracle()); const c = ds.channels.find(x => !x.own && x.sync.state === 'ok')!
    expect(canais(ds, { channel: c.id, tab: 'videos' }).drawer!.videos.intro).toMatch(/^Média de views\/dia nos últimos 7 dias\./)
  })
})

describe('F9: gaveta de concorrente diz o mesmo motivo que a tabela', () => {
  it('sem registro diário: "Aguardando o 2º registro diário." nos dois lugares', () => {
    const ds = datasetFromOracle(loadOracle()); const c = ds.channels.find(x => !x.own && x.sync.state === 'ok' && x.niche != null)!
    for (const v of ds.videos) if (v.ch === c.id) v.series = []
    const view = canais(ds, { channel: c.id })
    const row = view.groups.flatMap(g => g.rows).find(r => r.id === c.id)!
    expect(row.vpd).toBe('Aguardando o 2º registro diário.')
    const sub = view.drawer!.stats.find(s => s.label.startsWith('Views/dia'))!.sub
    expect(sub).toBe('Aguardando o 2º registro diário.')
  })
})

const withoutComp = (niche: 'viagem' | 'ia') => {
  const ds = structuredClone(own2()); const gone = new Set(ds.channels.filter(c => !c.own && c.niche === niche).map(c => c.id))
  ds.channels = ds.channels.filter(c => !gone.has(c.id)); ds.videos = ds.videos.filter(v => !gone.has(v.ch)); ds.readings = []; ds.requests = []
  return ds
}
describe('F4 (R80): lista vazia aponta o editor de nicho quando há concorrente sem nicho', () => {
  const unnicheN = (ds: Dataset, n: number) => { for (const c of ds.channels.filter(x => !x.own && x.niche === 'ia').slice(0, n)) c.niche = null }
  it('N concorrentes sem nicho: diz quantos e liga ao editor', () => {
    const ds = withoutComp('viagem'); unnicheN(ds, 3)
    const v = canais(ds, { niche: 'viagem' })
    expect(v.emptyText).toBe('Nenhum concorrente em Viagem. Há 3 concorrentes sem nicho: defina o nicho deles.')
    expect(v.emptyLink).toEqual({ text: 'defina o nicho deles', href: createObservatory(ds).link.canais({ nicheEditor: 1 }) })
  })
  it('1 concorrente sem nicho: singular', () => {
    const ds = withoutComp('viagem'); unnicheN(ds, 1)
    expect(canais(ds, { niche: 'viagem' }).emptyText).toBe('Nenhum concorrente em Viagem. Há 1 concorrente sem nicho: defina o nicho dele.')
  })
  it('sem canal próprio visível mantém "canal" no primeiro período (R80)', () => {
    const ds = withoutComp('ia'); unnicheN(ds, 0); for (const c of ds.channels.filter(x => !x.own && x.niche === 'viagem').slice(0, 2)) c.niche = null
    const v = canais(ds, { niche: 'ia' })
    expect(v.own.rows).toHaveLength(0)
    expect(v.emptyText).toBe('Nenhum canal em IA. Há 2 concorrentes sem nicho: defina o nicho deles.')
  })
  it('sem concorrente sem nicho: a frase de antes, sem link', () => {
    const v = canais(withoutComp('viagem'), { niche: 'viagem' })
    expect(v.emptyText).toBe('Nenhum concorrente em Viagem. Para acompanhar um canal novo, use Adicionar canal.')
    expect(v.emptyLink).toBeNull()
  })
})

describe('F5: "Ver seus canais" leva a uma aba com os canais próprios', () => {
  it('o link aponta para Todos', () => {
    const ds = own2()
    for (const c of ds.channels.filter(x => x.own)) c.niche = 'viagem'
    const o = createObservatory(ds)
    const json = JSON.stringify(buildInsightsView(o, { niche: 'ia' }))
    const hrefs = [...json.matchAll(/"href":"([^"]*)","text":"Ver seus canais"/g)].map(m => m[1])
    expect(hrefs.length).toBeGreaterThan(0)
    for (const h of hrefs) expect(h).toBe(o.link.canais({ niche: 'todos' }))
    expect(o.link.canais({ niche: 'todos' })).toMatch(/niche=todos/)
  })
})

describe('F6: Views/dia do canal próprio sem views diárias diz o motivo real', () => {
  it('a célula não diz "base fraca (n = 0)"', () => {
    const ds = own2()
    for (const v of ds.videos) if (ds.channels.find(c => c.id === v.ch)!.own) v.series = []
    const y = buildInsightsView(createObservatory(ds), { niche: 'viagem' }).youInNiche!
    const idx = y.cols.findIndex(c => c.key === 'perMilSubs')
    const rows = y.rows.filter(r => r.cells)
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      const cell = r.cells![idx]!
      expect(cell.kind).toBe('nodata')
      if (cell.kind === 'nodata') { expect(cell.base).toBe('sem views diárias do seu canal'); expect(cell.baseTitle).toBe('O observatório guarda a contagem diária de views só dos concorrentes.') }
    }
  })
})

describe('F3 (R81): Lacunas sem tema em nenhum vídeo próprio', () => {
  it('a recusa é a frase da regra, sem prometer prazo', () => {
    const ds = own2(); for (const v of ds.videos) if (ds.channels.find(c => c.id === v.ch)!.own) v.theme = null
    const g = buildInsightsView(createObservatory(ds), { niche: 'viagem' }).gaps!
    expect(g.empty!.title).toBe('A leitura de temas da forja ainda não inclui os seus vídeos: sem tema, não há como apontar lacunas.')
    expect(g.empty!.text).toBe('')
  })
})
