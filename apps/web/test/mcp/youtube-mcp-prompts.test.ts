/**
 * MCP Prompt tests — youtube-analyst and competitor-report prompts.
 *
 * These tests verify the prompt structure, required arguments, and
 * generated message content without hitting Supabase (all DB calls mocked).
 *
 * We mock all transitive dependencies to isolate the prompt logic.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import {
  createTestMcpPair,
  type McpTestPair,
} from './helpers'
import { fakePostgrest, type FakePostgrestOptions } from '../helpers/fake-postgrest'
import { buildAbBriefingPrompt, buildAbReviewPrompt, buildAbWritePrompt } from '@/lib/youtube/prompt-builders-ab'

// ---------------------------------------------------------------------------
// Mock Supabase — all DB calls in prompts.ts go through service client
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/service', () => ({
  // `fake` (um PostgREST em memória que filtra de verdade) vale quando o teste o instala;
  // senão, o encadeável que responde a mesma coisa para tudo.
  getSupabaseServiceClient: () => fake?.client ?? mockSupabase,
}))

// ---------------------------------------------------------------------------
// Mock transitive dependencies imported by prompts.ts
// ---------------------------------------------------------------------------

vi.mock('@/lib/pipeline/prompt-builders', () => ({
  buildPrompt: vi.fn().mockReturnValue('mock-build-prompt-text'),
  generatePrompt: vi.fn().mockReturnValue({ text: 'mock-generate-prompt-text' }),
  summarizeContent: vi.fn().mockReturnValue('(summary)'),
}))

vi.mock('@/lib/pipeline/workflows', () => ({
  WORKFLOWS: { video: [{ stage: 'idea', label_pt: 'Ideia' }] },
  DEFAULT_CHECKLISTS: { video: [] },
}))

vi.mock('@/lib/pipeline/sections', () => ({
  SECTION_DEFINITIONS: { video: [] },
  getSectionKey: vi.fn().mockReturnValue('ideia_pt'),
}))

vi.mock('@/lib/youtube/prompt-builders-ab', () => ({
  buildAbBriefingPrompt: vi.fn().mockReturnValue('mock-ab-briefing'),
  buildAbWritePrompt: vi.fn().mockReturnValue('mock-ab-write'),
  buildAbReviewPrompt: vi.fn().mockReturnValue('mock-ab-review'),
}))

vi.mock('@/lib/playlists/prompt-builder', () => ({
  buildPlaylistPrompt: vi.fn().mockReturnValue({ text: 'mock-playlist-prompt' }),
}))

// ---------------------------------------------------------------------------
// Mock fs for fetchDomainDocs
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('# Mock YouTube docs\n\nSome documentation content.'),
}))

// ---------------------------------------------------------------------------
// Chainable Supabase mock
// ---------------------------------------------------------------------------

function buildMockSupabase() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of [
    'from', 'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'is', 'in', 'or', 'not', 'gt', 'gte', 'lt', 'lte',
    'ilike', 'like', 'order', 'limit', 'range', 'contains', 'containedBy',
    'textSearch', 'filter', 'match',
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.then = vi.fn((resolve: (v: unknown) => unknown) =>
    resolve({ data: [], error: null, count: null }),
  )
  return chain
}

let mockSupabase = buildMockSupabase()
let fake: ReturnType<typeof fakePostgrest> | null = null

// ---------------------------------------------------------------------------
// Import the real registerPrompts (after mocks are set up)
// ---------------------------------------------------------------------------

import { registerPrompts } from '../../src/lib/pipeline/mcp/prompts'

// ---------------------------------------------------------------------------
// Helper: extract prompt message text
// ---------------------------------------------------------------------------

function extractPromptText(result: {
  messages: Array<{ role: string; content: { type: string; text: string } }>
}): string {
  return result.messages[0]?.content?.text ?? ''
}

// ---------------------------------------------------------------------------
// youtube-analyst prompt
// ---------------------------------------------------------------------------

describe('youtube-analyst prompt', () => {
  let pair: McpTestPair

  beforeEach(async () => {
    mockSupabase = buildMockSupabase()

    // One row answers every single-object read: the site lookup (`id`), the channel read
    // (`name`, `subscriber_count` — the columns the table really has; the tier is computed,
    // 5000 subscribers = micro) and the snapshot-age read (`generated_at`).
    const row = () =>
      Promise.resolve({
        data: {
          id: 'site-1',
          name: 'TestChannel',
          subscriber_count: 5000,
          generated_at: new Date().toISOString(),
        },
        error: null,
      })
    mockSupabase.single = vi.fn().mockImplementation(row)
    mockSupabase.maybeSingle = vi.fn().mockImplementation(row)

    pair = await createTestMcpPair({
      setupServer: (server) => registerPrompts(server),
    })
  })

  afterEach(async () => {
    await pair.cleanup()
    vi.restoreAllMocks()
  })

  it('is listed in available prompts', async () => {
    const { prompts } = await pair.client.listPrompts()
    const names = prompts.map((p) => p.name)
    expect(names).toContain('youtube-analyst')
  })

  it('requires channel_id argument', async () => {
    const { prompts } = await pair.client.listPrompts()
    const prompt = prompts.find((p) => p.name === 'youtube-analyst')
    expect(prompt).toBeDefined()

    // The prompt defines channel_id as required (non-optional z.string())
    const args = prompt!.arguments ?? []
    const channelIdArg = args.find((a) => a.name === 'channel_id')
    expect(channelIdArg).toBeDefined()
    expect(channelIdArg!.required).toBe(true)
  })

  it('generated messages contain system instructions for health analysis', async () => {
    const result = await pair.client.getPrompt({
      name: 'youtube-analyst',
      arguments: { channel_id: 'test-channel-uuid' },
    })

    const text = extractPromptText(result)

    // Must contain health analysis instructions
    expect(text).toContain('YouTube Channel Analyst')
    expect(text).toContain('Channel Health')
    expect(text).toContain('Video Performance')
  })

  it('references submit_intelligence for structured output', async () => {
    const result = await pair.client.getPrompt({
      name: 'youtube-analyst',
      arguments: { channel_id: 'test-channel-uuid' },
    })

    const text = extractPromptText(result)
    expect(text).toContain('submit_intelligence')
  })

  it('includes all 6 scoring axis names', async () => {
    const result = await pair.client.getPrompt({
      name: 'youtube-analyst',
      arguments: { channel_id: 'test-channel-uuid' },
    })

    const text = extractPromptText(result)
    const axes = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']
    for (const axis of axes) {
      expect(text).toContain(axis)
    }
  })

  it('includes channel info from mock data', async () => {
    const result = await pair.client.getPrompt({
      name: 'youtube-analyst',
      arguments: { channel_id: 'test-channel-uuid' },
    })

    const text = extractPromptText(result)
    expect(text).toContain('TestChannel')
    expect(text).toContain('micro')
  })

  it('includes coaching data structure with priorities', async () => {
    const result = await pair.client.getPrompt({
      name: 'youtube-analyst',
      arguments: { channel_id: 'test-channel-uuid' },
    })

    const text = extractPromptText(result)
    expect(text).toContain('coaching')
    expect(text).toContain('priorities')
    expect(text).toContain('video_recommendations')
  })

  it('contains grading thresholds', async () => {
    const result = await pair.client.getPrompt({
      name: 'youtube-analyst',
      arguments: { channel_id: 'test-channel-uuid' },
    })

    const text = extractPromptText(result)
    expect(text).toMatch(/A\s*>=?\s*85/)
    expect(text).toMatch(/B\s*>=?\s*65/)
    expect(text).toMatch(/C\s*>=?\s*40/)
  })

  it('filters the snapshot-age query by source=cowork', async () => {
    await pair.client.getPrompt({
      name: 'youtube-analyst',
      arguments: { channel_id: 'test-channel-uuid' },
    })

    // fetchSnapshotAge must never let a forja row make the Cowork analysis
    // look fresh — it has to scope the query to source='cowork'.
    expect(mockSupabase.eq).toHaveBeenCalledWith('source', 'cowork')
  })
})

// ---------------------------------------------------------------------------
// competitor-report prompt
// ---------------------------------------------------------------------------

describe('competitor-report prompt', () => {
  let pair: McpTestPair

  beforeEach(async () => {
    mockSupabase = buildMockSupabase()

    // One row answers the site lookup (`id`) and the channel read (`name`, `subscriber_count`).
    const row = () =>
      Promise.resolve({
        data: {
          id: 'site-1',
          name: 'MyChannel',
          subscriber_count: 12000,
        },
        error: null,
      })
    mockSupabase.single = vi.fn().mockImplementation(row)
    mockSupabase.maybeSingle = vi.fn().mockImplementation(row)

    pair = await createTestMcpPair({
      setupServer: (server) => registerPrompts(server),
    })
  })

  afterEach(async () => {
    await pair.cleanup()
    vi.restoreAllMocks()
  })

  it('is listed in available prompts', async () => {
    const { prompts } = await pair.client.listPrompts()
    const names = prompts.map((p) => p.name)
    expect(names).toContain('competitor-report')
  })

  it('has no required arguments', async () => {
    const { prompts } = await pair.client.listPrompts()
    const prompt = prompts.find((p) => p.name === 'competitor-report')
    expect(prompt).toBeDefined()

    const args = prompt!.arguments ?? []
    const requiredArgs = args.filter((a) => a.required)
    expect(requiredArgs).toHaveLength(0)
  })

  it('can be invoked with empty arguments', async () => {
    const result = await pair.client.getPrompt({
      name: 'competitor-report',
      arguments: {},
    })

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].role).toBe('user')
  })

  it('generated messages contain competitor analysis instructions', async () => {
    const result = await pair.client.getPrompt({
      name: 'competitor-report',
      arguments: {},
    })

    const text = extractPromptText(result)
    expect(text).toContain('Competitor Landscape Report')
    expect(text).toContain('Competitor')
  })

  it('references play-of-week', async () => {
    const result = await pair.client.getPrompt({
      name: 'competitor-report',
      arguments: {},
    })

    const text = extractPromptText(result)
    expect(text).toContain('Play of the Week')
  })

  it('references gap analysis', async () => {
    const result = await pair.client.getPrompt({
      name: 'competitor-report',
      arguments: {},
    })

    const text = extractPromptText(result)
    expect(text).toContain('Gap Analysis')
    expect(text).toContain('weCover')
  })

  it('references timing recommendations', async () => {
    const result = await pair.client.getPrompt({
      name: 'competitor-report',
      arguments: {},
    })

    const text = extractPromptText(result)
    expect(text).toContain('Timing Recommendations')
    expect(text).toContain('heatmap')
  })

  it('includes channel info from mock data', async () => {
    const result = await pair.client.getPrompt({
      name: 'competitor-report',
      arguments: {},
    })

    const text = extractPromptText(result)
    expect(text).toContain('MyChannel')
    expect(text).toContain('12,000')
  })

  it('includes title patterns and engagement sections', async () => {
    const result = await pair.client.getPrompt({
      name: 'competitor-report',
      arguments: {},
    })

    const text = extractPromptText(result)
    expect(text).toContain('Title Patterns')
    expect(text).toContain('Engagement Comparison')
    expect(text).toContain('Upload Cadence')
    expect(text).toContain('Tag Intelligence')
  })

  it('instructs output in PT-BR', async () => {
    const result = await pair.client.getPrompt({
      name: 'competitor-report',
      arguments: {},
    })

    const text = extractPromptText(result)
    expect(text).toContain('PT-BR')
  })
})

// ---------------------------------------------------------------------------
// O canal que os prompts recebem (fetchChannelInfo)
//
// Banco em memória que filtra de verdade e recusa coluna inexistente (42703): o encadeável lá
// de cima devolvia `channel_name` e `tier` para qualquer consulta, e por isso o prompt lendo duas
// colunas que a tabela nunca teve passou verde desde sempre.
// ---------------------------------------------------------------------------

describe('o canal que os prompts recebem', () => {
  const SITE = 'site-ctx'
  const TEST_EN = '44444444-4444-4444-8444-444444444444'
  let pair: McpTestPair

  function chan(over: Record<string, unknown>) {
    return { id: 'ch', site_id: SITE, name: 'Canal', subscriber_count: 0, created_at: '2026-01-01T00:00:00Z', ...over }
  }
  /** Dois canais no site do contexto (PT cadastrado antes, EN depois) e um canal mais antigo de OUTRO site. */
  function world(over: Partial<FakePostgrestOptions['tables']> = {}): FakePostgrestOptions {
    return {
      tables: {
        sites: [{ id: SITE }],
        youtube_channels: [
          chan({ id: 'ch-alheio', site_id: 'site-outro', name: 'Alheio', subscriber_count: 5_000_000, created_at: '2019-01-01T00:00:00Z' }),
          chan({ id: 'ch-en', name: 'Thiago EN', subscriber_count: 250_000, created_at: '2026-02-01T00:00:00Z' }),
          chan({ id: 'ch-pt', name: 'tnFigueiredo', subscriber_count: 1160, created_at: '2025-01-01T00:00:00Z' }),
        ],
        youtube_videos: [
          { id: 'v-en', site_id: SITE, channel_id: 'ch-en' },
          { id: 'v-pt', site_id: SITE, channel_id: 'ch-pt' },
        ],
        ab_tests: [{ id: TEST_EN, site_id: SITE, youtube_video_id: 'v-en' }],
        ab_test_variants: [{ test_id: TEST_EN, label: 'B', title_text: 't', description_text: null, blob_url: null, metadata: {}, sort_order: 1 }],
        youtube_intelligence: [],
        ...over,
      } as FakePostgrestOptions['tables'],
      columns: {
        youtube_intelligence: ['generated_at', 'source'],
        youtube_channels: ['id', 'site_id', 'name', 'subscriber_count', 'created_at'],
        youtube_videos: ['id', 'site_id', 'channel_id'],
        ab_tests: ['id', 'site_id', 'youtube_video_id', 'test_type', 'status', 'winner_variant_id', 'completed_reason', 'completed_at'],
      },
    }
  }
  async function start(opts: FakePostgrestOptions) {
    fake = fakePostgrest(opts)
    pair = await createTestMcpPair({ setupServer: (server) => registerPrompts(server) })
  }

  // the `vi.restoreAllMocks()` of the suites above strips the builders' return values
  beforeEach(() => {
    vi.mocked(buildAbBriefingPrompt).mockReset().mockReturnValue('mock-ab-briefing')
    vi.mocked(buildAbReviewPrompt).mockReset().mockReturnValue('mock-ab-review')
  })
  afterEach(async () => {
    await pair.cleanup()
    fake = null
  })

  it('sem canal pedido (competitor-report): o primeiro canal do site na ordem de cadastro, com nome e inscritos reais', async () => {
    await start(world())
    const text = extractPromptText(await pair.client.getPrompt({ name: 'competitor-report', arguments: {} }))

    expect(text).toContain('Your channel: tnFigueiredo')
    expect(text).toContain((1160).toLocaleString())
    // 1160 inscritos → micro por getChannelTier; a coluna `tier` nunca existiu
    expect(text).toContain('Tier: micro')
    expect(text).not.toContain('Unknown')
    expect(text).not.toContain('Alheio')
  })

  it('nenhuma consulta a youtube_channels pede channel_name ou tier, e todas filtram por site', async () => {
    await start(world())
    await pair.client.getPrompt({ name: 'competitor-report', arguments: {} })
    await pair.client.getPrompt({ name: 'ab-review', arguments: { test_id: TEST_EN } })

    const reads = fake!.on('youtube_channels')
    expect(reads.length).toBeGreaterThan(0)
    for (const q of reads) {
      expect(q.select).not.toMatch(/channel_name|\btier\b/)
      expect(q.filters).toContainEqual({ op: 'eq', col: 'site_id', value: SITE })
    }
  })

  it('ab-ideate (sem vídeo em mãos): o briefing recebe o primeiro canal, com o tier calculado', async () => {
    await start(world())
    await pair.client.getPrompt({ name: 'ab-ideate', arguments: { test_type: 'title' } })

    expect(vi.mocked(buildAbBriefingPrompt).mock.calls[0]![0].data.channel).toEqual({ name: 'tnFigueiredo', subscribers: 1160, tier: 'micro' })
  })

  it('ab-review (com um teste em mãos): o canal é o do vídeo do teste, não o primeiro do site', async () => {
    await start(world())
    await pair.client.getPrompt({ name: 'ab-review', arguments: { test_id: TEST_EN } })

    // v-en é do canal EN: 250 mil inscritos → medium
    expect(vi.mocked(buildAbReviewPrompt).mock.calls[0]![0].channel).toEqual({ tier: 'medium', subscribers: 250_000 })
  })

  it('youtube-analyst (com channel_id): o cabeçalho é do canal pedido', async () => {
    await start(world())
    const text = extractPromptText(await pair.client.getPrompt({ name: 'youtube-analyst', arguments: { channel_id: 'ch-en' } }))
    expect(text).toContain('Channel: Thiago EN')
    expect(text).toContain('Tier: medium')
  })

  it('youtube-analyst com channel_id de outro site: nunca mostra o canal alheio', async () => {
    await start(world())
    const text = extractPromptText(await pair.client.getPrompt({ name: 'youtube-analyst', arguments: { channel_id: 'ch-alheio' } }))
    expect(text).not.toContain('Alheio')
    expect(text).toContain('Channel: Unknown')
  })

  it('site sem canal → o fallback de hoje: Unknown, 0 inscritos, nano', async () => {
    await start(world({ youtube_channels: [chan({ id: 'ch-alheio', site_id: 'site-outro', name: 'Alheio', subscriber_count: 5_000_000 })] }))
    const text = extractPromptText(await pair.client.getPrompt({ name: 'competitor-report', arguments: {} }))
    expect(text).toContain('Your channel: Unknown | 0 subscribers | Tier: nano')
  })

  it('nenhum site → o mesmo fallback, sem ler canal nenhum', async () => {
    await start(world({ sites: [] }))
    const text = extractPromptText(await pair.client.getPrompt({ name: 'competitor-report', arguments: {} }))
    expect(text).toContain('Your channel: Unknown | 0 subscribers | Tier: nano')
    expect(fake!.on('youtube_channels')).toHaveLength(0)
  })

  it('canal com subscriber_count nulo → 0 inscritos e nano, sem NaN', async () => {
    await start(world({ youtube_channels: [chan({ id: 'ch-pt', name: 'tnFigueiredo', subscriber_count: null })] }))
    const text = extractPromptText(await pair.client.getPrompt({ name: 'competitor-report', arguments: {} }))
    expect(text).toContain('Your channel: tnFigueiredo | 0 subscribers | Tier: nano')
  })
})

