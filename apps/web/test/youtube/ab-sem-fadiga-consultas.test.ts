// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Cliente falso: devolve linhas por tabela; qualquer encadeamento é aguardável.
const TABLES: Record<string, unknown[]> = {}
const from = vi.fn((table: string) => {
  const rows = TABLES[table] ?? []
  const chain: Record<string, unknown> = {}
  const self = new Proxy(chain, {
    get(_t, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve({ data: rows, error: null })
      }
      return () => self
    },
  })
  return self
})

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from }) }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/videos/videos-connected', () => ({
  VideosConnected: () => null,
}))

import { getSuggestedVideos } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import YouTubeVideosPage from '@/app/cms/(authed)/youtube/videos/page'

const PENDING_ALERT = { id: 'al-1', video_id: 'v-1', status: 'pending', site_id: 'site-1' }

function tablesQueried(): string[] {
  return from.mock.calls.map(c => c[0] as string)
}

beforeEach(() => {
  from.mockClear()
  for (const k of Object.keys(TABLES)) delete TABLES[k]
  TABLES.youtube_fatigue_alerts = [PENDING_ALERT]
})

describe('sem fadiga: consultas', () => {
  it('a sugestão de vídeos não consulta youtube_fatigue_alerts nem rotula "CTR em declínio"', async () => {
    TABLES.youtube_videos = [
      { id: 'v-1', title: 'Um', thumbnail_url: null, ctr: 0.02, view_count: 5000, impressions: 1000 },
      { id: 'v-2', title: 'Dois', thumbnail_url: null, ctr: 0.05, view_count: 4000, impressions: 1000 },
    ]
    const out = await getSuggestedVideos('site-1')
    expect(out.length).toBeGreaterThan(0)
    expect(tablesQueried()).not.toContain('youtube_fatigue_alerts')
    for (const v of out) expect(v.reason).not.toContain('CTR em declínio')
  })

  it('a página de vídeos não consulta youtube_fatigue_alerts', async () => {
    TABLES.youtube_videos = [
      {
        id: 'v-1', youtube_video_id: 'yt1', title: 'Um', published_at: '2026-01-01T00:00:00Z',
        youtube_channels: { locale: 'pt', handle: 'h', name: 'n' },
      },
    ]
    await YouTubeVideosPage()
    expect(tablesQueried()).toContain('youtube_videos')
    expect(tablesQueried()).not.toContain('youtube_fatigue_alerts')
  })
})
