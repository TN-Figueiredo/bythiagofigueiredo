// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/youtube/thumb-fingerprint', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/thumb-fingerprint')>()),
  probeThumb: vi.fn(),
  archiveThumb: vi.fn(async () => 'https://blob.test/t.jpg'),
}))

import { isDailyRecordDue, classifyThumb, dropFields, syncCompetitorChannel } from '@/lib/youtube/competitor-sync'
import { probeThumb } from '@/lib/youtube/thumb-fingerprint'
import { hashValue } from '@/lib/youtube/competitor-versions'
import type { StoredVersion, VersionPlan } from '@/lib/youtube/competitor-versions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

type Payload = { p_video_id: string; p_close: string[]; p_open: Array<Record<string, unknown>>; p_changes: Array<Record<string, unknown>> }

describe('isDailyRecordDue (12:00 São Paulo)', () => {
  it('before 12:00 SP is not due', () => {
    expect(isDailyRecordDue('2026-10-24T14:59:00.000Z', null)).toEqual({ due: false, snapDate: '2026-10-24' })
  })
  it('at/after 12:00 SP with no record today is due', () => {
    expect(isDailyRecordDue('2026-10-24T15:00:00.000Z', '2026-10-23')).toEqual({ due: true, snapDate: '2026-10-24' })
  })
  it('already recorded today is not due', () => {
    expect(isDailyRecordDue('2026-10-24T20:00:00.000Z', '2026-10-24').due).toBe(false)
  })
  it('uses the SP date even when UTC already rolled over', () => {
    expect(isDailyRecordDue('2026-10-25T02:30:00.000Z', '2026-10-23')).toEqual({ due: true, snapDate: '2026-10-24' })
  })
})

const thumbV = (over: Partial<StoredVersion> = {}): StoredVersion => ({
  id: 'tv', field: 'thumb', value_hash: 'h', thumb_etag: '"e1"', thumb_dhash: '0000000000000000',
  first_seen_at: '2026-10-24T12:00:00.000Z', last_seen_at: '2026-10-24T12:00:00.000Z', ...over,
})
const probe = (over: Partial<Parameters<typeof classifyThumb>[1]> = {}) => ({
  etag: '"e2"', lastModified: null, dhash: '0000000000000000', bytes: Buffer.from('x'), url: 'u', ...over,
})

describe('classifyThumb (R10)', () => {
  it('skips a failed probe', () => {
    expect(classifyThumb(thumbV(), probe({ etag: null, dhash: null, bytes: null }))).toBe('skip')
  })
  it('(a) heals a current version whose dhash is null when the probe brings one', () => {
    expect(classifyThumb(thumbV({ thumb_dhash: null, thumb_etag: null }), probe({ dhash: 'ffffffffffffffff' }))).toBe('heal')
  })
  it('(b) etag moved but image within DHASH_MAX_SAME → etag-only', () => {
    expect(classifyThumb(thumbV(), probe({ dhash: '0000000000000001' }))).toBe('etag')
  })
  it('a really different image is reconciled', () => {
    expect(classifyThumb(thumbV(), probe({ dhash: 'ffffffffffffffff' }))).toBe('reconcile')
  })
  it('same etag is reconciled (touch)', () => {
    expect(classifyThumb(thumbV(), probe({ etag: '"e1"', bytes: null }))).toBe('reconcile')
  })
  it('first sight is reconciled', () => {
    expect(classifyThumb(null, probe())).toBe('reconcile')
  })
})

describe('dropFields (R10c)', () => {
  it('removes every plan part of a skipped field', () => {
    const current: StoredVersion[] = [thumbV(), { ...thumbV({ id: 'tt' }), field: 'title' }]
    const plan: VersionPlan = {
      touch: ['tv'], close: ['tt'],
      open: [{ field: 'title', value_text: '', value_hash: 'x', has_text: true, precision: '6h', window_start: null, first_seen_at: 'n' }],
      changes: [{ field: 'title', fromId: 'tt', precision: '6h', window_start: null, window_end: 'n' }],
    }
    expect(dropFields(plan, current, ['title'])).toEqual({ touch: ['tv'], close: [], open: [], changes: [] })
  })
})

