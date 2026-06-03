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

// ---------------------------------------------------------------------------
// Mock Supabase — all DB calls in prompts.ts go through service client
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
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

    // Override single() for channel info
    mockSupabase.single = vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: {
          channel_name: 'TestChannel',
          subscriber_count: 5000,
          tier: 'micro',
          generated_at: new Date().toISOString(),
        },
        error: null,
      }),
    )

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
})

// ---------------------------------------------------------------------------
// competitor-report prompt
// ---------------------------------------------------------------------------

describe('competitor-report prompt', () => {
  let pair: McpTestPair

  beforeEach(async () => {
    mockSupabase = buildMockSupabase()

    // Override single() for channel info
    mockSupabase.single = vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: {
          channel_name: 'MyChannel',
          subscriber_count: 12000,
          tier: 'micro',
        },
        error: null,
      }),
    )

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
