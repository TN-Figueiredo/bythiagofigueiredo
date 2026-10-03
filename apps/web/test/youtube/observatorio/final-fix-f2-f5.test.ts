// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'

type Ds = ReturnType<typeof datasetFromOracle>

/** First thumbnail change after the series start, on a fresh dataset (so mutations never leak across tests). */
function withThumbChange() {
  const ds: Ds = datasetFromOracle(loadOracle())
  const base = createObservatory(ds).changes.find(c => c.type === 'thumb' && !c.preSeries)!
  const video = ds.videos.find(v => v.id === base.video)!
  return { ds, video, idx: base.idx, id: base.id }
}

describe('F2: thumbnail change precision comes from the stored version', () => {
  it('a 6h thumbnail version shows the window, not an invented minute', () => {
    const { ds, video, idx, id } = withThumbChange()
    const ver = video.thumbs[idx]!
    ver.prec = '6h'
    ver.window = [ver.first_seen - 6 * 36e5, ver.first_seen]
    const c = createObservatory(ds).change(id)!
    expect(c.prec).toBe('6h')
    expect(c.window).toEqual(ver.window)
    expect(c.whenText).not.toMatch(/\d{2}:\d{2}$/) // not "DD/MM HH:MM"
  })
  it('a minute-precision thumbnail keeps DD/MM HH:MM', () => {
    const { ds, video, idx, id } = withThumbChange()
    video.thumbs[idx]!.prec = 'min'
    const c = createObservatory(ds).change(id)!
    expect(c.prec).toBe('min')
    expect(c.whenText).toMatch(/\d{2}:\d{2}$/)
  })
  it('no stored precision (null) falls back to min', () => {
    const { ds, video, idx, id } = withThumbChange()
    video.thumbs[idx]!.prec = null
    expect(createObservatory(ds).change(id)!.prec).toBe('min')
  })
})

describe('F5: perMilSubs without subscribers', () => {
  it('is a finite number with subscribers and null (never Infinity/NaN) without them', () => {
    const probe = datasetFromOracle(loadOracle())
    const withMedian = probe.channels.filter(c => !c.own).find(c => createObservatory(probe).channelStats(c.id, 'long').vpdMedian != null)!
    expect(withMedian, 'oracle has a channel with a vpd median').toBeTruthy()
    const ok = createObservatory(probe).channelStats(withMedian.id, 'long').perMilSubs
    expect(Number.isFinite(ok)).toBe(true)
    const ds: Ds = datasetFromOracle(loadOracle())
    ds.channels.find(c => c.id === withMedian.id)!.subs = 0
    expect(createObservatory(ds).channelStats(withMedian.id, 'long').perMilSubs).toBeNull()
  })
})