// ── fake supabase: recorded, thenable chains, scripted results ──
interface Call { table: string; ops: Array<[string, unknown[]]> }
type Script = (c: Call) => Record<string, unknown> | undefined
function fakeDb(script: Script) {
  const calls: Call[] = []
  const from = (table: string) => {
    const call: Call = { table, ops: [] }
    calls.push(call)
    const b: Record<string, unknown> = {}
    const proxy: unknown = new Proxy(b, {
      get(_t, prop: string) {
        if (prop === 'then') {
          const res = script(call) ?? { data: null, error: null }
          return (ok: (v: unknown) => unknown) => Promise.resolve(res).then(ok)
        }
        return (...args: unknown[]) => { call.ops.push([prop, args]); return proxy }
      },
    })
    return proxy
  }
  const rpc = (name: string, args: unknown) => {
    const call: Call = { table: 'rpc:' + name, ops: [['rpc', [args]]] }
    calls.push(call)
    return Promise.resolve(script(call) ?? { data: null, error: null })
  }
  return { client: { from, rpc }, calls }
}
const rpcs = (db: { calls: Call[] }) => db.calls.filter(c => c.table === 'rpc:apply_competitor_version_plan').map(c => c.ops[0]![1][0] as Payload)
const first = (c: Call) => c.ops[0]![0]
const arg = (c: Call, op: string) => c.ops.find(o => o[0] === op)?.[1][0] as Record<string, unknown> | undefined
const NOW = new Date('2026-10-24T15:00:00.000Z') // 12:00 SP
const NOW_ISO = NOW.toISOString()
const ch = { id: 'cc-1', channel_id: 'UC_test', site_id: 'site-1' }
const lockRow = { id: 'cc-1', sync_mode: 'incremental', full_sync_completed_at: null, video_limit: 50, last_ok_synced_at: '2026-10-24T09:00:00.000Z', sync_error_since: null }

interface FetchLog { dailyCalls: string[] }
function apiFetch(video: Record<string, unknown> | null, status = 200, extra: { daily?: (call: number, url: string) => Response | Record<string, unknown>[]; noUploads?: boolean; log?: FetchLog } = {}): typeof fetch {
  let dailyN = 0
  return (async (input: RequestInfo | URL) => {
    const u = String(input)
    if (status !== 200) return { ok: false, status }
    if (u.includes('/channels?')) {
      return Response.json({ items: [{ contentDetails: { relatedPlaylists: extra.noUploads ? {} : { uploads: 'UU' } }, snippet: { title: 'Canal' }, statistics: { subscriberCount: '10' } }] })
    }
    if (u.includes('/playlistItems?')) return Response.json({ items: video ? [{ snippet: { resourceId: { videoId: video.id } } }] : [] })
    if (u.includes('part=snippet,statistics&')) {
      dailyN++
      extra.log?.dailyCalls.push(u)
      if (extra.daily) {
        const r = extra.daily(dailyN, u)
        return r instanceof Response ? r : Response.json({ items: r })
      }
      return Response.json({ items: video ? [{ ...video, statistics: { viewCount: '7' } }] : [] })
    }
    return Response.json({ items: video ? [video] : [] })
  }) as typeof fetch
}
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString()

function setup(opts: {
  existing?: Record<string, unknown>[]; versions?: Record<string, unknown>[]; lastDaily?: string | null
  tracked?: Array<Record<string, unknown>>; dailyHave?: string[]; rpcError?: boolean
} = {}) {
  const db = fakeDb((c) => {
    if (c.table === 'competitor_channels' && c.ops.some(o => o[0] === 'or')) return { data: [lockRow] }
    if (c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'in')) return { data: opts.existing ?? [] }
    if (c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'limit')) return { data: opts.tracked ?? [{ id: 'v-1', video_id: 'vid-1', title: null, thumbnail_url: null }] }
    if (c.table === 'competitor_videos' && first(c) === 'select') return { count: 100 }
    if (c.table === 'competitor_videos' && first(c) === 'insert') return { data: { id: 'v-new' } }
    if (c.table === 'competitor_video_daily' && first(c) === 'select') {
      const have = opts.dailyHave ?? (opts.lastDaily === '2026-10-24' ? ['v-1', 'v-new'] : [])
      return { data: have.map(video_id => ({ video_id })) }
    }
    if (c.table === 'competitor_video_daily' && first(c) === 'upsert') return { data: c.ops[0]![1][0] }
    if (c.table === 'competitor_video_versions' && first(c) === 'select') return { data: opts.versions ?? [] }
    if (c.table === 'rpc:apply_competitor_version_plan') {
      if (opts.rpcError) return { data: null, error: { message: 'boom' } }
      return { data: { opened: {}, changes: (c.ops[0]![1][0] as { p_changes: unknown[] }).p_changes.length } }
    }
    return { data: null, error: null }
  })
  vi.mocked(getSupabaseServiceClient).mockReturnValue(db.client as never)
  return db
}

