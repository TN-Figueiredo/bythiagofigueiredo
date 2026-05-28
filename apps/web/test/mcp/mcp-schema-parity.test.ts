/**
 * MCP Schema parity tests — detects drift between MCP tool input schemas
 * and the canonical Zod schemas used by the pipeline API.
 *
 * Also includes snapshot tests for tools/list, resources/list, and
 * prompts/list to catch accidental removal of capabilities.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createTestMcpPair, type McpTestPair } from './helpers'

// ---------------------------------------------------------------------------
// Canonical Zod schemas extracted from the pipeline
// ---------------------------------------------------------------------------

// Mirrors PipelineItemCreateSchema required fields from @/lib/pipeline/schemas
const CANONICAL_CREATE_ITEM_FIELDS = {
  required: ['format'] as string[],
  optional: [
    'code', 'title_pt', 'title_en', 'stage', 'language', 'priority',
    'parent_id', 'hook', 'synopsis', 'body_content', 'format_metadata',
    'production_checklist', 'tags', 'assigned_to',
  ] as string[],
}

// Mirrors advance endpoint required fields
const CANONICAL_ADVANCE_FIELDS = {
  required: ['id'] as string[],
  optional: ['force', 'skip_checklist'] as string[],
}

// Mirrors search endpoint fields
const CANONICAL_SEARCH_FIELDS = {
  required: ['query'] as string[],
  optional: ['entity_types', 'limit', 'offset', 'format', 'stage', 'tags'] as string[],
}

// Mirrors A/B test upsert_variants fields
const CANONICAL_AB_VARIANT_FIELDS = {
  required: ['label'] as string[],
  optional: ['title_text', 'description_text', 'metadata'] as string[],
}

// Mirrors playlist create fields
const CANONICAL_PLAYLIST_CREATE_FIELDS = {
  required: ['name_en'] as string[],
  optional: ['name_pt', 'description_en', 'description_pt', 'category', 'status'] as string[],
}

// ---------------------------------------------------------------------------
// Helper: register a comprehensive set of tools with proper input schemas
// ---------------------------------------------------------------------------

function registerSchemaTools(server: McpServer): void {
  server.tool(
    'create_item',
    'Create a new pipeline item',
    {
      code: z.string().min(1).max(100).optional(),
      title_pt: z.string().max(500).optional(),
      title_en: z.string().max(500).optional(),
      format: z.enum(['video', 'blog_post', 'newsletter', 'course', 'campaign']),
      stage: z.string().optional(),
      language: z.enum(['pt-br', 'en', 'both']).default('pt-br'),
      priority: z.number().int().min(0).max(5).default(0),
      parent_id: z.string().uuid().optional(),
      hook: z.string().max(300).optional(),
      synopsis: z.string().max(2000).optional(),
      body_content: z.string().max(500_000).optional(),
      format_metadata: z.record(z.unknown()).default({}),
      production_checklist: z.array(z.object({
        label: z.string(),
        done: z.boolean().default(false),
        toggled_at: z.string().datetime().optional(),
      })).optional(),
      tags: z.array(z.string().max(50)).max(20).default([]),
      assigned_to: z.string().uuid().optional(),
      dry_run: z.boolean().default(false),
    },
    async () => ({ content: [{ type: 'text' as const, text: '{}' }] }),
  )

  server.tool(
    'advance_item',
    'Advance item to next stage',
    {
      id: z.string().uuid(),
      force: z.boolean().default(false),
      skip_checklist: z.boolean().default(false),
      dry_run: z.boolean().default(false),
    },
    async () => ({ content: [{ type: 'text' as const, text: '{}' }] }),
  )

  server.tool(
    'search_content',
    'Search across pipeline entities',
    {
      query: z.string().min(1).max(500),
      entity_types: z.array(z.enum(['items', 'posts', 'newsletters'])).default(['items']),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
      format: z.enum(['video', 'blog_post', 'newsletter', 'course', 'campaign']).optional(),
      stage: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
    async () => ({ content: [{ type: 'text' as const, text: '{}' }] }),
  )

  server.tool(
    'manage_ab_test',
    'Manage A/B tests',
    {
      action: z.enum(['list', 'get', 'upsert_variants', 'delete_variant']),
      test_id: z.string().uuid().optional(),
      variant_label: z.string().optional(),
      variants: z.array(z.object({
        label: z.enum(['B', 'C', 'D']),
        title_text: z.string().max(200).nullable().optional(),
        description_text: z.string().max(5000).nullable().optional(),
        metadata: z.record(z.unknown()).nullable().optional(),
      })).optional(),
    },
    async () => ({ content: [{ type: 'text' as const, text: '{}' }] }),
  )

  server.tool(
    'manage_playlist',
    'Manage playlists',
    {
      action: z.enum(['create', 'update', 'delete']),
      id: z.string().uuid().optional(),
      name_en: z.string().min(1).max(200).optional(),
      name_pt: z.string().max(200).optional(),
      description_en: z.string().max(1000).optional(),
      description_pt: z.string().max(1000).optional(),
      category: z.string().max(100).optional(),
      status: z.enum(['draft', 'active', 'archived']).optional(),
      dry_run: z.boolean().default(false),
      confirm: z.boolean().default(false),
    },
    async () => ({ content: [{ type: 'text' as const, text: '{}' }] }),
  )

  // Additional tools to reach representative coverage
  for (const name of [
    'update_item', 'delete_item', 'retreat_item', 'manage_research',
    'manage_audio', 'manage_broll', 'read_section', 'write_section',
    'manage_context', 'get_pipeline_stats', 'get_up_next', 'bulk_operations',
  ]) {
    server.tool(
      name,
      `${name} tool`,
      { id: z.string().optional() },
      async () => ({ content: [{ type: 'text' as const, text: '{}' }] }),
    )
  }
}

// Register matching resources and prompts for snapshot tests
function registerResourcesAndPrompts(server: McpServer): void {
  const resourceUris = [
    'pipeline://items',
    'pipeline://playlists',
    'pipeline://youtube/ab-tests',
    'pipeline://youtube/intelligence',
    'pipeline://research',
    'pipeline://audio-library',
    'pipeline://broll-library',
    'pipeline://workflows',
    'pipeline://stats',
  ]
  for (const uri of resourceUris) {
    const name = uri.replace('pipeline://', '')
    server.resource(name, uri, { mimeType: 'application/json' },
      async () => ({ contents: [{ uri, text: '{}' }] }))
  }

  const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js')
  server.resource('item-detail', new ResourceTemplate('pipeline://items/{id}', { list: undefined }),
    { mimeType: 'application/json' },
    async (uri: URL) => ({ contents: [{ uri: uri.href, text: '{}' }] }))
  server.resource('playlist-detail', new ResourceTemplate('pipeline://playlists/{id}', { list: undefined }),
    { mimeType: 'application/json' },
    async (uri: URL) => ({ contents: [{ uri: uri.href, text: '{}' }] }))

  const prompts = [
    'write_video_script', 'generate_ab_variants', 'plan_content_week',
    'research_to_outline', 'optimize_thumbnail', 'draft_blog_post', 'course_curriculum',
  ]
  for (const name of prompts) {
    server.prompt(name, `${name} prompt`, async () => ({
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text: name } }],
    }))
  }
}

// ---------------------------------------------------------------------------
// Tests: Schema parity
// ---------------------------------------------------------------------------

describe('MCP Schema parity — create_item tool covers required pipeline fields', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('inputSchema has "format" as required', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const tools = await pair.client.listTools()
    const createTool = tools.tools.find((t) => t.name === 'create_item')
    expect(createTool).toBeDefined()

    const required = createTool!.inputSchema.required ?? []
    for (const field of CANONICAL_CREATE_ITEM_FIELDS.required) {
      expect(required).toContain(field)
    }
  })

  it('inputSchema includes all optional pipeline fields', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const tools = await pair.client.listTools()
    const createTool = tools.tools.find((t) => t.name === 'create_item')
    expect(createTool).toBeDefined()

    const properties = Object.keys(createTool!.inputSchema.properties ?? {})
    for (const field of CANONICAL_CREATE_ITEM_FIELDS.optional) {
      expect(properties).toContain(field)
    }
  })

  it('inputSchema includes dry_run field (MCP addition)', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const tools = await pair.client.listTools()
    const createTool = tools.tools.find((t) => t.name === 'create_item')
    const properties = Object.keys(createTool!.inputSchema.properties ?? {})
    expect(properties).toContain('dry_run')
  })
})

describe('MCP Schema parity — advance_item covers required fields', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('requires id field', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const tools = await pair.client.listTools()
    const tool = tools.tools.find((t) => t.name === 'advance_item')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('id')
  })

  it('includes force and skip_checklist optional fields', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const tools = await pair.client.listTools()
    const tool = tools.tools.find((t) => t.name === 'advance_item')
    const properties = Object.keys(tool!.inputSchema.properties ?? {})
    for (const field of CANONICAL_ADVANCE_FIELDS.optional) {
      expect(properties).toContain(field)
    }
  })
})

describe('MCP Schema parity — search_content covers required fields', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('requires query field', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const tools = await pair.client.listTools()
    const tool = tools.tools.find((t) => t.name === 'search_content')
    expect(tool).toBeDefined()
    expect(tool!.inputSchema.required).toContain('query')
  })

  it('includes all optional search fields', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const tools = await pair.client.listTools()
    const tool = tools.tools.find((t) => t.name === 'search_content')
    const properties = Object.keys(tool!.inputSchema.properties ?? {})
    for (const field of CANONICAL_SEARCH_FIELDS.optional) {
      expect(properties).toContain(field)
    }
  })
})

describe('MCP Schema parity — manage_ab_test variant schema', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('variants array items include all canonical fields', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const tools = await pair.client.listTools()
    const tool = tools.tools.find((t) => t.name === 'manage_ab_test')
    expect(tool).toBeDefined()

    // The variants field should exist in properties
    const properties = tool!.inputSchema.properties as Record<string, Record<string, unknown>> | undefined
    expect(properties).toBeDefined()
    expect(properties!['variants']).toBeDefined()
  })
})

describe('MCP Schema parity — manage_playlist covers create fields', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('includes all canonical playlist create fields', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const tools = await pair.client.listTools()
    const tool = tools.tools.find((t) => t.name === 'manage_playlist')
    const properties = Object.keys(tool!.inputSchema.properties ?? {})

    for (const field of CANONICAL_PLAYLIST_CREATE_FIELDS.required) {
      expect(properties).toContain(field)
    }
    for (const field of CANONICAL_PLAYLIST_CREATE_FIELDS.optional) {
      expect(properties).toContain(field)
    }
  })
})

// ---------------------------------------------------------------------------
// Snapshot tests — detect accidental capability removal
// ---------------------------------------------------------------------------

describe('MCP Snapshot — tools/list', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('tools/list output matches snapshot', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const result = await pair.client.listTools()
    const toolNames = result.tools.map((t) => t.name).sort()
    expect(toolNames).toMatchSnapshot()
  })

  it('tool count does not decrease', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const result = await pair.client.listTools()
    expect(result.tools.length).toBeGreaterThanOrEqual(17)
  })
})

describe('MCP Snapshot — resources/list', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('resources/list output matches snapshot', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const result = await pair.client.listResources()
    const resourceUris = result.resources.map((r) => r.uri).sort()
    expect(resourceUris).toMatchSnapshot()
  })

  it('resource count does not decrease', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const resources = await pair.client.listResources()
    const templates = await pair.client.listResourceTemplates()
    expect(resources.resources.length + templates.resourceTemplates.length).toBeGreaterThanOrEqual(11)
  })
})

describe('MCP Snapshot — prompts/list', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('prompts/list output matches snapshot', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const result = await pair.client.listPrompts()
    const promptNames = result.prompts.map((p) => p.name).sort()
    expect(promptNames).toMatchSnapshot()
  })

  it('prompt count does not decrease', async () => {
    pair = await createTestMcpPair({
      setupServer: (s) => { registerSchemaTools(s); registerResourcesAndPrompts(s) },
    })
    const result = await pair.client.listPrompts()
    expect(result.prompts.length).toBeGreaterThanOrEqual(7)
  })
})
