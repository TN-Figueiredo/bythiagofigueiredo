// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { loadOracle, loadOracleOwns, datasetFromOracle } from './oracle'
import type { OwnPreset } from '../../fixtures/observatorio/own-presets'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { shortVerdict, type NicheMetricKey, type OwnMetric } from '@/lib/youtube/observatorio/insights'

const dsOf = (p: OwnPreset): Dataset => datasetFromOracle(loadOracleOwns(p))
const obsOf = (p: OwnPreset) => createObservatory(dsOf(p))
const ids = (list: Array<{ id: string }>) => list.map(c => c.id)
const KEYS: NicheMetricKey[] = ['pw', 'perMilSubs', 'typicalMult', 'engagement', 'pctOutliers']
const NICHES = ['todos', 'viagem', 'ia'] as const
const FMTS = ['long', 'short'] as const
const OWN_METRIC_FIELDS: (keyof OwnMetric)[] = ['value', 'median', 'ratio', 'bothZero', 'verdict', 'verdictText', 'label', 'n', 'few']
const metric = (over: Partial<OwnMetric>): OwnMetric => ({ value: 1, median: 1, ratio: 1, bothZero: false, verdict: '≈', verdictText: 'na mediana do nicho (±15%)', label: '1× a mediana do nicho', n: 20, few: false, ...over })
/** O dataset sem nenhum canal próprio (e sem os vídeos deles). */
function withoutOwns(ds: Dataset): Dataset {
  const own = new Set(ds.channels.filter(c => c.own).map(c => c.id))
  return { ...ds, channels: ds.channels.filter(c => !c.own), videos: ds.videos.filter(v => !own.has(v.ch)) }
}

describe('ownChannels — ordem R73', () => {
  it("preset '5': inscritos, maior primeiro", () => {
    expect(ids(obsOf('5').ownChannels())).toEqual(['thiago-na-estrada', 'tnfigueiredo', 'slow-roads', 'mochila-leve', 'tnfigueiredo-en'])
  })
  it('empate de inscritos → nome; nome igual → id; estável entre chamadas', () => {
    const ds = dsOf('5')
    const a = ds.channels.find(c => c.id === 'slow-roads')!, b = ds.channels.find(c => c.id === 'mochila-leve')!
    a.subs = b.subs
    const byName = createObservatory(ds)
    const pair = (o: typeof byName) => ids(o.ownChannels()).filter(id => id === a.id || id === b.id)
    const wantByName = [a, b].sort((x, y) => x.name.localeCompare(y.name, 'pt-BR')).map(c => c.id)
    expect(a.name).not.toBe(b.name)
    expect(pair(byName)).toEqual(wantByName)
    // o dataset na ordem inversa dá a mesma resposta (a ordem não depende da ordem de entrada)
    expect(pair(createObservatory({ ...ds, channels: [...ds.channels].reverse() }))).toEqual(wantByName)
    a.name = b.name
    const byId = createObservatory(ds)
    expect(pair(byId)).toEqual(['mochila-leve', 'slow-roads'])
    expect(pair(createObservatory({ ...ds, channels: [...ds.channels].reverse() }))).toEqual(['mochila-leve', 'slow-roads'])
    expect(ids(byId.ownChannels())).toEqual(ids(byId.ownChannels()))
  })
  it('não muta a lista de canais do motor e devolve uma lista nova a cada chamada', () => {
    const obs = obsOf('5'), before = ids(obs.channels)
    const first = obs.ownChannels()
    first.reverse()
    expect(ids(obs.channels)).toEqual(before)
    expect(ids(obs.ownChannels())).toEqual(['thiago-na-estrada', 'tnfigueiredo', 'slow-roads', 'mochila-leve', 'tnfigueiredo-en'])
  })
  it("filtro por nicho (preset 'mix' e 'zero')", () => {
    const mix = obsOf('mix')
    expect(ids(mix.ownChannels('ia'))).toEqual(['thiago-testa-ia'])
    expect(ids(mix.ownChannels(null))).toEqual(['mochila-leve'])
    expect(mix.ownChannels('viagem')).toHaveLength(3)
    expect(mix.ownChannels('todos')).toHaveLength(5)
    expect(mix.ownChannels()).toHaveLength(5)
    expect(obsOf('zero').ownChannels('viagem')).toEqual([])
  })
})

describe('zero canais próprios', () => {
  const obs = createObservatory(withoutOwns(dsOf('5')))
  it('ownChannels() vazio em todos os recortes', () => {
    expect(obs.ownChannels()).toEqual([])
    expect(obs.ownChannels('viagem')).toEqual([])
    expect(obs.ownChannels(null)).toEqual([])
  })
  it('ownNicheStats devolve owns vazio e a referência inteira, sem lançar', () => {
    const r = obs.ownNicheStats('viagem', 'long', [])
    expect(r.owns).toEqual([])
    expect(r.ref.channels.length).toBeGreaterThan(0)
    expect(r.ref.pw.median).not.toBeNull()
    expect(JSON.stringify(r)).not.toMatch(/NaN|undefined/)
    // ids pedidos que não existem mais também não lançam
    expect(obs.ownNicheStats('viagem', 'long', ['tnfigueiredo']).owns).toEqual([])
  })
  it('caminho legado: nicheStats().own === null e ownCoverage sem canal', () => {
    expect(obs.nicheStats('viagem', 'long').own).toBeNull()
    expect(obs.ownCoverage('long')).toMatchObject({ channel: null, n: 0, themed: 0 })
  })
})

