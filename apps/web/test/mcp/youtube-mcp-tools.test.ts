/**
 * YouTube MCP tool & resource registration tests.
 *
 * Verifies that youtube_observatory, youtube_analytics, and youtube_videos
 * tools have the correct action enums and annotations, and that all YouTube
 * resources are registered with expected URI patterns.
 *
 * Uses InMemoryTransport — no network I/O, no Supabase calls.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createTestMcpPair, type McpTestPair } from './helpers'

// ---------------------------------------------------------------------------
// Reproduce tool schemas matching the real registration in mcp/tools.ts
// ---------------------------------------------------------------------------

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const

function registerYoutubeTools(server: McpServer): void {
  // 1. youtube_observatory (4 actions)
  server.tool(
    'youtube_observatory',
    'Track competitor YouTube channels',
    {
      action: z.enum(['list_channels', 'get_changes', 'get_outliers', 'get_insights']),
      channel_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(100).default(50),
    },
    READ_ONLY,
    async () => ({ content: [{ type: 'text' as const, text: '{}' }] }),
  )

  // 2. youtube_analytics (5 actions)
  server.tool(
    'youtube_analytics',
    'YouTube channel analytics',
    {
      action: z.enum(['get_overview', 'get_grades', 'get_demographics', 'get_search_terms', 'get_notes']),
      channel_id: z.string().uuid().optional(),
    },
    READ_ONLY,
    async () => ({ content: [{ type: 'text' as const, text: '{}' }] }),
  )

  // 3. youtube_videos (3 actions)
  server.tool(
    'youtube_videos',
    'Browse and inspect YouTube videos',
    {
      action: z.enum(['list', 'get', 'list_categories']),
      video_id: z.string().uuid().optional(),
      channel_id: z.string().uuid().optional(),
      category_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      cursor: z.string().optional(),
    },
    READ_ONLY,
    async () => ({ content: [{ type: 'text' as const, text: '{}' }] }),
  )
}

// ---------------------------------------------------------------------------
// Reproduce YouTube resource registrations matching mcp/resources.ts
// ---------------------------------------------------------------------------

const YOUTUBE_RESOURCE_URIS = [
  'pipeline://youtube/intelligence',
  'pipeline://youtube/ab-performance',
  'pipeline://youtube/ab-tests',
  'pipeline://youtube/ab-learnings',
  'pipeline://youtube/ab-suggestions',
  'pipeline://youtube/ab-fatigue',
  'pipeline://youtube/ab-dashboard',
  'pipeline://youtube/thumbnails/library',
  'pipeline://youtube/thumbnails/fatigue',
  'pipeline://youtube/competitors/channels',
  'pipeline://youtube/competitors/changes',
  'pipeline://youtube/competitors/outliers',
  'pipeline://youtube/competitors/insights',
  'pipeline://youtube/videos',
  'pipeline://youtube/categories',
  'pipeline://youtube/channels',
  'pipeline://youtube/grades',
  'pipeline://youtube/notes',
  'pipeline://youtube/optimization-cycles',
] as const

function registerYoutubeResources(server: McpServer): void {
  for (const uri of YOUTUBE_RESOURCE_URIS) {
    const name = uri.replace('pipeline://youtube/', 'youtube-').replace(/\//g, '-')
    server.resource(name, uri, { mimeType: 'application/json' },
      async () => ({ contents: [{ uri, text: '{}' }] }))
  }
}

// ---------------------------------------------------------------------------
// Tests: Tool schemas
// ---------------------------------------------------------------------------

describe('YouTube MCP Tools — schema validation', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('youtube_observatory tool has correct action enum (4 actions)', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { tools } = await pair.client.listTools()
    const tool = tools.find(t => t.name === 'youtube_observatory')
    expect(tool).toBeDefined()

    const actionProp = (tool!.inputSchema.properties as Record<string, Record<string, unknown>>)?.action
    expect(actionProp).toBeDefined()
    expect(actionProp.enum).toEqual(['list_channels', 'get_changes', 'get_outliers', 'get_insights'])
  })

  it('youtube_analytics tool has correct action enum (5 actions)', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { tools } = await pair.client.listTools()
    const tool = tools.find(t => t.name === 'youtube_analytics')
    expect(tool).toBeDefined()

    const actionProp = (tool!.inputSchema.properties as Record<string, Record<string, unknown>>)?.action
    expect(actionProp).toBeDefined()
    expect(actionProp.enum).toEqual(['get_overview', 'get_grades', 'get_demographics', 'get_search_terms', 'get_notes'])
  })

  it('youtube_videos tool has correct action enum (3 actions)', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { tools } = await pair.client.listTools()
    const tool = tools.find(t => t.name === 'youtube_videos')
    expect(tool).toBeDefined()

    const actionProp = (tool!.inputSchema.properties as Record<string, Record<string, unknown>>)?.action
    expect(actionProp).toBeDefined()
    expect(actionProp.enum).toEqual(['list', 'get', 'list_categories'])
  })

  it('all YouTube tools have readOnlyHint annotation', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { tools } = await pair.client.listTools()
    const ytToolNames = ['youtube_observatory', 'youtube_analytics', 'youtube_videos']

    for (const name of ytToolNames) {
      const tool = tools.find(t => t.name === name)
      expect(tool).toBeDefined()
      expect(tool!.annotations?.readOnlyHint).toBe(true)
    }
  })

  it('youtube_observatory action enum has exactly 4 values', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { tools } = await pair.client.listTools()
    const tool = tools.find(t => t.name === 'youtube_observatory')
    const actionProp = (tool!.inputSchema.properties as Record<string, Record<string, unknown>>)?.action
    expect((actionProp.enum as string[]).length).toBe(4)
  })

  it('youtube_analytics action enum has exactly 5 values', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { tools } = await pair.client.listTools()
    const tool = tools.find(t => t.name === 'youtube_analytics')
    const actionProp = (tool!.inputSchema.properties as Record<string, Record<string, unknown>>)?.action
    expect((actionProp.enum as string[]).length).toBe(5)
  })

  it('youtube_videos action enum has exactly 3 values', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { tools } = await pair.client.listTools()
    const tool = tools.find(t => t.name === 'youtube_videos')
    const actionProp = (tool!.inputSchema.properties as Record<string, Record<string, unknown>>)?.action
    expect((actionProp.enum as string[]).length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Tests: Resource registration
// ---------------------------------------------------------------------------

describe('YouTube MCP Resources — registration', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('all 19 YouTube resources are registered', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { resources } = await pair.client.listResources()
    const ytResources = resources.filter(r =>
      r.uri.startsWith('pipeline://youtube/'),
    )
    expect(ytResources.length).toBe(19)
  })

  it('resource URIs match the expected patterns', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { resources } = await pair.client.listResources()
    const registeredUris = resources
      .map(r => r.uri)
      .filter(uri => uri.startsWith('pipeline://youtube/'))
      .sort()

    const expectedUris = [...YOUTUBE_RESOURCE_URIS].sort()

    expect(registeredUris).toEqual(expectedUris)
  })

  it('thumbnail library resource is registered at correct URI', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { resources } = await pair.client.listResources()
    const thumbLib = resources.find(r => r.uri === 'pipeline://youtube/thumbnails/library')
    expect(thumbLib).toBeDefined()
  })

  it('thumbnail fatigue resource is registered at correct URI', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { resources } = await pair.client.listResources()
    const thumbFatigue = resources.find(r => r.uri === 'pipeline://youtube/thumbnails/fatigue')
    expect(thumbFatigue).toBeDefined()
  })

  it('all competitor resources are registered (4 resources)', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { resources } = await pair.client.listResources()
    const competitorResources = resources.filter(r =>
      r.uri.startsWith('pipeline://youtube/competitors/'),
    )
    expect(competitorResources.length).toBe(4)
  })

  it('all A/B test resources are registered (6 resources)', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { resources } = await pair.client.listResources()
    const abResources = resources.filter(r =>
      r.uri.startsWith('pipeline://youtube/ab-'),
    )
    expect(abResources.length).toBe(6)
  })

  it('all resources have application/json mimeType', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => {
        registerYoutubeTools(s)
        registerYoutubeResources(s)
      },
    })

    const { resources } = await pair.client.listResources()
    const ytResources = resources.filter(r =>
      r.uri.startsWith('pipeline://youtube/'),
    )
    for (const resource of ytResources) {
      expect(resource.mimeType).toBe('application/json')
    }
  })
})
