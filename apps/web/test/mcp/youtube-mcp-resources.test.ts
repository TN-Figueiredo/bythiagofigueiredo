// @vitest-environment node
/**
 * Recursos MCP do YouTube que leem `youtube_channels`: `pipeline://youtube/channels` e
 * `pipeline://youtube/intelligence`.
 *
 * O Supabase aqui é um PostgREST em memória que filtra de verdade e recusa coluna inexistente
 * (42703): com um dublê de respostas enfileiradas, o `select('total_views')` que zerava o recurso
 * de canais passava verde.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { createTestMcpPair, type McpTestPair } from './helpers'
import { fakePostgrest, type FakePostgrestOptions } from '../helpers/fake-postgrest'

let sb = fakePostgrest({ tables: {} })

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => sb.client }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))

import { registerResources } from '../../src/lib/pipeline/mcp/resources'

const SITE = 'site-ctx'
const OTHER = 'site-outro'

function channel(over: Record<string, unknown>) {
  return {
    id: 'ch', site_id: SITE, channel_id: 'UCx', slug: 'canal', name: 'Canal', handle: '@canal', locale: 'pt',
    niche: 'viagem', subscriber_count: 0, video_count: 0, sync_enabled: true, last_synced_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

/** Dois sites e três canais. O site do contexto é o primeiro de `sites`; o canal mais antigo dele é `ch-pt`. */
function world(over: Partial<FakePostgrestOptions['tables']> = {}): FakePostgrestOptions {
  return {
    tables: {
      sites: [{ id: SITE }],
      youtube_channels: [
        // de outro site, e o mais antigo de todos: é o que um `.limit(1)` sem filtro pegaria
        channel({ id: 'ch-alheio', site_id: OTHER, slug: 'alheio', name: 'Alheio', subscriber_count: 9, created_at: '2019-01-01T00:00:00Z' }),
        channel({ id: 'ch-en', slug: 'bythiagofigueiredo', name: 'Thiago EN', handle: '@bythiagofigueiredo', locale: 'en', subscriber_count: 50, created_at: '2026-02-01T00:00:00Z' }),
        channel({ id: 'ch-pt', slug: 'tnfigueiredotv', name: 'tnFigueiredo', handle: '@tnfigueiredotv', subscriber_count: 1160, video_count: 42, created_at: '2025-01-01T00:00:00Z' }),
      ],
      youtube_niches: [{ site_id: SITE, slug: 'viagem', label: 'Viagem', color_dark: '#5BBF8A', color_light: '#11692F', sort_order: 10 }],
      youtube_videos: [
        { id: 'v-pt', site_id: SITE, channel_id: 'ch-pt', youtube_video_id: 'ytpt', title: 'pt', thumbnail_url: null, published_at: '2026-01-01T00:00:00Z', view_count: 1, ctr: null, impressions: null, avg_view_percentage: null, avg_view_duration_seconds: null, retention_curve: null, traffic_sources: null, is_hidden: false },
      ],
      video_grade_history: [],
      optimization_cycles: [],
      ab_tests: [],
      youtube_intelligence: [],
      youtube_video_analytics: [],
      ...over,
    } as FakePostgrestOptions['tables'],
    columns: {
      youtube_intelligence: ['channel_id', 'site_id', 'source', 'generated_at'],
      youtube_video_analytics: ['date', 'site_id', 'youtube_video_id', 'views', 'subscribers_gained'],
      video_grade_history: ['site_id', 'youtube_video_id', 'grade', 'score', 'ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact', 'week_iso'],
      optimization_cycles: ['id', 'site_id', 'youtube_video_id', 'state'],
      ab_tests: ['id', 'site_id', 'youtube_video_id', 'name', 'status', 'test_type', 'winner_variant_id', 'completed_reason', 'config', 'created_at'],
      youtube_videos: ['id', 'site_id', 'channel_id', 'youtube_video_id', 'title', 'thumbnail_url', 'published_at', 'view_count', 'ctr', 'impressions', 'avg_view_percentage', 'avg_view_duration_seconds', 'retention_curve', 'traffic_sources', 'is_hidden'],
      youtube_channels: ['id', 'site_id', 'channel_id', 'slug', 'name', 'handle', 'locale', 'niche', 'subscriber_count', 'video_count', 'sync_enabled', 'last_synced_at', 'created_at'],
    },
  }
}

