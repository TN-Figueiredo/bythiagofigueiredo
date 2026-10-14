// @vitest-environment node
// apps/web/test/youtube/observatorio/outliers-parity.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
const O = loadOracle(), P = createObservatory(datasetFromOracle(loadOracle()))
const J = (x: unknown) => JSON.parse(JSON.stringify(x))

describe('multiplier parity with dados.js', () => {
  it.each(O.videos.map((v: { id: string }) => [v.id]))('%s', id => {
    expect(J(P.video(id)!.mult)).toEqual(J(O.video(id).mult))
  })
})
const cases: Array<[string, string, unknown, boolean]> = []
for (const niche of ['todos', 'viagem', 'ia']) for (const fmt of ['long', 'short'])
  for (const ages of [undefined, 'all', ['91-180'], ['365+']] as const) for (const includeWeak of [false, true])
    cases.push([niche, fmt, ages, includeWeak])
describe('outliers parity with dados.js', () => {
  it.each(cases)('%s %s ages=%j weak=%s', (niche, fmt, ages, includeWeak) => {
    const q = { niche, fmt, includeWeak, ...(ages ? { ages } : {}) }
    const p = P.outliers(q as never), o = O.outliers(q)
    expect(p.count).toBe(o.count); expect(p.countWithWeak).toBe(o.countWithWeak)
    expect(p.byAge).toEqual(o.byAge); expect(p.byPhase).toEqual(o.byPhase)
    expect([p.analyzed, p.untracked, p.weakExcluded]).toEqual([o.analyzed, o.untracked, o.weakExcluded])
    for (const s of ['mult', 'vpd', 'recent'] as const) expect(p.orderedIds(s)).toEqual(o.orderedIds(s))
    expect(p.orderedGroups('mult')).toEqual(o.orderedGroups('mult'))
    expect(p.items.map(i => [i.id, i.phase.id])).toEqual(o.items.map((i: { id: string; phase: { id: string } }) => [i.id, i.phase.id]))
    expect(J(p.items.map(i => i.phase))).toEqual(J(o.items.map((i: { phase: unknown }) => i.phase)))
  })
  it('min < 2 groups', () => {
    const p = P.outliers({ min: 1.5, includeWeak: true }), o = O.outliers({ min: 1.5, includeWeak: true })
    expect(p.orderedGroups()).toEqual(o.orderedGroups())
  })
  // desvio 12 (E5a T6a): a aba conta só título e miniatura; o oráculo congelado ainda conta descrição junto
  it.each(['todos', 'viagem', 'ia'])('tabCounts %s', n => {
    const p = P.tabCounts(n as never), o = O.tabCounts(n)
    expect({ canais: p.canais, out: p.out }).toEqual({ canais: o.canais, out: o.out })
    expect(p.mud).toBe(O.changesIn({ days: 30, niche: n }).filter((c: { type: string }) => c.type === 'title' || c.type === 'thumb').length)
  })
  it('PHASES and TAB_TITLES', () => {
    expect(J(P.PHASES)).toEqual(J(O.PHASES))
    for (const k of ['canais', 'out'] as const) expect(P.TAB_TITLES[k](7)).toBe(O.TAB_TITLES[k](7))
    expect(P.TAB_TITLES.mud(7)).toBe('7 trocas nos últimos 30 dias (título e thumbnail; longos e Shorts; contadas por evento)')
  })
})
