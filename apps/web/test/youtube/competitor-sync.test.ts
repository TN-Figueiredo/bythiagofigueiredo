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
  return { client: { from }, calls }
}
const first = (c: Call) => c.ops[0]![0]
const arg = (c: Call, op: string) => c.ops.find(o => o[0] === op)?.[1][0] as Record<string, unknown> | undefined
const NOW = new Date('2026-10-24T15:00:00.000Z') // 12:00 SP
const NOW_ISO = NOW.toISOString()
const ch = { id: 'cc-1', channel_id: 'UC_test', site_id: 'site-1' }
const lockRow = { id: 'cc-1', sync_mode: 'incremental', full_sync_completed_at: null, video_limit: 50, last_ok_synced_at: '2026-10-24T09:00:00.000Z', sync_error_since: null }

function apiFetch(video: Record<string, unknown> | null, status = 200): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const u = String(input)
    if (status !== 200) return { ok: false, status }
    if (u.includes('/channels?')) return Response.json({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal' }, statistics: { subscriberCount: '10' } }] })
    if (u.includes('/playlistItems?')) return Response.json({ items: video ? [{ snippet: { resourceId: { videoId: video.id } } }] : [] })
    if (u.includes('part=statistics&')) return Response.json({ items: video ? [{ id: video.id, statistics: { viewCount: '7' } }] : [] })
    return Response.json({ items: video ? [video] : [] })
  }) as typeof fetch
}
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString()

function setup(opts: { existing?: Record<string, unknown>[]; versions?: Record<string, unknown>[]; lastDaily?: string | null } = {}) {
  const db = fakeDb((c) => {
    if (c.table === 'competitor_channels' && c.ops.some(o => o[0] === 'or')) return { data: [lockRow] }
    if (c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'in')) return { data: opts.existing ?? [] }
    if (c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'limit')) return { data: [{ id: 'v-1', video_id: 'vid-1' }] }
    if (c.table === 'competitor_videos' && first(c) === 'select') return { count: 0 }
    if (c.table === 'competitor_videos' && first(c) === 'insert') return { data: { id: 'v-new' } }
    if (c.table === 'competitor_video_daily' && first(c) === 'select') return { data: opts.lastDaily ? [{ snap_date: opts.lastDaily }] : [] }
    if (c.table === 'competitor_video_versions' && first(c) === 'select') return { data: opts.versions ?? [] }
    if (c.table === 'competitor_video_versions' && first(c) === 'insert') {
      const rows = c.ops[0]![1][0] as Array<{ field: string }>
      return { data: rows.map((r, i) => ({ id: `nv-${i}`, field: r.field })) }
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
    const chg = db.calls.find(c => c.table === 'competitor_changes')!
    expect(arg(chg, 'insert')).toMatchObject({
      change_type: 'title', old_title: 'Old', new_title: 'New', from_version_id: 'tv1', to_version_id: 'nv-0',
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
    expect(db.calls.some(c => c.table === 'competitor_changes')).toBe(false)
    const closes = db.calls.filter(c => c.table === 'competitor_video_versions' && arg(c, 'update')?.is_current === false)
    expect(closes).toHaveLength(0)
  })

  it('inserts a new video and opens its baseline versions (no changes)', async () => {
    const db = setup({ lastDaily: '2026-10-24' })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch({ id: 'vid-new', snippet: { title: 'Brand New', description: 'dd', publishedAt: recent(), thumbnails: {} }, statistics: { viewCount: '42' } }) })
    expect(r.changesDetected).toBe(0)
    const vInsert = db.calls.find(c => c.table === 'competitor_videos' && first(c) === 'insert')!
    expect(arg(vInsert, 'insert')).toMatchObject({ video_id: 'vid-new', title: 'Brand New', competitor_channel_id: 'cc-1' })
    const opened = db.calls.find(c => c.table === 'competitor_video_versions' && first(c) === 'insert')!
    const rows = opened.ops[0]![1][0] as Array<{ field: string; precision: string; video_id: string }>
    expect(rows.map(x => x.field).sort()).toEqual(['desc', 'title'])
    expect(rows.every(x => x.precision === 'first' && x.video_id === 'v-new')).toBe(true)
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
    expect(db.calls.some(c => c.table === 'competitor_changes')).toBe(false)
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
    expect(db.calls.some(c => c.table === 'competitor_changes')).toBe(true)
  })

  it('daily record upserts with ignoreDuplicates and starts the series once', async () => {
    const db = setup({ lastDaily: '2026-10-23' })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch({ id: 'vid-1', snippet: { title: 'T', publishedAt: recent() }, statistics: { viewCount: '7' } }) })
    expect(r.dailyRecorded).toBe(1)
    const up = db.calls.find(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')!
    expect(up.ops[0]![1][1]).toMatchObject({ ignoreDuplicates: true })
    expect((up.ops[0]![1][0] as Array<Record<string, unknown>>)[0]).toMatchObject({ video_id: 'v-1', snap_date: '2026-10-24', views: 7 })
    const series = db.calls.find(c => c.table === 'competitor_settings' && first(c) === 'upsert')!
    expect(arg(series, 'upsert')).toMatchObject({ site_id: 'site-1', series_started_at: NOW_ISO })
  })
})
