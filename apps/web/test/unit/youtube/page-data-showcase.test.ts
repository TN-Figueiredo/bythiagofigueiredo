// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({ tables: {} as Record<string, { data: unknown }> }))
vi.mock('next/cache', () => ({ unstable_cache: <T,>(fn: T) => fn }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order']) q[m] = () => q
      q.then = (res: (v: unknown) => unknown) => Promise.resolve(state.tables[table] ?? { data: [] }).then(res)
      return q
    },
  }),
}))

import { getYouTubePageData } from '@/lib/youtube/queries'

const channel = (id: string, locale: string, created_at: string) => ({
  id, locale, created_at, handle: `@${id}`, name: id, description: null,
  subscriber_count: 1, video_count: 1, thumbnail_url: null,
})
const video = (id: string, channel_id: string, locale: string) => ({
  id, channel_id, youtube_video_id: `yt-${id}`, title: id, title_translation: null, description: '',
  description_translation: null, duration: '1:00', duration_seconds: 60, published_at: '2026-01-01',
  thumbnail_url: null, thumbnail_hq_url: null, tags: [], view_count: 1, like_count: 0, comment_count: 0,
  category_id: 'cat1', is_featured: false, pinned_until: null,
  youtube_channels: { locale, handle: `@${channel_id}` },
})
const comment = (id: string, channel_id: string, locale: string) => ({
  id, video_id: `v-${channel_id}`, author_handle: 'a', author_avatar_url: null, text_pt: 'p', text_en: 'e',
  like_count: 1, published_at: '2026-01-01',
  youtube_videos: { title: 't', youtube_video_id: 'y', channel_id, youtube_channels: { locale } },
})

const two = [channel('pt-1', 'pt', '2024-01-01T00:00:00Z'), channel('en-1', 'en', '2025-01-01T00:00:00Z')]
const three = [...two, channel('pt-2', 'pt', '2026-01-01T00:00:00Z')]
const cat = { id: 'cat1', slug: 'c', name_pt: 'C', name_en: 'C', color: '#fff', sort_order: 1 }

function seed(channels: unknown[]) {
  state.tables = {
    youtube_channels: { data: channels },
    youtube_categories: { data: [cat] },
    youtube_videos: { data: [video('v1', 'pt-1', 'pt'), video('v2', 'en-1', 'en'), video('v3', 'pt-2', 'pt')].filter((v) => (channels as { id: string }[]).some((c) => c.id === v.channel_id)) },
    youtube_curated_comments: { data: [comment('c1', 'pt-1', 'pt'), comment('c3', 'pt-2', 'pt')].filter((c) => (channels as { id: string }[]).some((ch) => ch.id === c.youtube_videos.channel_id)) },
  }
}

describe('getYouTubePageData com a regra de transição', () => {
  beforeEach(() => seed(two))

  it('com dois canais, entrega tudo (em ordem de cadastro)', async () => {
    const d = await getYouTubePageData('s1')
    expect(d.channels.map((c) => c.id)).toEqual(['pt-1', 'en-1'])
    expect(d.videos.map((v) => v.id).sort()).toEqual(['v1', 'v2'])
    expect(d.comments.map((c) => c.id)).toEqual(['c1'])
    expect(d.totalVideoCount).toBe(2)
  })

  it('com três canais, o terceiro some: canal, vídeos, comentários e contagens', async () => {
    seed(three)
    const d = await getYouTubePageData('s1')
    expect(d.channels).toHaveLength(2)
    expect(d.channels.map((c) => c.id)).not.toContain('pt-2')
    expect(d.videos.map((v) => v.id)).not.toContain('v3')
    expect(d.comments.map((c) => c.id)).toEqual(['c1'])
    expect(d.totalVideoCount).toBe(2)
    expect(d.categories[0].count).toBe(2)
  })

  it('sem canais: tudo vazio', async () => {
    seed([])
    const d = await getYouTubePageData('s1')
    expect(d.channels).toEqual([])
    expect(d.videos).toEqual([])
    expect(d.comments).toEqual([])
  })

  it('ordem de cadastro: pt criado antes de en devolve [pt, en]', async () => {
    seed([channel('pt-1', 'pt', '2024-01-01T00:00:00Z'), channel('en-1', 'en', '2025-01-01T00:00:00Z')])
    expect((await getYouTubePageData('s1')).channels.map((c) => c.id)).toEqual(['pt-1', 'en-1'])
  })

  it('ordem de cadastro: en criado antes de pt devolve [en, pt]', async () => {
    seed([channel('pt-1', 'pt', '2025-01-01T00:00:00Z'), channel('en-1', 'en', '2024-01-01T00:00:00Z')])
    expect((await getYouTubePageData('s1')).channels.map((c) => c.id)).toEqual(['en-1', 'pt-1'])
  })

  it('três canais (dois pt + um en): a vitrine sai em ordem de cadastro', async () => {
    seed([
      channel('pt-2', 'pt', '2026-01-01T00:00:00Z'),
      channel('pt-1', 'pt', '2024-06-01T00:00:00Z'),
      channel('en-1', 'en', '2024-01-01T00:00:00Z'),
    ])
    expect((await getYouTubePageData('s1')).channels.map((c) => c.id)).toEqual(['en-1', 'pt-1'])
  })
})