beforeEach(() => {
  vi.mocked(probeThumb).mockReset()
  vi.mocked(probeThumb).mockResolvedValue({ etag: null, lastModified: null, dhash: null, bytes: null, url: 'u' })
})

describe('syncCompetitorChannel', () => {
  it('throws on channel API 500 and records sync_error_since = now', async () => {
    const db = setup()
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 500) })).rejects.toThrow('YouTube API 500 for channel UC_test')
    const err = db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).find(u => u?.sync_status === 'error')
    expect(err).toMatchObject({ sync_error_since: NOW_ISO })
  })

  it('R13: a channels call failing with 404 still advances the cursor, keeps last_ok, sets sync_error_since', async () => {
    const db = setup()
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 404) })).rejects.toThrow('YouTube API 404')
    const updates = db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')!)
    expect(updates[0]).toMatchObject({ sync_status: 'syncing', last_synced_at: NOW_ISO }) // in the lock itself
    expect(updates.some(u => 'last_ok_synced_at' in u)).toBe(false)
    expect(updates.at(-1)).toMatchObject({ sync_status: 'error', sync_error_since: NOW_ISO })
    expect(updates.at(-1)).not.toHaveProperty('last_synced_at')
  })

  it('stamps the cursor at the lock and last_ok_synced_at on success; empty list is fine', async () => {
    const db = setup({ lastDaily: '2026-10-24' })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null) })
    expect(r).toMatchObject({ videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 2 })
    const updates = db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update'))
    expect(updates[0]).toMatchObject({ sync_status: 'syncing', last_synced_at: NOW_ISO })
    expect(updates.at(-1)).toMatchObject({ sync_status: 'idle', last_ok_synced_at: NOW_ISO, sync_error_since: null })
  })

  it('records a title change as a version + a change row with the window', async () => {
    const db = setup({
      lastDaily: '2026-10-24',
      existing: [{ id: 'v-1', video_id: 'vid-1', title: 'Old', description_hash: 'x', thumbnail_url: 'http://t', view_count: 1 }],
      versions: [{ id: 'tv1', video_id: 'v-1', field: 'title', value_text: 'Old', value_hash: hashValue('Old'), thumb_etag: null, thumb_dhash: null }],
    })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch({ id: 'vid-1', snippet: { title: 'New', publishedAt: recent(), thumbnails: {} }, statistics: { viewCount: '9' } }) })
    expect(r.changesDetected).toBe(1)
    const [pl] = rpcs(db)
    expect(pl).toMatchObject({ p_video_id: 'v-1', p_close: ['tv1'] })
    expect(pl!.p_open).toHaveLength(1)
    expect(pl!.p_open[0]).toMatchObject({ field: 'title', value_text: 'New', precision: '6h', first_seen_at: NOW_ISO, last_seen_at: NOW_ISO })
    expect(pl!.p_changes[0]).toMatchObject({
      field: 'title', site_id: 'site-1', change_type: 'title', old_title: 'Old', new_title: 'New', from_version_id: 'tv1',
      window_start: '2026-10-24T09:00:00.000Z', window_end: NOW_ISO, precision: '6h', detected_at: NOW_ISO,
    })
  })

  it('(c) a missing API title never reconciles the title field', async () => {
    const db = setup({
      lastDaily: '2026-10-24',
      existing: [{ id: 'v-1', video_id: 'vid-1', title: 'Old', description_hash: 'x', thumbnail_url: null, view_count: 1 }],
      versions: [{ id: 'tv1', video_id: 'v-1', field: 'title', value_text: 'Old', value_hash: hashValue('Old'), thumb_etag: null, thumb_dhash: null }],
    })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch({ id: 'vid-1', snippet: { publishedAt: recent() }, statistics: {} }) })
    expect(r.changesDetected).toBe(0)
    expect(rpcs(db)).toHaveLength(0)
  })

  it('inserts a new video and opens its baseline versions (no changes)', async () => {
    const db = setup({ lastDaily: '2026-10-24' })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch({ id: 'vid-new', snippet: { title: 'Brand New', description: 'dd', publishedAt: recent(), thumbnails: {} }, statistics: { viewCount: '42' } }) })
    expect(r.changesDetected).toBe(0)
    const vInsert = db.calls.find(c => c.table === 'competitor_videos' && first(c) === 'insert')!
    expect(arg(vInsert, 'insert')).toMatchObject({ video_id: 'vid-new', title: 'Brand New', competitor_channel_id: 'cc-1' })
    const [pl] = rpcs(db)
    expect(pl!.p_video_id).toBe('v-new')
    expect(pl!.p_close).toEqual([])
    expect(pl!.p_open.map(x => x.field).sort()).toEqual(['desc', 'title'])
    expect(pl!.p_open.every(x => x.precision === 'first')).toBe(true)
    expect(pl!.p_changes).toEqual([])
  })

  it('(a) heals a current thumb version without dhash instead of recording a change', async () => {
    vi.mocked(probeThumb).mockResolvedValue({ etag: '"e9"', lastModified: null, dhash: 'ffffffffffffffff', bytes: Buffer.from('x'), url: 'u' })
    const db = setup({
      lastDaily: '2026-10-24',
      existing: [{ id: 'v-1', video_id: 'vid-1', title: 'T', description_hash: 'x', thumbnail_url: null, view_count: 1 }],
      versions: [{ id: 'tv1', video_id: 'v-1', field: 'thumb', value_hash: 'h', thumb_etag: null, thumb_dhash: null }],
    })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch({ id: 'vid-1', snippet: { title: 'T', description: '', publishedAt: recent() }, statistics: {} }) })
    const heal = db.calls.find(c => c.table === 'competitor_video_versions' && arg(c, 'update')?.thumb_dhash)!
    expect(arg(heal, 'update')).toMatchObject({ thumb_dhash: 'ffffffffffffffff', thumb_etag: '"e9"', thumb_blob_url: 'https://blob.test/t.jpg' })
    expect(r.changesDetected).toBe(0)
    expect(rpcs(db).every(p => p.p_changes.length === 0 && p.p_open.every(x => x.field !== 'thumb'))).toBe(true)
  })

  it('(b) etag moved within DHASH_MAX_SAME updates only thumb_etag', async () => {
    vi.mocked(probeThumb).mockResolvedValue({ etag: '"e2"', lastModified: null, dhash: '0000000000000001', bytes: Buffer.from('x'), url: 'u' })
    const db = setup({
      lastDaily: '2026-10-24',
      existing: [{ id: 'v-1', video_id: 'vid-1', title: 'T', description_hash: 'x', thumbnail_url: null, view_count: 1 }],
      versions: [{ id: 'tv1', video_id: 'v-1', field: 'thumb', value_hash: 'h', thumb_etag: '"e1"', thumb_dhash: '0000000000000000' }],
    })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch({ id: 'vid-1', snippet: { title: 'T', description: '', publishedAt: recent() }, statistics: {} }) })
    const upd = db.calls.filter(c => c.table === 'competitor_video_versions').map(c => arg(c, 'update')).filter(Boolean)
    expect(upd.some(u => 'thumb_etag' in u!)).toBe(true)
    expect(upd.some(u => 'thumb_dhash' in u!)).toBe(false)
    expect(r.changesDetected).toBe(0)
  })

  it('old videos are only reconciled when the daily record is due', async () => {
    const old = '2026-01-01T00:00:00Z'
    const mk = (lastDaily: string) => setup({
      lastDaily,
      existing: [{ id: 'v-1', video_id: 'vid-1', title: 'Old', description_hash: 'x', thumbnail_url: null, view_count: 1 }],
      versions: [{ id: 'tv1', video_id: 'v-1', field: 'title', value_text: 'Old', value_hash: hashValue('Old'), thumb_etag: null, thumb_dhash: null }],
    })
    const video = { id: 'vid-1', snippet: { title: 'New', publishedAt: old } , statistics: {} }
    let db = mk('2026-10-24') // not due
    expect((await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(video) })).changesDetected).toBe(0)
    expect(probeThumb).not.toHaveBeenCalled()
    db = mk('2026-10-23') // due
    expect((await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(video) })).changesDetected).toBe(1)
    expect(rpcs(db).some(p => p.p_changes.length === 1)).toBe(true)
  })

  it('daily record upserts with ignoreDuplicates and starts the series once', async () => {
    const db = setup({ lastDaily: '2026-10-23' })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch({ id: 'vid-1', snippet: { title: 'T', publishedAt: recent() }, statistics: { viewCount: '7' } }) })
    expect(r.dailyRecorded).toBe(1)
    const up = db.calls.find(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')!
    expect(up.ops[0]![1][1]).toMatchObject({ ignoreDuplicates: true })
    expect((up.ops[0]![1][0] as Array<Record<string, unknown>>)[0]).toMatchObject({ video_id: 'v-1', snap_date: '2026-10-24', views: 7 })
    const sets = db.calls.filter(c => c.table === 'competitor_settings')
    expect(arg(sets[0]!, 'upsert')).toMatchObject({ site_id: 'site-1' })
    expect(sets[0]!.ops[0]![1][1]).toMatchObject({ ignoreDuplicates: true })
    expect(arg(sets[1]!, 'update')).toMatchObject({ series_started_at: NOW_ISO })
    expect(sets[1]!.ops.find(o => o[0] === 'is')![1]).toEqual(['series_started_at', null]) // atomic: only while null
  })

  it('daily record is ordered by published_at desc, nulls last', async () => {
    const db = setup({ lastDaily: '2026-10-23' })
    await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch({ id: 'vid-1', snippet: { title: 'T', publishedAt: recent() }, statistics: {} }) })
    const tracked = db.calls.find(c => c.table === 'competitor_videos' && c.ops.some(o => o[0] === 'limit'))!
    expect(tracked.ops.find(o => o[0] === 'order')![1]).toEqual(['published_at', { ascending: false, nullsFirst: false }])
  })

  it('a channel with no uploads playlist is an OK sync', async () => {
    const db = setup()
    await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { noUploads: true }) })
    const last = db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')!).at(-1)
    expect(last).toMatchObject({ sync_status: 'idle', last_ok_synced_at: NOW_ISO, sync_error_since: null })
  })

  it('dailyRecorded counts rows actually inserted (ignored duplicates do not count)', async () => {
    const base = fakeDb((c) => {
      if (c.table === 'competitor_channels' && c.ops.some(o => o[0] === 'or')) return { data: [lockRow] }
      if (c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'limit')) return { data: [{ id: 'v-1', video_id: 'vid-1', title: null, thumbnail_url: null }] }
      if (c.table === 'competitor_videos' && first(c) === 'select') return { count: 100 }
      if (c.table === 'competitor_video_daily' && first(c) === 'upsert') return { data: [] }
      return { data: [] }
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(base.client as never)
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch({ id: 'vid-1', snippet: { title: 'T', publishedAt: recent() }, statistics: {} }) })
    expect(r.dailyRecorded).toBe(0)
  })

  it('R17: the daily pass reconciles tracked videos the playlist page did not reach, once each', async () => {
    const page = { id: 'vid-1', snippet: { title: 'T', description: '', publishedAt: recent() }, statistics: {} }
    const db = setup({
      lastDaily: '2026-10-23',
      tracked: [{ id: 'v-1', video_id: 'vid-1', title: 'T', thumbnail_url: null }, { id: 'v-2', video_id: 'vid-2', title: 'Old', thumbnail_url: null }],
      existing: [{ id: 'v-1', video_id: 'vid-1', title: 'T', description_hash: 'x', thumbnail_url: null, view_count: 1 }],
      versions: [
        { id: 'tv1', video_id: 'v-1', field: 'title', value_text: 'T', value_hash: hashValue('T'), thumb_etag: null, thumb_dhash: null, last_seen_at: '2026-10-24T09:00:00.000Z' },
        { id: 'tv2', video_id: 'v-2', field: 'title', value_text: 'Old', value_hash: hashValue('Old'), thumb_etag: null, thumb_dhash: null, last_seen_at: '2026-10-24T09:00:00.000Z' },
      ],
    })
    const daily = [
      { ...page, statistics: { viewCount: '7' } },
      { id: 'vid-2', snippet: { title: 'Changed', description: '', publishedAt: '2026-01-01T00:00:00Z' }, statistics: { viewCount: '3' } },
    ]
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page, 200, { daily: () => daily }) })
    expect(r.dailyRecorded).toBe(2)
    const withChanges = rpcs(db).filter(p => p.p_changes.length)
    expect(withChanges).toHaveLength(1)
    expect(withChanges[0]).toMatchObject({ p_video_id: 'v-2' })
    expect(withChanges[0]!.p_changes[0]).toMatchObject({ change_type: 'title', new_title: 'Changed' })
    expect(r.changesDetected).toBe(1)
    expect(vi.mocked(probeThumb).mock.calls.map(c => c[0]).sort()).toEqual(['vid-1', 'vid-2']) // v-1 not probed twice
  })

  it('R22: an RPC error → sync throws, no change counted, last_ok not written, nothing else compensates', async () => {
    const db = setup({
      lastDaily: '2026-10-24',
      existing: [{ id: 'v-1', video_id: 'vid-1', title: 'Old', description_hash: 'x', thumbnail_url: null, view_count: 1 }],
      versions: [{ id: 'tv1', video_id: 'v-1', field: 'title', value_text: 'Old', value_hash: hashValue('Old'), thumb_etag: null, thumb_dhash: null }],
      rpcError: true,
    })
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch({ id: 'vid-1', snippet: { title: 'New', publishedAt: recent() }, statistics: {} }) })).rejects.toThrow('apply version plan')
    expect(db.calls.some(c => c.table === 'competitor_changes')).toBe(false)
    expect(db.calls.some(c => c.table === 'competitor_video_versions' && ['update', 'insert', 'delete'].includes(first(c)))).toBe(false)
    const chUpdates = db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')!)
    expect(chUpdates.some(u => 'last_ok_synced_at' in u)).toBe(false)
    expect(chUpdates.at(-1)).toMatchObject({ sync_status: 'error' })
  })

  it('partial daily record: second page fails → throws after recording page 1; next run asks only for the missing ids', async () => {
    const tracked = Array.from({ length: 51 }, (_, i) => ({ id: `u${i}`, video_id: `y${i}`, title: null, thumbnail_url: null }))
    const items = (url: string) => decodeURIComponent(url.match(/id=([^&]*)/)![1]!).split(',').map(id => ({ id, statistics: { viewCount: '1' } }))
    const log1: FetchLog = { dailyCalls: [] }
    const db1 = setup({ lastDaily: '2026-10-23', tracked, dailyHave: [] })
    await expect(syncCompetitorChannel(ch, 'k', {
      now: NOW,
      fetchImpl: apiFetch(null, 200, { log: log1, daily: (n, u) => (n === 1 ? items(u) : new Response('x', { status: 500 })) }),
    })).rejects.toThrow('YouTube API 500 for daily statistics')
    const ups = db1.calls.filter(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')
    expect(ups).toHaveLength(1)
    expect((ups[0]!.ops[0]![1][0] as unknown[]).length).toBe(50)
    expect(db1.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')!).some(u => 'last_ok_synced_at' in u)).toBe(false)

    const log2: FetchLog = { dailyCalls: [] }
    const db2 = setup({ lastDaily: '2026-10-23', tracked, dailyHave: tracked.slice(0, 50).map(t => t.id) })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { log: log2, daily: (_n, u) => items(u) }) })
    expect(log2.dailyCalls).toHaveLength(1)
    expect(decodeURIComponent(log2.dailyCalls[0]!)).toContain('id=y50&')
    expect(r.dailyRecorded).toBe(1)
    expect(db2.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')!).at(-1)).toMatchObject({ last_ok_synced_at: NOW_ISO })
  })
})
