// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HomeTag, HomeVideo } from '../../../lib/home/types'

// ── Fake de Supabase: registra cada consulta e responde por tabela ──
interface Call { table: string; ops: Array<[string, unknown[]]> }
const state = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; ops: Array<[string, unknown[]]> }>,
  tables: {} as Record<string, { data: unknown; count?: number; error?: unknown }>,
}))

vi.mock('next/cache', () => ({ unstable_cache: <T,>(fn: T) => fn }))
vi.mock('../../../lib/cms/site-context', () => ({ getSiteContext: vi.fn() }))
vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      const call: Call = { table, ops: [] }
      state.calls.push(call)
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order', 'limit', 'gt', 'in', 'lte']) {
        q[m] = (...a: unknown[]) => { call.ops.push([m, a]); return q }
      }
      q.then = (res: (v: unknown) => unknown) =>
        Promise.resolve(state.tables[table] ?? { data: [], count: 0, error: null }).then(res)
      return q
    },
  }),
}))

import { getHomeChannels, getHomeVideos, getWeeklyPick, getVideoCount } from '../../../lib/home/queries'

describe('HomeTag type', () => {
  it('has required fields', () => {
    const tag: HomeTag = {
      id: 'uuid-1', name: 'tech', slug: 'tech',
      color: '#6366f1', colorDark: '#818cf8', postCount: 3,
    }
    expect(tag.id).toBe('uuid-1')
    expect(tag.name).toBe('tech')
    expect(tag.postCount).toBe(3)
  })

  it('allows null colorDark', () => {
    const tag: HomeTag = {
      id: 'uuid-2', name: 'vida', slug: 'vida',
      color: '#22c55e', colorDark: null, postCount: 1,
    }
    expect(tag.colorDark).toBeNull()
  })
})

describe('HomeVideo type', () => {
  it('includes isPinned field', () => {
    const video: HomeVideo = {
      id: 'v1', locale: 'en', title: 'Test', description: 'desc',
      thumbnailUrl: null, duration: '5:00', viewCount: 100,
      publishedAt: '2026-01-01', categoryName: null, categoryColor: null,
      youtubeUrl: 'https://youtube.com/watch?v=abc', channelHandle: '@test',
      youtubeVideoId: 'abc', isPinned: true,
    }
    expect(video.isPinned).toBe(true)
  })

  it('isPinned defaults to false for unpinned videos', () => {
    const video: HomeVideo = {
      id: 'v2', locale: 'pt-BR', title: 'Test PT', description: '',
      thumbnailUrl: null, duration: '3:00', viewCount: 50,
      publishedAt: '2026-01-02', categoryName: null, categoryColor: null,
      youtubeUrl: 'https://youtube.com/watch?v=def', channelHandle: '@test',
      youtubeVideoId: 'def', isPinned: false,
    }
    expect(video.isPinned).toBe(false)
  })
})

// ── Regra de transição: um canal por idioma, o mais antigo ──
const orderRows = [
  { id: 'pt-new', locale: 'pt', created_at: '2026-03-01T00:00:00Z' },
  { id: 'en-1', locale: 'en', created_at: '2025-01-01T00:00:00Z' },
  { id: 'pt-old', locale: 'pt', created_at: '2024-01-01T00:00:00Z' },
]
const chanRow = (r: { id: string; locale: string; created_at: string }) => ({
  ...r, handle: `@${r.id}`, name: r.id, subscriber_count: 1, thumbnail_url: null,
  schedule_label: 'x', sync_schedules: null,
})
const videoRow = {
  id: 'v1', youtube_video_id: 'yt1', title: 't', description: 'd', thumbnail_url: null,
  duration: '1:00', view_count: 3, published_at: '2026-01-01', pinned_until: null,
  youtube_channels: { locale: 'pt', handle: '@pt-old' }, youtube_categories: null,
}
const opsOf = (table: string) => state.calls.filter((c) => c.table === table)
const hasEq = (c: Call, col: string, val?: unknown) =>
  c.ops.some(([m, a]) => m === 'eq' && a[0] === col && (val === undefined || a[1] === val))

describe('leitores da home com mais de um canal por idioma', () => {
  beforeEach(() => {
    state.calls.length = 0
    state.tables = { youtube_channels: { data: orderRows.map(chanRow) }, youtube_videos: { data: [videoRow], count: 4 } }
  })

  it('getHomeChannels devolve só a vitrine (en antes de pt)', async () => {
    const out = await getHomeChannels('s1')
    expect(out.map((c) => c.id)).toEqual(['en-1', 'pt-old'])
  })

  it('getHomeVideos filtra por channel_id da vitrine, nunca pelo idioma', async () => {
    await getHomeVideos('s1', 'pt-BR')
    const [v] = opsOf('youtube_videos')
    expect(hasEq(v, 'channel_id', 'pt-old')).toBe(true)
    expect(hasEq(v, 'youtube_channels.locale')).toBe(false)
  })

  it('getWeeklyPick e getVideoCount filtram por channel_id da vitrine', async () => {
    await getWeeklyPick('s1', 'en')
    const picks = opsOf('youtube_videos')
    expect(picks.length).toBeGreaterThan(0)
    for (const c of picks) {
      expect(hasEq(c, 'channel_id', 'en-1')).toBe(true)
      expect(hasEq(c, 'youtube_channels.locale')).toBe(false)
    }
    state.calls.length = 0
    expect(await getVideoCount('s1', 'pt-BR')).toBe(4)
    const [cnt] = opsOf('youtube_videos')
    expect(hasEq(cnt, 'channel_id', 'pt-old')).toBe(true)
    expect(hasEq(cnt, 'youtube_channels.locale')).toBe(false)
  })

  it('site sem canal en: vazio, null e 0 sem consultar vídeos', async () => {
    state.tables.youtube_channels = { data: orderRows.filter((r) => r.locale === 'pt').map(chanRow) }
    expect(await getHomeVideos('s1', 'en')).toEqual([])
    expect(await getWeeklyPick('s1', 'en')).toBeNull()
    expect(await getVideoCount('s1', 'en')).toBe(0)
    expect(opsOf('youtube_videos')).toHaveLength(0)
  })

  it('erro ao ler os canais: vazio, sem consultar vídeos', async () => {
    state.tables.youtube_channels = { data: null, error: { message: 'boom' } }
    expect(await getHomeVideos('s1', 'pt-BR')).toEqual([])
    expect(opsOf('youtube_videos')).toHaveLength(0)
  })
})
