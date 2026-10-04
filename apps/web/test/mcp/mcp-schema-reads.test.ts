// @vitest-environment node
/**
 * Leituras do MCP e dos serviços que consultavam tabela/coluna inexistente e respondiam vazio.
 *
 * PostgREST em memória que RECUSA coluna inexistente (42703), inclusive em tabela vazia
 * (`columns`), e tabela inexistente (PGRST205). Cada caso aqui falhava antes do conserto.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { createTestMcpPair, type McpTestPair } from './helpers'
import { fakePostgrest, type FakePostgrestOptions } from '../helpers/fake-postgrest'

let sb = fakePostgrest({ tables: {} })

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => sb.client }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
import * as Sentry from '@sentry/nextjs'
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))

import { registerResources } from '../../src/lib/pipeline/mcp/resources'
import { registerPrompts } from '../../src/lib/pipeline/mcp/prompts'
import { searchContent, getTopicAggregation } from '../../src/lib/pipeline/services/utilities'
import { getAbTestFunnel } from '../../src/lib/pipeline/services/youtube'
import type { ServiceContext } from '../../src/lib/pipeline/services/types'

const SITE = 'site-1'
const OTHER = 'site-2'
const DAY = 864e5
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString()

let pair: McpTestPair | null = null
afterEach(async () => { await pair?.cleanup(); pair = null; vi.mocked(Sentry.captureMessage).mockClear() })

async function readResource(uri: string, opts: FakePostgrestOptions): Promise<{ text: string }> {
  sb = fakePostgrest(opts)
  pair = await createTestMcpPair({ setupServer: s => registerResources(s) })
  const res = await pair.client.readResource({ uri })
  return res.contents[0] as { text: string }
}
async function readJson(uri: string, opts: FakePostgrestOptions): Promise<Record<string, unknown>> {
  return JSON.parse((await readResource(uri, opts)).text)
}
async function prompt(name: string, args: Record<string, string>, opts: FakePostgrestOptions): Promise<string> {
  sb = fakePostgrest(opts)
  pair = await createTestMcpPair({ setupServer: s => registerPrompts(s) })
  const res = await pair.client.getPrompt({ name, arguments: args })
  return (res.messages[0]!.content as { text: string }).text
}
const ctx = (): ServiceContext => ({ siteId: SITE, permissions: ['read'], supabase: sb.client as unknown as ServiceContext['supabase'], source: 'api_key' })

describe('pipeline://context/{skill}', () => {
  const world = (): FakePostgrestOptions => ({
    tables: {
      sites: [{ id: SITE }],
      reference_content: [
        { site_id: SITE, key: '_system/skill-mappings', title: null, content_md: null, content_compact: { ideator: ['voz', 'nichos'] }, ref_group: 'sys', sort_order: 0, version: 1, updated_at: iso(1) },
        { site_id: SITE, key: 'voz', title: 'Voz', content_md: 'Direta, sem enrolar.', content_compact: {}, ref_group: 'brand', sort_order: 1, version: 1, updated_at: iso(1) },
        { site_id: SITE, key: 'nichos', title: 'Nichos', content_md: 'Viagem e carreira.', content_compact: {}, ref_group: 'brand', sort_order: 2, version: 1, updated_at: iso(1) },
        { site_id: SITE, key: 'outro', title: 'Fora do mapa', content_md: 'não entra', content_compact: {}, ref_group: 'brand', sort_order: 3, version: 1, updated_at: iso(1) },
        { site_id: OTHER, key: 'voz', title: 'Voz alheia', content_md: 'segredo do outro site', content_compact: {}, ref_group: 'brand', sort_order: 1, version: 1, updated_at: iso(1) },
      ],
    },
    columns: { reference_content: ['site_id', 'key', 'title', 'content_md', 'content_compact', 'ref_group', 'sort_order', 'version', 'updated_at'] },
  })

  it('devolve os documentos que o mapa da skill nomeia, do site (antes: lia a tabela pipeline_context, que não existe)', async () => {
    const { text } = await readResource('pipeline://context/ideator', world())
    expect(text).toContain('## Voz\n\nDireta, sem enrolar.')
    expect(text).toContain('## Nichos\n\nViagem e carreira.')
    expect(text).not.toContain('não entra')
    expect(text).not.toContain('segredo do outro site')
    expect(sb.on('pipeline_context')).toHaveLength(0)
  })

  it('erro de leitura derruba o recurso, não vira "nenhum conteúdo"', async () => {
    const opts = world()
    opts.fail = q => (q.table === 'reference_content' && q.select.includes('content_md') ? { code: '57014', message: 'statement timeout' } : null)
    await expect(readResource('pipeline://context/ideator', opts)).rejects.toThrow()
  })
})

describe('pipeline://stats e o resumo do prompt ideator', () => {
  const world = (): FakePostgrestOptions => ({
    tables: {
      sites: [{ id: SITE }],
      content_pipeline: [
        { id: 'a', site_id: SITE, format: 'video', stage: 'idea', priority: 3, is_archived: false },
        { id: 'b', site_id: SITE, format: 'video', stage: 'idea', priority: 3, is_archived: true },
        { id: 'c', site_id: OTHER, format: 'blog_post', stage: 'idea', priority: 3, is_archived: false },
      ],
      reference_content: [],
    },
    columns: { content_pipeline: ['id', 'site_id', 'format', 'stage', 'priority', 'is_archived'], reference_content: ['site_id', 'key', 'title', 'content_md', 'content_compact', 'ref_group', 'sort_order', 'version', 'updated_at'] },
  })

  it('stats conta só os itens ativos do site (antes: .eq("archived") → 42703, e sem filtro de site)', async () => {
    const body = await readJson('pipeline://stats', world()) as { total: number; byFormat: Record<string, number> }
    expect(body.total).toBe(1)
    expect(body.byFormat).toEqual({ video: 1 })
  })

  it('o prompt ideator traz o resumo do pipeline do site', async () => {
    const text = await prompt('ideator', {}, world())
    expect(text).toContain('Pipeline: 1 active items')
    expect(text).toContain('video: 1')
  })

  it('resumo de stats é secundário: erro de leitura vira linha "unavailable" + Sentry, não "0 itens" nem prompt caído', async () => {
    const opts = world()
    opts.fail = q => (q.table === 'content_pipeline' ? { code: '42703', message: 'column content_pipeline.x does not exist' } : null)
    const text = await prompt('ideator', {}, opts)
    expect(text).toContain('Pipeline stats: unavailable: pipeline stats (Failed to read the pipeline stats')
    expect(text).not.toContain('0 active items')
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('pipeline stats unavailable'), expect.anything())
  })

  it('contexto da skill é central: erro de leitura derruba o prompt', async () => {
    const opts = world()
    opts.fail = q => (q.table === 'reference_content' ? { code: '57014', message: 'timeout' } : null)
    await expect(prompt('ideator', {}, opts)).rejects.toThrow()
  })
})

describe('pipeline://audio/stats', () => {
  const AUDIO_COLS = { audio_assets: ['id', 'site_id', 'category', 'mood', 'energy', 'status'], audio_asset_usage: ['id', 'site_id', 'audio_asset_id'] }
  const world = (usageOfA: number): FakePostgrestOptions => ({
    tables: {
      sites: [{ id: SITE }],
      audio_assets: [
        { id: 'a', site_id: SITE, category: 'music', mood: ['calm', 'epic'], energy: 0, status: 'downloaded' },
        { id: 'b', site_id: SITE, category: 'music', mood: ['calm'], energy: 3, status: 'pending' },
        { id: 'c', site_id: SITE, category: 'sfx', mood: [], energy: null, status: 'downloaded' },
        { id: 'z', site_id: SITE, category: 'music', mood: ['sad'], energy: 5, status: 'retired' },
      ],
      audio_asset_usage: [
        ...Array.from({ length: usageOfA }, (_, i) => ({ id: `u${String(i).padStart(5, '0')}`, site_id: SITE, audio_asset_id: 'a' })),
        ...Array.from({ length: 5 }, (_, i) => ({ id: `w${i}`, site_id: SITE, audio_asset_id: 'b' })),
        { id: 'x1', site_id: OTHER, audio_asset_id: 'a' },
      ],
    },
    columns: AUDIO_COLS,
    maxRows: 1000, // o max_rows do Supabase: um `.limit(10000)` não passa disso
  })

  it('conta mais de 1000 usos sem truncar (antes: .limit(10000) cortava em 1000, sem erro)', async () => {
    const body = await readJson('pipeline://audio/stats', world(1500)) as { totalUsages: number; topUsed: Array<{ id: string; usageCount: number }> }
    expect(body.totalUsages).toBe(1505)
    expect(body.topUsed[0]).toMatchObject({ id: 'a', usageCount: 1500 })
    expect(body.topUsed[1]).toMatchObject({ id: 'b', usageCount: 5 })
  })

  it('mood é text[]: cada tag conta; energia 0 é um nível', async () => {
    const body = await readJson('pipeline://audio/stats', world(2)) as { byMood: Record<string, number>; byEnergy: Record<string, number>; totalAssets: number }
    expect(body.totalAssets).toBe(3)
    expect(body.byMood).toEqual({ calm: 2, epic: 1 })
    expect(body.byEnergy).toEqual({ '0': 1, '3': 1 })
  })

  it('erro de leitura derruba o recurso', async () => {
    const opts = world(2)
    opts.fail = q => (q.table === 'audio_asset_usage' ? { code: '57014', message: 'timeout' } : null)
    await expect(readResource('pipeline://audio/stats', opts)).rejects.toThrow()
  })
})

describe('recursos de concorrentes', () => {
  const world = (): FakePostgrestOptions => ({
    tables: {
      sites: [{ id: SITE }],
      competitor_channels: [
        { id: 'c1', site_id: SITE, channel_id: 'UC1', channel_name: 'Antigo', subscriber_count: 10, youtube_video_count: 5, sync_status: 'idle', last_synced_at: iso(1), added_at: iso(30) },
        { id: 'c2', site_id: SITE, channel_id: 'UC2', channel_name: 'Novo', subscriber_count: 20, youtube_video_count: 9, sync_status: 'syncing', last_synced_at: null, added_at: iso(2) },
        { id: 'c3', site_id: OTHER, channel_id: 'UC3', channel_name: 'Alheio', subscriber_count: 1, youtube_video_count: 1, sync_status: 'idle', last_synced_at: null, added_at: iso(1) },
      ],
      competitor_changes: [
        { id: 'k1', site_id: SITE, change_type: 'title', old_title: 'a', new_title: 'b', old_thumbnail_url: null, new_thumbnail_url: null, view_count_at_change: 100, detected_at: iso(1), bookmarked: true, video_id: 'v1', competitor_videos: { title: 'Vídeo 1', video_id: 'yt1', competitor_channels: { channel_name: 'Antigo' } } },
        { id: 'k2', site_id: SITE, change_type: 'thumbnail', old_title: null, new_title: null, old_thumbnail_url: 'o', new_thumbnail_url: 'n', view_count_at_change: 50, detected_at: iso(2), bookmarked: false, video_id: 'v2', competitor_videos: { title: 'Vídeo 2', video_id: 'yt2', competitor_channels: { channel_name: 'Novo' } } },
        { id: 'k3', site_id: SITE, change_type: 'title', old_title: 'x', new_title: 'y', old_thumbnail_url: null, new_thumbnail_url: null, view_count_at_change: 5, detected_at: iso(20), bookmarked: false, video_id: 'v1', competitor_videos: { title: 'Vídeo 1', video_id: 'yt1', competitor_channels: { channel_name: 'Antigo' } } },
        { id: 'k4', site_id: OTHER, change_type: 'title', old_title: 'p', new_title: 'q', old_thumbnail_url: null, new_thumbnail_url: null, view_count_at_change: 1, detected_at: iso(1), bookmarked: true, video_id: 'v9', competitor_videos: { title: 'Alheio', video_id: 'yt9', competitor_channels: { channel_name: 'Alheio' } } },
      ],
    },
    columns: {
      competitor_channels: ['id', 'site_id', 'channel_id', 'channel_name', 'subscriber_count', 'youtube_video_count', 'sync_status', 'last_synced_at', 'added_at'],
      competitor_changes: ['id', 'site_id', 'change_type', 'old_title', 'new_title', 'old_thumbnail_url', 'new_thumbnail_url', 'view_count_at_change', 'detected_at', 'bookmarked', 'video_id'],
    },
  })

  it('channels: os canais do site, o mais novo primeiro, com a contagem de vídeos do YouTube', async () => {
    const body = await readJson('pipeline://youtube/competitors/channels', world()) as { channels: Array<Record<string, unknown>> }
    expect(body.channels.map(c => c.id)).toEqual(['c2', 'c1'])
    expect(body.channels[0]).toMatchObject({ channel_name: 'Novo', youtube_video_count: 9, sync_status: 'syncing' })
  })

  it('changes: as mudanças do site, com tipo, títulos, vídeo e canal', async () => {
    const body = await readJson('pipeline://youtube/competitors/changes', world()) as { changes: Array<Record<string, unknown>> }
    expect(body.changes.map(c => c.id)).toEqual(['k1', 'k2', 'k3'])
    expect(body.changes[0]).toMatchObject({ change_type: 'title', old_title: 'a', new_title: 'b', video_title: 'Vídeo 1', channel_name: 'Antigo', bookmarked: true })
  })

  it('outliers: só as mudanças marcadas do site', async () => {
    const body = await readJson('pipeline://youtube/competitors/outliers', world()) as { outliers: Array<Record<string, unknown>> }
    expect(body.outliers.map(c => c.id)).toEqual(['k1'])
  })

  it('insights: mudanças dos últimos 7 dias por tipo', async () => {
    const body = await readJson('pipeline://youtube/competitors/insights', world()) as { totalChannels: number; recentChanges7d: number; changesByField: Record<string, number> }
    expect(body.totalChannels).toBe(2)
    expect(body.recentChanges7d).toBe(2)
    expect(body.changesByField).toEqual({ title: 1, thumbnail: 1 })
  })

  it.each(['channels', 'changes', 'outliers', 'insights'])('%s: erro de leitura derruba o recurso, não responde vazio', async (name) => {
    const opts = world()
    opts.fail = q => (q.table.startsWith('competitor_') ? { code: '57014', message: 'timeout' } : null)
    await expect(readResource(`pipeline://youtube/competitors/${name}`, opts)).rejects.toThrow()
  })
})

describe('youtube-analyst: idade da análise', () => {
  const world = (intel: Array<Record<string, unknown>>): FakePostgrestOptions => ({
    tables: {
      sites: [{ id: SITE }],
      youtube_channels: [{ id: 'ch', site_id: SITE, name: 'Canal', subscriber_count: 1200, created_at: iso(100) }],
      youtube_intelligence: intel,
    },
    columns: {
      youtube_channels: ['id', 'site_id', 'name', 'subscriber_count', 'created_at'],
      youtube_intelligence: ['site_id', 'channel_id', 'source', 'generated_at'],
    },
  })

  it('sem análise: o prompt diz que não há análise (antes: "age: 999h")', async () => {
    const text = await prompt('youtube-analyst', { channel_id: 'ch' }, world([]))
    expect(text).toContain('Intelligence snapshot: none yet')
    expect(text).not.toContain('999h')
    expect(text).toContain('## Step 1')
  })

  it('com análise: diz a idade em horas', async () => {
    const text = await prompt('youtube-analyst', { channel_id: 'ch' }, world([{ site_id: SITE, channel_id: 'ch', source: 'cowork', generated_at: new Date(Date.now() - 5 * 3600000 - 60000).toISOString() }]))
    expect(text).toContain('Intelligence snapshot age: 5h')
  })

  it('idade da análise é secundária: erro vira linha "unavailable" + Sentry; o canal segue certo', async () => {
    const opts = world([])
    opts.fail = q => (q.table === 'youtube_intelligence' ? { code: '57014', message: 'timeout' } : null)
    const text = await prompt('youtube-analyst', { channel_id: 'ch' }, opts)
    expect(text).toContain('Intelligence snapshot age: unavailable: intelligence snapshot age (Failed to read the intelligence snapshot: timeout)')
    expect(text).not.toContain('none yet')
    expect(text).toContain('Channel: Canal')
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })

  it('nome do canal é secundário: erro vira "Unknown" + nota "unavailable" (youtube-analyst)', async () => {
    const opts = world([])
    opts.fail = q => (q.table === 'youtube_channels' ? { code: '57014', message: 'timeout' } : null)
    const text = await prompt('youtube-analyst', { channel_id: 'ch' }, opts)
    expect(text).toContain('> unavailable: channel name (Failed to read the channel: timeout)')
    expect(text).toContain('Channel: Unknown')
  })

  it('ab-ideate: nota "unavailable" no topo quando a idade do snapshot falha; o item central (ab_tests) continua derrubando', async () => {
    const ab = world([])
    ab.tables.ab_tests = []
    ab.columns = { ...ab.columns, ab_tests: ['id', 'site_id', 'status', 'test_type', 'winner_variant_id', 'completed_reason', 'completed_at', 'youtube_video_id'] }
    ab.fail = q => (q.table === 'youtube_intelligence' ? { code: '57014', message: 'timeout' } : null)
    const text = await prompt('ab-ideate', { test_type: 'title' }, ab)
    expect(text.startsWith('> unavailable: intelligence snapshot age')).toBe(true)

    const central = world([])
    central.tables.ab_tests = []
    central.columns = { ...central.columns, ab_tests: ['id', 'site_id', 'status', 'test_type', 'winner_variant_id', 'completed_reason', 'completed_at', 'youtube_video_id'] }
    central.fail = q => (q.table === 'ab_tests' ? { code: '57014', message: 'timeout' } : null)
    await expect(prompt('ab-ideate', { test_type: 'title' }, central)).rejects.toThrow()
  })
})

describe('serviços: busca de blog e totais de cliques', () => {
  const blog = (): FakePostgrestOptions => ({
    tables: {
      content_pipeline: [],
      newsletter_editions: [{ id: 'n1', site_id: SITE, subject: 'Roma na prática', status: 'draft' }],
      blog_translations: [
        { post_id: 'p1', title: 'Roma em 3 dias', slug: 'roma-em-3-dias', locale: 'pt-br', blog_posts: { status: 'published', category: 'viagem', site_id: SITE } },
        { post_id: 'p1', title: 'Rome in 3 days', slug: 'rome-in-3-days', locale: 'en', blog_posts: { status: 'published', category: 'viagem', site_id: SITE } },
        { post_id: 'p2', title: 'Roma do outro site', slug: 'roma-outro', locale: 'pt-br', blog_posts: { status: 'published', category: 'viagem', site_id: OTHER } },
        { post_id: 'p3', title: 'Paris', slug: 'paris', locale: 'pt-br', blog_posts: { status: 'draft', category: 'viagem', site_id: SITE } },
      ],
      blog_posts: [
        { id: 'p1', site_id: SITE, status: 'published', category: 'viagem', locale: 'pt-br', blog_translations: [{ title: 'Rome in 3 days', slug: 'rome-in-3-days', locale: 'en' }, { title: 'Roma em 3 dias', slug: 'roma-em-3-dias', locale: 'pt-br' }] },
        { id: 'p4', site_id: SITE, status: 'draft', category: 'viagem', locale: 'pt-br', blog_translations: [] },
        { id: 'p5', site_id: OTHER, status: 'published', category: 'viagem', locale: 'pt-br', blog_translations: [{ title: 'x', slug: 'x', locale: 'pt-br' }] },
      ],
    },
    columns: {
      content_pipeline: ['id', 'code', 'title_pt', 'title_en', 'format', 'stage', 'priority', 'tags', 'updated_at', 'site_id', 'search_vector', 'is_archived'],
      newsletter_editions: ['id', 'subject', 'status', 'site_id'],
      blog_translations: ['post_id', 'title', 'slug', 'locale'],
      blog_posts: ['id', 'site_id', 'status', 'category', 'locale'],
    },
  })

  it('searchContent acha posts pelo título/slug da tradução, só do site (antes: blog_posts.title → 42703 → lista vazia)', async () => {
    sb = fakePostgrest(blog())
    const { data } = await searchContent(ctx(), 'roma')
    expect(data.blog_posts.map(b => `${b.id}:${b.locale}:${b.slug}`).sort()).toEqual(['p1:pt-br:roma-em-3-dias'])
    expect(data.blog_posts[0]).toMatchObject({ title: 'Roma em 3 dias', status: 'published', category: 'viagem' })
    expect(data.newsletters.map(n => n.id)).toEqual(['n1'])
  })

  it('searchContent: erro de leitura é erro, não lista vazia', async () => {
    const opts = blog()
    opts.fail = q => (q.table === 'blog_translations' ? { code: '42703', message: 'column does not exist' } : null)
    sb = fakePostgrest(opts)
    await expect(searchContent(ctx(), 'roma')).rejects.toMatchObject({ code: 'DB_ERROR' })
  })

  it('getTopicAggregation: título e slug vêm da tradução na língua do post; sem tradução, o post fica de fora', async () => {
    sb = fakePostgrest(blog())
    const { data } = await getTopicAggregation(ctx(), 'viagem')
    expect(data.blog_posts).toEqual([{ id: 'p1', title: 'Roma em 3 dias', slug: 'roma-em-3-dias', status: 'published', category: 'viagem' }])
  })
})

describe('serviços: funil do A/B conta cliques na janela do teste', () => {
  const START = '2026-03-01T00:00:00.000Z'
  const END = '2026-03-10T00:00:00.000Z'
  const world = (test: Record<string, unknown>): FakePostgrestOptions => ({
    tables: {
      ab_tests: [{ id: 't1', site_id: SITE, ...test }],
      ab_test_tracked_links: [
        { ab_test_id: 't1', variant_id: 'v1', link_id: 'l1', template_name: 'A', short_code: 'abc', created_at: START, link: null },
        { ab_test_id: 't1', variant_id: 'v2', link_id: 'l2', template_name: 'B', short_code: 'def', created_at: START, link: null },
        { ab_test_id: 't1', variant_id: 'v2', link_id: 'l3', template_name: 'C', short_code: 'ghi', created_at: START, link: null },
      ],
      ab_test_cycles: [{ test_id: 't1', variant_id: 'v1', impressions: 100, clicks: 7 }],
      tracked_links: [
        { id: 'l1', site_id: SITE, deleted_at: null, total_clicks: 9999 },
        { id: 'l2', site_id: SITE, deleted_at: null, total_clicks: 9999 },
        { id: 'l3', site_id: SITE, deleted_at: '2026-03-05T00:00:00Z', total_clicks: 9999 },
      ],
      link_clicks: [
        { id: 'c1', site_id: SITE, link_id: 'l1', is_bot: false, clicked_at: '2026-03-02T00:00:00.000Z' },
        { id: 'c2', site_id: SITE, link_id: 'l1', is_bot: false, clicked_at: '2026-03-09T00:00:00.000Z' },
        { id: 'c3', site_id: SITE, link_id: 'l1', is_bot: true, clicked_at: '2026-03-03T00:00:00.000Z' },
        { id: 'c4', site_id: SITE, link_id: 'l1', is_bot: false, clicked_at: '2026-02-20T00:00:00.000Z' }, // antes do teste
        { id: 'c5', site_id: SITE, link_id: 'l1', is_bot: false, clicked_at: '2026-03-20T00:00:00.000Z' }, // depois do vencedor aplicado
        { id: 'c6', site_id: OTHER, link_id: 'l1', is_bot: false, clicked_at: '2026-03-04T00:00:00.000Z' },
        { id: 'c7', site_id: SITE, link_id: 'l2', is_bot: false, clicked_at: '2026-03-04T00:00:00.000Z' },
        { id: 'c8', site_id: SITE, link_id: 'l3', is_bot: false, clicked_at: '2026-03-04T00:00:00.000Z' },
      ],
    },
    columns: {
      ab_tests: ['id', 'site_id', 'started_at', 'completed_at'],
      ab_test_tracked_links: ['ab_test_id', 'variant_id', 'link_id', 'template_name', 'short_code', 'created_at'],
      ab_test_cycles: ['test_id', 'variant_id', 'impressions', 'clicks'],
      tracked_links: ['id', 'site_id', 'deleted_at', 'total_clicks'],
      link_clicks: ['id', 'site_id', 'link_id', 'is_bot', 'clicked_at'],
    },
  })

  it('teste concluído: só cliques humanos entre início e fim; lifetime e cliques depois do fim ficam de fora', async () => {
    sb = fakePostgrest(world({ started_at: START, completed_at: END }))
    const { data } = await getAbTestFunnel(ctx(), 't1')
    expect(data.link_clicks_window).toEqual({ from: START, to: END })
    expect(data.per_link.map(l => [l.short_code, l.clicks])).toEqual([['abc', 2], ['def', 1], ['ghi', 0]])
    expect(data.per_variant).toEqual([{ variant_id: 'v1', impressions: 100, clicks: 7, link_clicks: 2 }])
    // uma query de contagem por link vivo, com count exato e head
    const counts = sb.on('link_clicks')
    expect(counts).toHaveLength(2)
    expect(counts.every(q => q.head && q.count === 'exact')).toBe(true)
  })

  it('teste ativo: a janela vai até agora (inclui o clique recente)', async () => {
    const started = new Date(Date.now() - 5 * DAY).toISOString()
    const w = world({ started_at: started, completed_at: null })
    w.tables.link_clicks = [
      { id: 'n1', site_id: SITE, link_id: 'l1', is_bot: false, clicked_at: new Date(Date.now() - 1 * DAY).toISOString() },
      { id: 'n2', site_id: SITE, link_id: 'l1', is_bot: false, clicked_at: new Date(Date.now() - 9 * DAY).toISOString() },
    ]
    sb = fakePostgrest(w)
    const { data } = await getAbTestFunnel(ctx(), 't1')
    expect(data.per_link.find(l => l.short_code === 'abc')?.clicks).toBe(1)
    expect(data.link_clicks_window?.from).toBe(started)
  })

  it('teste que nunca começou: sem janela e sem consulta de cliques', async () => {
    sb = fakePostgrest(world({ started_at: null, completed_at: null }))
    const { data } = await getAbTestFunnel(ctx(), 't1')
    expect(data.link_clicks_window).toBeNull()
    expect(data.per_link.every(l => l.clicks === 0)).toBe(true)
    expect(sb.on('link_clicks')).toHaveLength(0)
  })

  it('erro ao contar cliques é erro, não zero', async () => {
    const w = world({ started_at: START, completed_at: END })
    w.fail = q => (q.table === 'link_clicks' ? { code: '57014', message: 'timeout' } : null)
    sb = fakePostgrest(w)
    await expect(getAbTestFunnel(ctx(), 't1')).rejects.toMatchObject({ code: 'DB_ERROR' })
  })
})

describe('busca de blog: uma linha por post, ordem estável', () => {
  it('post com duas traduções que casam aparece uma vez, na ordem de post_id; tradução escolhida de forma determinística', async () => {
    sb = fakePostgrest({
      tables: {
        content_pipeline: [],
        newsletter_editions: [],
        blog_translations: [
          { post_id: 'p2', title: 'Roma B', slug: 'roma-b', locale: 'pt-br', blog_posts: { status: 'published', category: 'viagem', site_id: SITE } },
          { post_id: 'p1', title: 'Roma EN', slug: 'roma-en', locale: 'en', blog_posts: { status: 'published', category: 'viagem', site_id: SITE } },
          { post_id: 'p1', title: 'Roma PT', slug: 'roma-pt', locale: 'pt-br', blog_posts: { status: 'published', category: 'viagem', site_id: SITE } },
        ],
        blog_posts: [
          { id: 'p9', site_id: SITE, status: 'published', category: 'viagem', locale: 'xx', blog_translations: [{ title: 'Z', slug: 'z', locale: 'pt-br' }, { title: 'A', slug: 'a', locale: 'en' }] },
          { id: 'p8', site_id: SITE, status: 'published', category: 'viagem', locale: 'pt-br', blog_translations: [{ title: 'P', slug: 'p', locale: 'pt-br' }] },
        ],
      },
      columns: {
        content_pipeline: ['id', 'code', 'title_pt', 'title_en', 'format', 'stage', 'priority', 'tags', 'updated_at', 'site_id', 'search_vector', 'is_archived'],
        newsletter_editions: ['id', 'subject', 'status', 'site_id'],
        blog_translations: ['post_id', 'title', 'slug', 'locale'],
        blog_posts: ['id', 'site_id', 'status', 'category', 'locale'],
      },
    })
    const { data } = await searchContent(ctx(), 'roma')
    expect(data.blog_posts.map(b => `${b.id}:${b.locale}`)).toEqual(['p1:en', 'p2:pt-br'])
    const topic = await getTopicAggregation(ctx(), 'viagem')
    expect(topic.data.blog_posts.map(b => `${b.id}:${b.slug}`)).toEqual(['p8:p', 'p9:a'])
  })
})

describe('audio/stats: paginação', () => {
  it('servidor que corta abaixo da página pedida (max_rows 300): lê tudo, para só em página vazia', async () => {
    sb = fakePostgrest({
      tables: {
        sites: [{ id: SITE }],
        audio_assets: [{ id: 'a', site_id: SITE, category: 'music', mood: ['calm'], energy: 1, status: 'downloaded' }],
        audio_asset_usage: Array.from({ length: 1234 }, (_, i) => ({ id: `u${String(i).padStart(5, '0')}`, site_id: SITE, audio_asset_id: 'a' })),
      },
      columns: { audio_assets: ['id', 'site_id', 'category', 'mood', 'energy', 'status'], audio_asset_usage: ['id', 'site_id', 'audio_asset_id'] },
      maxRows: 300,
    })
    pair = await createTestMcpPair({ setupServer: x => registerResources(x) })
    const res = await pair.client.readResource({ uri: 'pipeline://audio/stats' })
    const body = JSON.parse((res.contents[0] as { text: string }).text) as { totalUsages: number }
    expect(body.totalUsages).toBe(1234)
  })
})

describe('research: central derruba, secundário degrada', () => {
  const world = (): FakePostgrestOptions => ({
    tables: {
      sites: [{ id: SITE }],
      research_items: [{ id: 'r1', site_id: SITE, status: 'fresca', theme_id: 'ia', pinned: false, topic_id: 't1' }],
      research_focos: [],
      research_decisions: [],
      research_topics: [{ id: 't1', site_id: SITE, name: 'IA', slug: 'ia', path: 'ia', parent_id: null }, { id: 't2', site_id: OTHER, name: 'Alheio', slug: 'x', path: 'x', parent_id: null }],
      reference_content: [],
    },
    columns: {
      research_items: ['id', 'site_id', 'status', 'theme_id', 'pinned', 'topic_id'],
      research_focos: ['site_id', 'title', 'window_label', 'horizon', 'active', 'state'],
      research_decisions: ['site_id', 'title', 'horizon', 'status', 'revisit'],
      research_topics: ['id', 'site_id', 'name', 'slug', 'path', 'parent_id'],
      reference_content: ['site_id', 'key', 'title', 'content_md', 'content_compact', 'ref_group', 'sort_order', 'version', 'updated_at'],
    },
  })

  it('triage_fresh_research: foco com erro vira linha "unavailable" + Sentry', async () => {
    const o = world(); o.fail = q => (q.table === 'research_focos' ? { code: '57014', message: 'timeout' } : null)
    const text = await prompt('triage_fresh_research', {}, o)
    expect(text).toContain('Foco ativo: unavailable: active foco (timeout)')
    expect(text).toContain('Research: 1 itens')
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })

  it('review_research_for_decisions: decisões com erro viram linha "unavailable", não "0 decisões"', async () => {
    const o = world(); o.fail = q => (q.table === 'research_decisions' ? { code: '57014', message: 'timeout' } : null)
    const text = await prompt('review_research_for_decisions', {}, o)
    expect(text).toContain('Decisões abertas: unavailable: open decisions (timeout)')
    expect(text).not.toContain('Decisões abertas: 0')
  })

  it('itens do snapshot são centrais: erro derruba o prompt', async () => {
    const o = world(); o.fail = q => (q.table === 'research_items' ? { code: '57014', message: 'timeout' } : null)
    await expect(prompt('triage_fresh_research', {}, o)).rejects.toThrow()
  })

  it('research/topics: contagem com erro → itemCount null + itemCountsUnavailable; tópicos com erro derrubam; só tópicos do site', async () => {
    const o = world(); o.fail = q => (q.table === 'research_items' ? { code: '57014', message: 'timeout' } : null)
    const body = await readJson('pipeline://research/topics', o) as { topics: Array<{ id: string; itemCount: number | null }>; itemCountsUnavailable?: string }
    expect(body.topics.map(t => t.id)).toEqual(['t1'])
    expect(body.topics[0]!.itemCount).toBeNull()
    expect(body.itemCountsUnavailable).toContain('unavailable: item counts per topic (timeout)')
    expect(Sentry.captureMessage).toHaveBeenCalled()

    const ok = await readJson('pipeline://research/topics', world()) as { topics: Array<{ itemCount: number }> }
    expect(ok.topics[0]!.itemCount).toBe(1)

    const t = world(); t.fail = q => (q.table === 'research_topics' ? { code: '57014', message: 'timeout' } : null)
    await expect(readResource('pipeline://research/topics', t)).rejects.toThrow()
  })
})