let pair: McpTestPair | null = null
async function read(uri: string, opts: FakePostgrestOptions): Promise<unknown> {
  sb = fakePostgrest(opts)
  pair = await createTestMcpPair({ setupServer: server => registerResources(server) })
  const res = await pair.client.readResource({ uri })
  return JSON.parse((res.contents[0] as { text: string }).text)
}

afterEach(async () => {
  await pair?.cleanup()
  pair = null
})

describe('pipeline://youtube/channels', () => {
  it('devolve os canais do site (antes: sempre { channels: [] }, por selecionar total_views)', async () => {
    const body = await read('pipeline://youtube/channels', world()) as { channels: Array<Record<string, unknown>> }

    expect(body.channels.map(c => c.id)).toEqual(['ch-pt', 'ch-en'])
    expect(body.channels[0]).toEqual({
      id: 'ch-pt', channel_id: 'UCx', slug: 'tnfigueiredotv', name: 'tnFigueiredo', handle: '@tnfigueiredotv', locale: 'pt',
      niche: 'viagem', niche_label: 'Viagem', subscriber_count: 1160, video_count: 42, sync_enabled: true, last_synced_at: null,
    })
  })

  it('nenhum select em youtube_channels pede total_views', async () => {
    await read('pipeline://youtube/channels', world())
    const selects = sb.on('youtube_channels').map(q => q.select)
    expect(selects.length).toBeGreaterThan(0)
    for (const s of selects) expect(s).not.toContain('total_views')
  })

  it('site sem canal → { channels: [] }', async () => {
    const body = await read('pipeline://youtube/channels', world({
      youtube_channels: [channel({ id: 'ch-alheio', site_id: OTHER })],
    }))
    expect(body).toEqual({ channels: [] })
  })

  it('erro de banco na leitura → o recurso falha; nunca responde lista vazia', async () => {
    const opts = world()
    opts.fail = q => (q.table === 'youtube_channels' ? { code: '57014', message: 'statement timeout' } : null)
    await expect(read('pipeline://youtube/channels', opts)).rejects.toThrow()
  })
})

describe('pipeline://youtube/intelligence', () => {
  it('com dois sites e três canais, usa o primeiro canal do site do contexto na ordem de cadastro', async () => {
    const body = await read('pipeline://youtube/intelligence', world()) as { channel: { id: string; name: string }; videos: Array<{ id: string }> }

    expect(body.channel).toMatchObject({ id: 'ch-pt', name: 'tnFigueiredo' })
    expect(body.videos.map(v => v.id)).toEqual(['v-pt'])
    // toda leitura de youtube_channels tem filtro de site
    for (const q of sb.on('youtube_channels')) {
      expect(q.filters).toContainEqual({ op: 'eq', col: 'site_id', value: SITE })
    }
  })

  it('site sem canal → erro "No YouTube channel found"', async () => {
    const opts = world({ youtube_channels: [channel({ id: 'ch-alheio', site_id: OTHER })] })
    await expect(read('pipeline://youtube/intelligence', opts)).rejects.toThrow(/No YouTube channel found/)
    // e o canal do outro site nunca é lido
    expect(sb.on('youtube_videos')).toHaveLength(0)
  })

  it('primeiro canal sem vídeos → snapshot com as listas vazias (o dado não existe), sem erro', async () => {
    const body = await read('pipeline://youtube/intelligence', world({ youtube_videos: [] })) as Record<string, unknown>
    expect(body).toMatchObject({ videos: [], grade_history: [], optimization_cycles: [], ab_tests: [], recent_window: null })
  })
})
