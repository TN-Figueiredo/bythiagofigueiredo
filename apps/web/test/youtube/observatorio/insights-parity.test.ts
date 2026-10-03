// @vitest-environment node
// apps/web/test/youtube/observatorio/insights-parity.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
const O = loadOracle(), P = createObservatory(datasetFromOracle(loadOracle()))
const J = (x: unknown) => JSON.parse(JSON.stringify(x))
const cases: Array<['todos' | 'viagem' | 'ia', 'long' | 'short']> = []
for (const n of ['todos', 'viagem', 'ia'] as const) for (const f of ['long', 'short'] as const) cases.push([n, f])

describe('insights parity with dados.js', () => {
  it.each(cases)('heatmap %s %s', (n, f) => { expect(J(P.heatmap(n, f))).toEqual(J(O.heatmap(n, f))) })
  it.each(cases)('nicheStats %s %s', (n, f) => { expect(J(P.nicheStats(n, f))).toEqual(J(O.nicheStats(n, f))) })
  it.each(cases)('themeTrend %s %s', (n, f) => {
    const p = P.themeTrend(n, f), o = O.themeTrend(n, f)
    expect(J(p)).toEqual(J(o)); expect(J(p.excluded)).toEqual(J(o.excluded)); expect(p.channelsCompared).toEqual(o.channelsCompared)
  })
  it.each(['long', 'short'] as const)('ownCoverage %s', f => { expect(J(P.ownCoverage(f))).toEqual(J(O.ownCoverage(f))) })
  it.each(cases)('patternsNow %s %s', (n, f) => { expect(J(P.patternsNow(n, f))).toEqual(J(O.patternsNow(n, f))) })
  it('catalogues', () => {
    expect(J(P.themes)).toEqual(J(O.themes)); expect(P.formulas.map(x => [x.id, x.label, x.short, x.niches, x.ex])).toEqual(O.formulas.map((x: { id: string; label: string; short: string; niches: string[]; ex: string }) => [x.id, x.label, x.short, x.niches, x.ex]))
    for (const v of O.videos) expect(P.formulasOf(v.title)).toEqual(O.formulasOf(v.title))
  })
  it('link is wired into the facade (Task 19 owns its behaviour)', () => { expect(P.link.outliers({ niche: 'ia', formula: 'preco' })).toMatch(/niche=ia.*formula=preco/); expect(typeof P.link.historico).toBe('function') })
})
