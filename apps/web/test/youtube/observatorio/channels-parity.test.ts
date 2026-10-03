// @vitest-environment node
// apps/web/test/youtube/observatorio/channels-parity.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
const O = loadOracle(), P = createObservatory(datasetFromOracle(loadOracle()))
const J = (x: unknown) => JSON.parse(JSON.stringify(x))
// bestOutlier.video is the whole video: the oracle's carries mockup-only fields (thumb, target, showcase) the input dataset does not.
const stripVideo = (st: Record<string, unknown>) => { const b = st.bestOutlier as { video: { id: string } } | null; return { ...st, bestOutlier: b ? { ...b, video: b.video.id } : null } }
const ids: string[] = O.channels.map((c: { id: string }) => c.id)
describe('channels parity with dados.js', () => {
  for (const f of ['long', 'short'] as const) {
    it.each(ids)(`cadence %s ${f}`, id => { expect(J(P.cadence(id, f))).toEqual(J(O.cadence(id, f))) })
    it.each(ids)(`channelStats %s ${f}`, id => { expect(J(stripVideo(P.channelStats(id, f)))).toEqual(J(stripVideo(O.channelStats(id, f)))) })
  }
  it.each(ids)('cadence default format %s', id => { expect(J(P.cadence(id))).toEqual(J(O.cadence(id))) })
  it.each(ids)('sync labels %s', id => {
    const p = P.channel(id)!, o = O.channel(id)
    expect(p.sync.problemPhrase).toBe(o.sync.problemPhrase)
    expect([p.sync.label, p.sync.stateLabel, p.statusLabel, p.syncAgeHours]).toEqual([o.sync.label, o.sync.stateLabel, o.statusLabel, o.syncAgeHours])
  })
  it('channelSlots', () => { expect(P.channelSlots()).toEqual(O.channelSlots()) })
  it('SYNC fields', () => { for (const k of ['cadence', 'cadenceHours', 'slots', 'dailyBefore'] as const) expect(J(P.SYNC[k])).toEqual(J(O.SYNC[k])) })
  it('runSyncText matches runSync().text', () => {
    const r = O.runSync(), names = (id: string) => O.channel(id).name
    expect(P.runSyncText(r.ok, r.problems, r.outOfRound, names)).toBe(r.text)
  })
})
