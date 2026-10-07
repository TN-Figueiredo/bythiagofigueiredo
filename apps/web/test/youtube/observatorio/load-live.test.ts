// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fakeSupabase } from '../../helpers/fake-supabase'
import { buildTables } from './load-fixture'
import { loadLiveRows, loadRows, snapshotReadFrom } from '@/lib/youtube/observatorio/load'
import { spDayStart } from '@/lib/youtube/observatorio/time'

const NOW = Date.now(), DAY = 864e5
const HEAVY = ['competitor_videos', 'competitor_video_versions', 'competitor_video_daily', 'competitor_channel_snapshots']

describe('loadLiveRows', () => {
  it('site sem nenhuma linha: tudo vazio, série nula, sem erro', async () => {
    const db = fakeSupabase({})
    const live = await loadLiveRows(db.client, 'site-vazio', NOW)
    expect(live).toMatchObject({ settings: null, channels: [], ownChannels: [], ownVideos: [], legacyChanges: [], readings: [], tasks: [], heartbeat: null, seriesStartAt: null })
  })
  it('lê as tabelas leves do site e nenhuma das quatro pesadas', async () => {
    const db = fakeSupabase(buildTables({ siteId: 'a', now: NOW }))
    const live = await loadLiveRows(db.client, 'a', NOW)
    expect(live.channels).toHaveLength(2)
    expect(live.ownVideos).toHaveLength(1)
    expect(live.heartbeat).not.toBeNull()
    expect(live.seriesStartAt).toBe(spDayStart(NOW - 5 * DAY))
    expect(db.trips.filter(t => HEAVY.includes(t))).toEqual([])
    expect(db.trips).toHaveLength(9)
  })
  it('série não iniciada: seriesStartAt nulo, nunca o relógio', async () => {
    const db = fakeSupabase(buildTables({ siteId: 'a', now: NOW, seriesStarted: false }))
    expect((await loadLiveRows(db.client, 'a', NOW)).seriesStartAt).toBeNull()
  })
  it('erro numa tabela leve é lançado, nunca vira lista vazia', async () => {
    const db = fakeSupabase(buildTables({ siteId: 'a', now: NOW }), { failOn: 'competitor_channels' })
    await expect(loadLiveRows(db.client, 'a', NOW)).rejects.toThrow(/competitor_channels/)
  })
  it('loadRows devolve a parte leve idêntica e continua lendo as pesadas (diário dos acompanhados e dos fixados)', async () => {
    const tables = buildTables({ siteId: 'a', now: NOW, pinOldest: true })
    const { seriesStartAt: _s, ...live } = await loadLiveRows(fakeSupabase(tables).client, 'a', NOW)
    const rows = await loadRows({ siteId: 'a', now: NOW, supabase: fakeSupabase(tables).client })
    expect({ settings: rows.settings, channels: rows.channels, ownChannels: rows.ownChannels, ownVideos: rows.ownVideos, legacyChanges: rows.legacyChanges, readings: rows.readings, tasks: rows.tasks, heartbeat: rows.heartbeat, niches: rows.niches }).toEqual(live)
    expect(rows.videos).toHaveLength(8)
    // 3 tracked + 1 pinned per channel, 6 days each
    expect(rows.daily).toHaveLength(2 * 4 * 6)
  })
  it('snapshotReadFrom: 90 dias antes, em data de São Paulo', () => {
    expect(snapshotReadFrom(NOW)).toBe(new Date(NOW - 90 * DAY - 3 * 36e5).toISOString().slice(0, 10))
  })
})