describe('nicheRef — a referência é uma só', () => {
  const obs = obsOf('5')
  const cases = NICHES.flatMap(n => FMTS.map(f => [n, f] as const))
  it.each(cases)('%s %s: mesmas agregações e canais de nicheStats', (n, f) => {
    const ref = obs.nicheRef(n, f), st = obs.nicheStats(n, f)
    for (const k of KEYS) expect(ref[k]).toEqual(st[k])
    expect(ref.channels).toEqual(st.channels)
    expect(ref.niche).toBe(st.niche)
    expect(ref.fmt).toBe(f)
    expect(ref.threshold).toBe(0.15)
    expect(ref.fewN).toBe(10)
  })
  it('não depende dos canais próprios: igual nos presets 1 e 5 e sem nenhum próprio', () => {
    const one = obsOf('1').nicheRef('viagem', 'long')
    expect(obs.nicheRef('viagem', 'long')).toEqual(one)
    expect(createObservatory(withoutOwns(dsOf('5'))).nicheRef('viagem', 'long')).toEqual(one)
    expect(one.channels.every(id => !obs.channel(id)!.own)).toBe(true)
  })
  it('padrões: sem argumentos = todos, longos', () => {
    expect(obs.nicheRef()).toEqual(obs.nicheRef('todos', 'long'))
  })
})

describe('ownNicheStats — um bloco por canal', () => {
  it("preset '5': ordem de ownIds e métricas iguais às de nicheStats(n, f, id).own", () => {
    const obs = obsOf('5'), list = ids(obs.ownChannels('viagem'))
    expect(list.length).toBeGreaterThan(1)
    const r = obs.ownNicheStats('viagem', 'long', list)
    expect(r.owns.map(o => o.channel)).toEqual(list)
    expect(r.ref).toEqual(obs.nicheRef('viagem', 'long'))
    for (const o of r.owns) {
      const legacy = obs.nicheStats('viagem', 'long', o.channel).own!
      for (const k of KEYS) for (const f of OWN_METRIC_FIELDS) expect([o.channel, k, f, o[k][f]]).toEqual([o.channel, k, f, legacy[k][f]])
    }
    // a ordem pedida é respeitada, qualquer que seja
    const rev = [...list].reverse()
    expect(obs.ownNicheStats('viagem', 'long', rev).owns.map(o => o.channel)).toEqual(rev)
  })
  it("valores conferidos no oráculo (preset '2', Viagem, longos)", () => {
    const oracle = loadOracleOwns('2'), obs = createObservatory(datasetFromOracle(oracle))
    const r = obs.ownNicheStats('viagem', 'long', ['tnfigueiredo', 'tnfigueiredo-en'])
    const [pt, en] = r.owns
    expect(pt!.channel).toBe('tnfigueiredo')
    expect(pt!.pw).toMatchObject({ value: 0.6, n: 8, few: true, short: '0,6× a mediana', weak: true })
    expect(pt!.perMilSubs).toMatchObject({ short: '1,8× a mediana', n: 29, weak: false })
    expect(en!.channel).toBe('tnfigueiredo-en')
    expect(en!.pw).toMatchObject({ value: 0.2, short: '0,2× a mediana' })
    expect(en!.pctOutliers).toMatchObject({ value: null, short: 'sem dado', n: 0, weak: true })
    // e o oráculo diz o mesmo, canal a canal
    for (const o of r.owns) {
      const want = JSON.parse(JSON.stringify(oracle.nicheStats('viagem', 'long', o.channel).own))
      for (const k of KEYS) for (const f of OWN_METRIC_FIELDS) expect([o.channel, k, f, o[k][f]]).toEqual([o.channel, k, f, want[k][f]])
    }
  })
  it('weak = sem valor ou n < fewN, em toda célula', () => {
    const obs = obsOf('5'), r = obs.ownNicheStats('todos', 'long', ids(obs.ownChannels()))
    for (const o of r.owns) for (const k of KEYS) expect(o[k].weak).toBe(o[k].value == null || o[k].n < r.ref.fewN)
  })
  it("videos, empty e syncText (preset '5', Shorts)", () => {
    const obs = obsOf('5'), list = ids(obs.ownChannels('viagem'))
    const r = obs.ownNicheStats('viagem', 'short', list)
    const row = r.owns.find(o => o.channel === 'mochila-leve')!
    expect(row.videos).toBe(0)
    expect(row.empty).toBe(true)
    for (const o of r.owns) {
      expect(o.syncText).toBe(obs.syncText(o.channel))
      expect(o.videos).toBe(obs.cadence(o.channel, 'short').n)
      expect(o.empty).toBe(o.videos === 0)
    }
    // canal sem vídeos no formato: toda célula é base fraca (a tela decide por `empty`/`weak`, nunca pinta veredito).
    for (const k of KEYS) { expect(row[k].n).toBe(0); expect(row[k].weak).toBe(true) }
    for (const k of KEYS.filter(k => k !== 'pw')) { expect(row[k].value).toBeNull(); expect(row[k].short).toBe('sem dado') }
    // a cadência de um canal sem vídeos é 0 por semana (igual ao oráculo), não "sem dado": por isso `empty` existe.
    expect(row.pw).toMatchObject({ value: 0, verdict: '▼', short: '0,0× a mediana' })
  })
  it('ids ruins: desconhecido e concorrente são ignorados', () => {
    const obs = obsOf('5')
    expect(obs.ownNicheStats('viagem', 'long', ['nope', 'luke-damant', 'tnfigueiredo']).owns.map(o => o.channel)).toEqual(['tnfigueiredo'])
  })
  it('formato omitido = longos', () => {
    const obs = obsOf('2')
    expect(obs.ownNicheStats('viagem', undefined, ['tnfigueiredo'])).toEqual(obs.ownNicheStats('viagem', 'long', ['tnfigueiredo']))
  })
})

