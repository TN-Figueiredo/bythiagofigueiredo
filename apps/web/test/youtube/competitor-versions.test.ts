// @vitest-environment node
// apps/web/test/youtube/competitor-versions.test.ts
import { describe, it, expect } from 'vitest'
import { reconcileVideoVersions, hashValue, normalizeDescription, type StoredVersion } from '@/lib/youtube/competitor-versions'

const T0 = '2026-10-24T09:00:00.000Z', T1 = '2026-10-24T15:00:00.000Z'
const v = (field: StoredVersion['field'], text: string, id = field + '1'): StoredVersion =>
  ({ id, field, value_hash: hashValue(text), thumb_etag: null, thumb_dhash: null, first_seen_at: T0, last_seen_at: T0 })

describe('reconcileVideoVersions', () => {
  it('first sighting opens versions with precision "first" and records no change', () => {
    const p = reconcileVideoVersions([], { title: 'A', description: 'd', thumb: null }, { prevOkAt: null, now: T1 }, { lastModifiedMinute: true })
    expect(p.open.map(o => [o.field, o.precision])).toEqual([['title', 'first'], ['desc', 'first']])
    expect(p.changes).toEqual([])
  })
  it('same values only touch', () => {
    const p = reconcileVideoVersions([v('title', 'A'), v('desc', 'd')], { title: 'A', description: 'd', thumb: null }, { prevOkAt: T0, now: T1 }, { lastModifiedMinute: true })
    expect(p.touch.sort()).toEqual(['desc1', 'title1'])
    expect(p.open).toEqual([]); expect(p.changes).toEqual([])
  })
  it('title change in a 6 h window → 6h precision with window [prevOk, now]', () => {
    const p = reconcileVideoVersions([v('title', 'A')], { title: 'B', description: '', thumb: null }, { prevOkAt: T0, now: T1 }, { lastModifiedMinute: true })
    expect(p.close).toEqual(['title1'])
    expect(p.changes).toEqual([{ field: 'title', fromId: 'title1', precision: '6h', window_start: T0, window_end: T1 }])
  })
  it('a wider gap than one slot (missed syncs) degrades to 1d, never invents minutes', () => {
    const p = reconcileVideoVersions([{ ...v('title', 'A'), last_seen_at: '2026-10-23T09:00:00.000Z' }], { title: 'B', description: '', thumb: null }, { prevOkAt: '2026-10-23T09:00:00.000Z', now: T1 }, { lastModifiedMinute: true })
    expect(p.changes[0]!.precision).toBe('1d')
  })
  it('description CRLF and trailing spaces are not a change', () => {
    expect(hashValue(normalizeDescription('a  \r\nb'))).toBe(hashValue(normalizeDescription('a\nb')))
  })
  it('thumbnail with Last-Modified inside the window gets minute precision', () => {
    const cur = { ...v('thumb', ''), thumb_etag: 'e1', thumb_dhash: '0000000000000000' }
    const p = reconcileVideoVersions([cur], { title: '', description: '', thumb: { etag: 'e2', dhash: 'ffffffffffffffff', lastModified: 'Sat, 24 Oct 2026 12:14:00 GMT', bytes: null, url: 'u' } }, { prevOkAt: T0, now: T1 }, { lastModifiedMinute: true })
    const ch = p.changes.find(c => c.field === 'thumb')!
    expect(ch.precision).toBe('min')
    expect(p.open.find(o => o.field === 'thumb')!.first_seen_at).toBe('2026-10-24T12:14:00.000Z')
  })
  it('thumbnail without a usable Last-Modified falls back to the window', () => {
    const cur = { ...v('thumb', ''), thumb_etag: 'e1', thumb_dhash: '0000000000000000' }
    const p = reconcileVideoVersions([cur], { title: '', description: '', thumb: { etag: 'e2', dhash: 'ffffffffffffffff', lastModified: null, bytes: null, url: 'u' } }, { prevOkAt: T0, now: T1 }, { lastModifiedMinute: true })
    expect(p.changes.find(c => c.field === 'thumb')!.precision).toBe('6h')
  })
  it('R16: title last seen 24 h ago → 1d and window_start = that last_seen_at (not prevOkAt)', () => {
    const old = '2026-10-23T15:00:00.000Z'
    const p = reconcileVideoVersions([{ ...v('title', 'A'), last_seen_at: old }], { title: 'B', description: '', thumb: null }, { prevOkAt: T0, now: T1 }, { lastModifiedMinute: true })
    expect(p.changes).toEqual([{ field: 'title', fromId: 'title1', precision: '1d', window_start: old, window_end: T1 }])
    expect(p.open[0]!.window_start).toBe(old)
  })
  it('R16: thumbnail Last-Modified between prev.last_seen_at and prevOkAt still gets minute precision', () => {
    const seen = '2026-10-24T03:00:00.000Z' // before prevOkAt (T0 = 09:00)
    const cur = { ...v('thumb', ''), thumb_etag: 'e1', thumb_dhash: '0000000000000000', last_seen_at: seen }
    const p = reconcileVideoVersions([cur], { title: '', description: '', thumb: { etag: 'e2', dhash: 'ffffffffffffffff', lastModified: 'Sat, 24 Oct 2026 05:30:00 GMT', bytes: null, url: 'u' } }, { prevOkAt: T0, now: T1 }, { lastModifiedMinute: true })
    expect(p.changes.find(c => c.field === 'thumb')).toMatchObject({ precision: 'min', window_start: seen })
  })
})