// ---------------------------------------------------------------------------
// R93 — ab-write / ab-ideate liam `youtube_ab_tests` (a tabela é `ab_tests`), `ctr_percent` (a
// coluna é `ctr`) e buscavam o vídeo pela coluna de texto com um uuid; fetchSnapshotAge não
// filtrava por site nem por canal. Todas as tabelas declaram `columns` (tabela vazia também
// recusa coluna inexistente).
// ---------------------------------------------------------------------------

describe('R93 — prompts de A/B contra o esquema real', () => {
  const SITE = 'site-ctx'
  const T_EN = '55555555-5555-4555-8555-555555555555'
  const T_ALHEIO = '66666666-6666-4666-8666-666666666666'
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
  let pair: McpTestPair

  const test_ = (id: string, over: Record<string, unknown>) => ({
    id, site_id: SITE, youtube_video_id: 'v-en', test_type: 'thumbnail', status: 'active', winner_variant_id: null,
    completed_reason: null, completed_at: null, original_title: 'orig', original_thumbnail_url: null, original_description: null,
    created_at: '2026-09-01T00:00:00Z', ...over,
  })

  function world(over: Partial<FakePostgrestOptions['tables']> = {}): FakePostgrestOptions {
    return {
      tables: {
        sites: [{ id: SITE }],
        youtube_channels: [
          { id: 'ch-pt', site_id: SITE, name: 'tnFigueiredo', subscriber_count: 1160, created_at: '2025-01-01T00:00:00Z' },
          { id: 'ch-en', site_id: SITE, name: 'Thiago EN', subscriber_count: 250_000, created_at: '2026-02-01T00:00:00Z' },
        ],
        youtube_videos: [
          { id: 'v-en', site_id: SITE, channel_id: 'ch-en', youtube_video_id: 'YT-EN', title: 'Vídeo EN', thumbnail_url: 'http://t/en.jpg', ctr: 4.2, avg_view_percentage: 51 },
          { id: 'v-pt', site_id: SITE, channel_id: 'ch-pt', youtube_video_id: 'YT-PT', title: 'Vídeo PT', thumbnail_url: null, ctr: 1, avg_view_percentage: 10 },
        ],
        ab_tests: [
          test_(T_EN, {}),
          test_('done-1', { status: 'completed', test_type: 'title', winner_variant_id: 'w1', completed_reason: 'winner', completed_at: '2026-09-10T00:00:00Z' }),
          test_('done-alheio', { site_id: 'site-outro', status: 'completed', test_type: 'description', completed_at: '2026-09-11T00:00:00Z' }),
          test_(T_ALHEIO, { site_id: 'site-outro' }),
        ],
        youtube_intelligence: [
          { site_id: SITE, channel_id: 'ch-en', source: 'cowork', generated_at: hoursAgo(5) },
          { site_id: SITE, channel_id: 'ch-pt', source: 'cowork', generated_at: hoursAgo(100) },
          { site_id: 'site-outro', channel_id: 'ch-en', source: 'cowork', generated_at: hoursAgo(1) },
        ],
        ...over,
      } as FakePostgrestOptions['tables'],
      columns: {
        sites: ['id'],
        youtube_channels: ['id', 'site_id', 'name', 'subscriber_count', 'created_at'],
        youtube_videos: ['id', 'site_id', 'channel_id', 'youtube_video_id', 'title', 'thumbnail_url', 'ctr', 'avg_view_percentage'],
        ab_tests: ['id', 'site_id', 'youtube_video_id', 'test_type', 'status', 'winner_variant_id', 'completed_reason', 'completed_at', 'original_title', 'original_thumbnail_url', 'original_description', 'created_at'],
        youtube_intelligence: ['site_id', 'channel_id', 'source', 'generated_at'],
      },
    }
  }
  async function start(opts: FakePostgrestOptions) {
    fake = fakePostgrest(opts)
    pair = await createTestMcpPair({ setupServer: (server) => registerPrompts(server) })
  }
  beforeEach(() => {
    vi.mocked(buildAbBriefingPrompt).mockReset().mockReturnValue('mock-ab-briefing')
    vi.mocked(buildAbWritePrompt).mockReset().mockReturnValue('mock-ab-write')
  })
  afterEach(async () => {
    await pair.cleanup()
    fake = null
  })

  it('ab-write acha o teste em ab_tests, o vídeo pelo id, e passa ctr, canal do vídeo e idade do snapshot daquele canal', async () => {
    await start(world())
    await pair.client.getPrompt({ name: 'ab-write', arguments: { test_id: T_EN } })

    const data = vi.mocked(buildAbWritePrompt).mock.calls[0]![0].data
    expect(data.video).toMatchObject({ title: 'Vídeo EN', ctr: 4.2, avgViewPercentage: 51, thumbnailUrl: 'http://t/en.jpg' })
    expect(data.channel).toMatchObject({ name: 'Thiago EN', subscribers: 250_000 })
    expect(data.snapshotAgeHours).toBe(5)
    expect(data.testHistory).toEqual([{ test_type: 'title', winner_label: 'variant', ctr_lift_percent: null }])
  })

  it('ab-write: teste de outro site → "A/B test not found"', async () => {
    await start(world())
    await expect(pair.client.getPrompt({ name: 'ab-write', arguments: { test_id: T_ALHEIO } })).rejects.toThrow(/A\/B test not found/)
  })

  it('ab-ideate: o histórico vem de ab_tests, só do site e só dos concluídos', async () => {
    await start(world())
    await pair.client.getPrompt({ name: 'ab-ideate', arguments: { test_type: 'title' } })

    const data = vi.mocked(buildAbBriefingPrompt).mock.calls[0]![0].data
    expect(data.testHistory).toEqual([{ test_type: 'title', winner_label: 'variant', ctr_lift_percent: null }])
    for (const q of fake!.on('ab_tests')) expect(q.filters).toContainEqual({ op: 'eq', col: 'site_id', value: SITE })
    // sem vídeo em mãos: o primeiro canal (PT) e a idade do snapshot DELE, não a do canal EN nem a do outro site
    expect(data.snapshotAgeHours).toBe(100)
  })

  it('ab-ideate sem nenhuma análise do canal → 999 (nunca a idade de outro canal ou de outro site)', async () => {
    await start(world({ youtube_intelligence: [
      { site_id: SITE, channel_id: 'ch-en', source: 'cowork', generated_at: hoursAgo(5) },
      { site_id: 'site-outro', channel_id: 'ch-pt', source: 'cowork', generated_at: hoursAgo(1) },
    ] as never }))
    await pair.client.getPrompt({ name: 'ab-ideate', arguments: { test_type: 'title' } })
    expect(vi.mocked(buildAbBriefingPrompt).mock.calls[0]![0].data.snapshotAgeHours).toBe(999)
  })

  it('site sem canal → 999, sem ler youtube_intelligence', async () => {
    await start(world({ youtube_channels: [] }))
    await pair.client.getPrompt({ name: 'ab-ideate', arguments: { test_type: 'title' } })
    expect(vi.mocked(buildAbBriefingPrompt).mock.calls[0]![0].data.snapshotAgeHours).toBe(999)
    expect(fake!.on('youtube_intelligence')).toHaveLength(0)
  })

  it('youtube-analyst mostra a idade do snapshot do canal pedido', async () => {
    await start(world())
    const text = extractPromptText(await pair.client.getPrompt({ name: 'youtube-analyst', arguments: { channel_id: 'ch-en' } }))
    expect(text).toContain('Intelligence snapshot age: 5h')
  })
})