describe('shortVerdict', () => {
  it('tira " do nicho" do rótulo', () => {
    expect(shortVerdict('pw', metric({ label: '0,6× a mediana do nicho' }))).toBe('0,6× a mediana')
  })
  it('pctOutliers usa o texto do veredito, não a razão', () => {
    expect(shortVerdict('pctOutliers', metric({ verdictText: 'abaixo da mediana do nicho', label: '0,5× a mediana do nicho' }))).toBe('abaixo da mediana')
    expect(shortVerdict('pctOutliers', metric({ verdictText: 'na mediana do nicho (±15%)', label: '1× a mediana do nicho' }))).toBe('na mediana (±15%)')
  })
  it('pctOutliers com as duas em 0% usa o rótulo', () => {
    expect(shortVerdict('pctOutliers', metric({ bothZero: true, verdictText: 'igual à mediana do nicho (as duas em 0%)', label: 'igual à mediana (as duas em 0%)' }))).toBe('igual à mediana (as duas em 0%)')
  })
  it('rótulos sem " do nicho" passam iguais', () => {
    expect(shortVerdict('pw', metric({ label: 'acima (mediana em 0)' }))).toBe('acima (mediana em 0)')
    expect(shortVerdict('pw', metric({ label: 'sem dado', verdictText: 'sem dado' }))).toBe('sem dado')
    expect(shortVerdict('pctOutliers', metric({ label: 'sem dado', verdictText: 'sem dado' }))).toBe('sem dado')
  })
})

describe('ownCoverage por canal', () => {
  const obs = obsOf('2')
  it('canal explícito', () => {
    const en = obs.ownCoverage('long', 'tnfigueiredo-en')
    expect(en.channel).toBe('tnfigueiredo-en')
    expect(en.n).toBe(3)
    expect(en.byTheme).toEqual({ 'lugares-perigosos': 1, 'rotina-nomade': 1, 'trens-e-onibus': 1 })
    const pt = obs.ownCoverage('long', 'tnfigueiredo')
    expect(pt.n).toBe(8)
    expect(Object.keys(pt.byTheme)).toHaveLength(4)
  })
  it('id desconhecido', () => {
    expect(obs.ownCoverage('long', 'nope')).toMatchObject({ channel: null, n: 0, themed: 0 })
  })
})

describe('paridade legada intacta', () => {
  const O = loadOracle(), P = createObservatory(datasetFromOracle(loadOracle()))
  const J = (x: unknown) => JSON.parse(JSON.stringify(x))
  it('nicheStats(n, f) byte a byte e na mesma ordem de chaves', () => {
    for (const n of NICHES) for (const f of FMTS) expect(JSON.stringify(P.nicheStats(n, f))).toBe(JSON.stringify(O.nicheStats(n, f)))
    expect(Object.keys(P.nicheStats('viagem', 'long'))).toEqual(['niche', 'fmt', 'channels', 'pw', 'perMilSubs', 'typicalMult', 'engagement', 'pctOutliers', 'own'])
  })
  it('nicheStats com N próprios: mesmo canal escolhido e mesmo JSON do oráculo', () => {
    for (const p of ['2', '5', 'mix', 'zero'] as const) {
      const o = loadOracleOwns(p), e = createObservatory(datasetFromOracle(o))
      for (const id of ids(e.ownChannels())) expect(J(e.nicheStats('viagem', 'long', id))).toEqual(J(o.nicheStats('viagem', 'long', id)))
    }
  })
})
