// @vitest-environment node
// apps/web/test/youtube/observatorio/effect.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'

const P = createObservatory(datasetFromOracle(loadOracle()))
const all = P.changes.map(c => P.effect(c.id)!)

describe('effect rules (CONVENCOES "Modelo de efeito de troca")', () => {
  it('before 7 days after the change → aguardando, with waitText and no numbers', () => {
    const w = all.filter(e => e.status === 'aguardando')
    expect(w.length).toBeGreaterThan(0)
    for (const e of w) { expect(e.observed).toBeUndefined(); expect(e.waitText).toMatch(/^Aguardando: \d de 7 dias coletados, leitura (no|na) \S+, \d\d\/\d\d\./) }
  })
  it('ganhou/perdeu only with |effect| > 10 pp AND outside the IQR AND n ≥ 5 AND before ≥ 3 d', () => {
    for (const e of all.filter(x => x.status === 'ganhou' || x.status === 'perdeu')) {
      expect(Math.abs(e.effectPp!)).toBeGreaterThan(10); expect(e.n!).toBeGreaterThanOrEqual(5); expect(e.beforeDays!).toBeGreaterThanOrEqual(3)
      expect(e.observed! < e.iqr![0]! || e.observed! > e.iqr![1]!).toBe(true)
    }
  })
  it('n = 0 → noBaseText canonical sentence', () => {
    for (const e of all.filter(x => x.n === 0)) expect(e.noBaseText).toMatch(/^sem base de comparação: nenhum outro vídeo do canal na faixa .+ \(n = 0\)$/)
  })
  it('pre-series change says the real series start date', () => {
    for (const e of all.filter(x => x.status === 'sem-serie' && /coleta/.test(x.reason))) expect(e.reason).toContain('desde ' + P.date.dm(P.SERIES_START))
  })
  it('effectPp is reported but formatted integer by fmt.pp', () => {
    const m = all.find(x => x.effectPp != null)!; expect(P.fmt.pp(m.effectPp!)).toMatch(/^[+−]?\d+ pp$/)
  })

it('a missing daily record around the change → inconclusivo "Faltam registros…", never a crash', () => {
  const ds = datasetFromOracle(loadOracle())
  const id = P.changes.find(c => ['ganhou', 'perdeu', 'neutro'].includes(P.effect(c.id)!.status))!.id
  const vid = ds.videos.find(v => v.id === P.change(id)!.video)!
  const k = P.date.snapIdxAtOrAfter(P.change(id)!.at)
  vid.series = vid.series.filter(p => p.idx !== k + 7) // knock out the day the 7-day reading ends on (k+2 is never an endpoint of the ratio)
  const e = createObservatory(ds).effect(id)!
  expect(e.status).toBe('inconclusivo'); expect(e.reason).toBe('Faltam registros diários em volta da troca: não dá para medir.')
})
})
