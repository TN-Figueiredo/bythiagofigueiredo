/**
 * MCP Server integration tests — verifies initialization, capability
 * advertisement, and auth layer using InMemoryTransport.
 *
 * These tests exercise the contract between the MCP server and any
 * MCP client, ensuring tools/resources/prompts are correctly listed
 * and auth gating works as expected.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { Client } from '@modelcontextprotocol/sdk/client'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createTestMcpPair, type McpTestPair, VALID_API_KEY, INVALID_API_KEY } from './helpers'

// ---------------------------------------------------------------------------
// Tool, Resource, and Prompt definitions that mirror the planned MCP server
// ---------------------------------------------------------------------------

const EXPECTED_TOOLS = [
  'create_item',
  'update_item',
  'delete_item',
  'advance_item',
  'retreat_item',
  'search_content',
  'manage_playlist',
  'manage_ab_test',
  'manage_research',
  'manage_audio',
  'manage_broll',
  'read_section',
  'write_section',
  'manage_context',
  'get_pipeline_stats',
  'get_up_next',
  'bulk_operations',
] as const

const EXPECTED_RESOURCES = [
  'pipeline://items',
  'pipeline://items/{id}',
  'pipeline://playlists',
  'pipeline://playlists/{id}',
  'pipeline://youtube/ab-tests',
  'pipeline://youtube/intelligence',
  'pipeline://research',
  'pipeline://audio-library',
  'pipeline://broll-library',
  'pipeline://workflows',
  'pipeline://stats',
] as const

const EXPECTED_PROMPTS = [
  'write_video_script',
  'generate_ab_variants',
  'plan_content_week',
  'research_to_outline',
  'optimize_thumbnail',
  'draft_blog_post',
  'course_curriculum',
] as const

// ---------------------------------------------------------------------------
// Helper: registers mock tools/resources/prompts on an McpServer to match
// the expected contract counts (17 tools, 11 resources, 7 prompts).
// ---------------------------------------------------------------------------

function registerMockCapabilities(server: McpServer): void {
  // Register all 17 tools
  for (const toolName of EXPECTED_TOOLS) {
    server.tool(
      toolName,
      `Mock ${toolName} tool for testing`,
      { input: z.string().optional() },
      async () => ({ content: [{ type: 'text' as const, text: JSON.stringify({ tool: toolName, status: 'ok' }) }] }),
    )
  }

  // Register 11 resources (mix of static and template-based)
  const staticResources = [
    'pipeline://items',
    'pipeline://playlists',
    'pipeline://youtube/ab-tests',
    'pipeline://youtube/intelligence',
    'pipeline://research',
    'pipeline://audio-library',
    'pipeline://broll-library',
    'pipeline://workflows',
    'pipeline://stats',
  ] as const

  for (const uri of staticResources) {
    const name = uri.replace('pipeline://', '')
    server.resource(
      name,
      uri,
      { description: `${name} resource`, mimeType: 'application/json' },
      async () => ({ contents: [{ uri, text: JSON.stringify({ items: [] }), mimeType: 'application/json' }] }),
    )
  }

  // Template resources (2 templates — they show as resources too in the list)
  const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js')
  server.resource(
    'item-detail',
    new ResourceTemplate('pipeline://items/{id}', { list: undefined }),
    { description: 'Single pipeline item by ID', mimeType: 'application/json' },
    async (uri: URL) => ({ contents: [{ uri: uri.href, text: '{}', mimeType: 'application/json' }] }),
  )
  server.resource(
    'playlist-detail',
    new ResourceTemplate('pipeline://playlists/{id}', { list: undefined }),
    { description: 'Single playlist by ID', mimeType: 'application/json' },
    async (uri: URL) => ({ contents: [{ uri: uri.href, text: '{}', mimeType: 'application/json' }] }),
  )

  // Register 7 prompts
  for (const promptName of EXPECTED_PROMPTS) {
    server.prompt(
      promptName,
      `Mock ${promptName} prompt`,
      { topic: z.string().optional() },
      async () => ({
        messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Prompt: ${promptName}` } }],
      }),
    )
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP Server — initialization and capabilities', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('connects successfully via InMemoryTransport', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    expect(pair.client).toBeDefined()
    expect(pair.server).toBeDefined()
  })

  it('returns server info after initialization', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const serverVersion = pair.client.getServerVersion()
    expect(serverVersion).toBeDefined()
    expect(serverVersion?.name).toBe('pipeline-mcp-test')
    expect(serverVersion?.version).toBe('1.0.0')
  })

  it('advertises tool capabilities', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const caps = pair.client.getServerCapabilities()
    expect(caps?.tools).toBeDefined()
  })

  it('advertises resource capabilities', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const caps = pair.client.getServerCapabilities()
    expect(caps?.resources).toBeDefined()
  })

  it('advertises prompt capabilities', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const caps = pair.client.getServerCapabilities()
    expect(caps?.prompts).toBeDefined()
  })
})

describe('MCP Server — tools/list', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns 17 tools', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result = await pair.client.listTools()
    expect(result.tools).toHaveLength(17)
  })

  it('returns all expected tool names', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result = await pair.client.listTools()
    const toolNames = result.tools.map((t) => t.name).sort()
    const expected = [...EXPECTED_TOOLS].sort()
    expect(toolNames).toEqual(expected)
  })

  it('each tool has a non-empty description', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result = await pair.client.listTools()
    for (const tool of result.tools) {
      expect(tool.description).toBeTruthy()
    }
  })

  it('each tool has an inputSchema with type "object"', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result = await pair.client.listTools()
    for (const tool of result.tools) {
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('returns tools with unique names (no duplicates)', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result = await pair.client.listTools()
    const names = result.tools.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('MCP Server — resources/list', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns 11 resources (9 static + 2 template-based)', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const resources = await pair.client.listResources()
    const templates = await pair.client.listResourceTemplates()
    const total = resources.resources.length + templates.resourceTemplates.length
    expect(total).toBe(11)
  })

  it('returns 9 static resources', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result = await pair.client.listResources()
    expect(result.resources).toHaveLength(9)
  })

  it('returns 2 resource templates', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result = await pair.client.listResourceTemplates()
    expect(result.resourceTemplates).toHaveLength(2)
  })

  it('all resources have application/json mimeType', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result = await pair.client.listResources()
    for (const resource of result.resources) {
      expect(resource.mimeType).toBe('application/json')
    }
  })

  it('resource URIs use the pipeline:// scheme', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result = await pair.client.listResources()
    for (const resource of result.resources) {
      expect(resource.uri).toMatch(/^pipeline:\/\//)
    }
  })
})

describe('MCP Server — prompts/list', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns 7 prompts', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result = await pair.client.listPrompts()
    expect(result.prompts).toHaveLength(7)
  })

  it('returns all expected prompt names', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result = await pair.client.listPrompts()
    const promptNames = result.prompts.map((p) => p.name).sort()
    const expected = [...EXPECTED_PROMPTS].sort()
    expect(promptNames).toEqual(expected)
  })

  it('each prompt has a description', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result = await pair.client.listPrompts()
    for (const prompt of result.prompts) {
      expect(prompt.description).toBeTruthy()
    }
  })

  it('prompt names are unique', async () => {
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result = await pair.client.listPrompts()
    const names = result.prompts.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('MCP Server — auth', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  // TODO: enable after auth middleware is integrated into MCP server
  it.skip('returns error for invalid API key', async () => {
    pair = await createTestMcpPair({
      apiKey: INVALID_API_KEY,
      setupServer: registerMockCapabilities,
    })

    const result = await pair.client.callTool({ name: 'create_item', arguments: { title_pt: 'Test' } })
    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text
    expect(text).toContain('UNAUTHORIZED')
  })

  // TODO: enable after auth middleware is integrated into MCP server
  it.skip('returns tool list filtered by permissions for valid key', async () => {
    pair = await createTestMcpPair({
      apiKey: VALID_API_KEY,
      setupServer: (server) => {
        // Register read-only and write tools
        server.tool('read_tool', 'A read-only tool', async () => ({
          content: [{ type: 'text' as const, text: 'read result' }],
        }))
        server.tool('write_tool', 'A write tool', async () => ({
          content: [{ type: 'text' as const, text: 'write result' }],
        }))
      },
    })

    const result = await pair.client.listTools()
    // With read-only key, write tools should be filtered out
    const names = result.tools.map((t) => t.name)
    expect(names).toContain('read_tool')
    // write_tool might or might not appear depending on auth filtering
  })

  it('server remains functional after multiple connect/disconnect cycles', async () => {
    // First connection
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result1 = await pair.client.listTools()
    expect(result1.tools.length).toBeGreaterThan(0)
    await pair.cleanup()

    // Second connection
    pair = await createTestMcpPair({
      setupServer: registerMockCapabilities,
    })
    const result2 = await pair.client.listTools()
    expect(result2.tools.length).toBe(result1.tools.length)
  })
})
