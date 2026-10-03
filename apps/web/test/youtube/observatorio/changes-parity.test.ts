// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'

const O = loadOracle(), P = createObservatory(datasetFromOracle(loadOracle()))
const FIELDS = ['id', 'type', 'at', 'prec', 'window', 'preSeries', 'whenText', 'agoText', 'agoShort', 'revertTo', 'testCompare', 'cycleMs', 'sameWindow', 'within48h', 'hasText', 'rewriteGroup'] as const

describe('changes parity with dados.js', () => {
  it('same change ids in the same order', () => {
    expect(P.changes.map(c => c.id)).toEqual(O.changes.map((c: { id: string }) => c.id))
  })
  it.each(O.changes.map((c: { id: string }) => [c.id]))('%s', id => {
    const p = P.change(id)!, o = O.change(id)
    for (const k of FIELDS) expect(p[k as keyof typeof p], k).toEqual(o[k] ?? (k === 'revertTo' ? null : o[k]))
    if (o.diff) expect(p.diff).toEqual(o.diff)
    if (o.titleDiff) expect(p.titleDiff).toEqual(o.titleDiff)
    expect(p.noTextReason).toEqual(o.noTextReason)
    expect(p.revertedBy).toEqual(o.revertedBy)
    expect(P.caveats(id)).toEqual(O.caveats(id))
  })
  it('vpd / vpd7 per video', () => {
    for (const v of O.videos) { expect(P.video(v.id)!.vpd).toBe(v.vpd); expect(P.video(v.id)!.vpd7).toBe(v.vpd7) }
  })
  it('periodRate and expectedCurve match the oracle for every tracked video', () => {
    for (const v of O.videos) {
      if (!v.series.length) continue
      const from = v.pub, to = O.NOW
      const { coveredHours: _c, ...p } = P.periodRate(v.id, from, to), { coveredHours: _o, ...o } = O.periodRate(v.id, from, to)
      expect(p, v.id).toEqual(o)
      const pc = P.expectedCurve(v.id), oc = O.expectedCurve(v.id)
      // the oracle (dados.js) divides by a 0-length first interval (video published exactly at its first record) and
      // yields NaN, which then poisons the anchored curve; the port drops that interval (no base, no rate). Parity is
      // asserted everywhere the oracle itself is finite; where it is not, the port must be finite.
      if (oc.some(x => x.observed != null && !Number.isFinite(x.observed))) { expect(pc.every(x => x.observed == null || Number.isFinite(x.observed)), v.id).toBe(true); continue }
      expect([...pc], v.id).toEqual([...oc])
      if (oc.length) { expect(pc.method).toBe(oc.method); expect(pc.band).toBe(oc.band) }
    }
  })
  it('changesIn default window = 30 days, competitors only → 18 events', () => {
    expect(P.changesIn({}).length).toBe(18)
    expect(P.changesIn({ niche: 'viagem' }).length).toBe(8)
    expect(P.changesIn({ niche: 'ia' }).length).toBe(10)
  })
  it('does not mutate the input dataset', () => {
    const ds = datasetFromOracle(loadOracle()); createObservatory(ds)
    expect(Object.keys(ds.videos[0]!)).not.toContain('vpd')
  })
  it('a hole returns null, later points keep their idx', () => {
    const ds = datasetFromOracle(loadOracle()); const v = ds.videos.find(x => x.series.length > 5)!
    const gone = v.series[2]!.idx; v.series = v.series.filter(p => p.idx !== gone)
    const p = createObservatory(ds)
    expect(p.viewsAt(v.id, gone)).toBeNull()
    expect(p.viewsAt(v.id, gone + 1)).toBe(v.series.find(x => x.idx === gone + 1)!.views)
  })
  it('a hole makes rate across it null', () => {
    const ds = datasetFromOracle(loadOracle()); const v = ds.videos.find(x => x.series.length > 5)!
    const gone = v.series[2]!.idx; v.series = v.series.filter(p => p.idx !== gone)
    const p = createObservatory(ds)
    expect(p.rate(v.id, gone, gone + 1)).toBeNull()
    expect(p.rate(v.id, gone - 1, gone)).toBeNull()
    expect(p.rate(v.id, gone + 1, gone + 2)).not.toBeNull()
  })
})
