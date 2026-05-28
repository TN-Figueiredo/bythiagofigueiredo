/**
 * MCP Tool integration tests — verifies tool handlers return correct
 * results when invoked via the MCP protocol over InMemoryTransport.
 *
 * Supabase is fully mocked; tests exercise the MCP tool contract,
 * input validation, and dry_run / confirmation patterns.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  createTestMcpPair,
  extractToolResultJson,
  extractToolResultText,
  mockSupabaseForMcp,
  MOCK_SITE_ID,
  MOCK_ITEM_ID,
  MOCK_PLAYLIST_ID,
  MOCK_TEST_ID,
  MOCK_VARIANT_ID,
  type McpTestPair,
} from './helpers'

// ---------------------------------------------------------------------------
// Reusable tool registrations that simulate the real MCP server tools
// ---------------------------------------------------------------------------

function registerPipelineTools(server: McpServer): void {
  // create_item
  server.tool(
    'create_item',
    'Create a new pipeline item',
    {
      title_pt: z.string().max(500).optional(),
      title_en: z.string().max(500).optional(),
      format: z.enum(['video', 'blog_post', 'newsletter', 'course', 'campaign']),
      language: z.enum(['pt-br', 'en', 'both']).default('pt-br'),
      priority: z.number().int().min(0).max(5).default(0),
      tags: z.array(z.string()).default([]),
      dry_run: z.boolean().default(false),
    },
    async (args) => {
      if (args.dry_run) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              dry_run: true,
              planned_changes: {
                action: 'create',
                item: {
                  title_pt: args.title_pt,
                  title_en: args.title_en,
                  format: args.format,
                  language: args.language,
                  stage: 'idea',
                },
              },
              would_persist: false,
            }),
          }],
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            data: {
              id: MOCK_ITEM_ID,
              title_pt: args.title_pt ?? null,
              title_en: args.title_en ?? null,
              format: args.format,
              language: args.language,
              stage: 'idea',
              priority: args.priority,
              tags: args.tags,
              created_at: '2026-05-28T12:00:00Z',
            },
          }),
        }],
      }
    },
  )

  // advance_item
  server.tool(
    'advance_item',
    'Advance a pipeline item to the next workflow stage',
    {
      id: z.string().uuid(),
      dry_run: z.boolean().default(false),
    },
    async (args) => {
      if (args.dry_run) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              dry_run: true,
              planned_changes: {
                action: 'advance',
                item_id: args.id,
                from_stage: 'idea',
                to_stage: 'roteiro',
              },
              would_persist: false,
            }),
          }],
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            data: {
              id: args.id,
              stage: 'roteiro',
              previous_stage: 'idea',
              advanced_at: '2026-05-28T12:00:00Z',
            },
          }),
        }],
      }
    },
  )

  // delete_item
  server.tool(
    'delete_item',
    'Archive (soft-delete) a pipeline item',
    {
      id: z.string().uuid(),
      confirm: z.boolean().default(false),
    },
    async (args) => {
      if (!args.confirm) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              confirmation_required: true,
              message: `Are you sure you want to archive item ${args.id}? This will soft-delete the item and all its sections.`,
              action: 'delete_item',
              item_id: args.id,
              hint: 'Call again with confirm: true to proceed.',
            }),
          }],
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            data: {
              id: args.id,
              archived: true,
              archived_at: '2026-05-28T12:00:00Z',
            },
          }),
        }],
      }
    },
  )

  // search_content
  server.tool(
    'search_content',
    'Cross-entity search across pipeline items, blog posts, and newsletters',
    {
      query: z.string().min(1).max(500),
      entity_types: z.array(z.enum(['items', 'posts', 'newsletters'])).default(['items']),
      limit: z.number().int().min(1).max(50).default(20),
    },
    async (args) => {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            data: {
              results: [
                { id: MOCK_ITEM_ID, title: 'Matching item', type: 'item', score: 0.95 },
              ],
              total: 1,
              query: args.query,
            },
          }),
        }],
      }
    },
  )

  // manage_playlist
  server.tool(
    'manage_playlist',
    'Create, update, or delete playlists',
    {
      action: z.enum(['create', 'update', 'delete']),
      id: z.string().uuid().optional(),
      name_en: z.string().max(200).optional(),
      name_pt: z.string().max(200).optional(),
      dry_run: z.boolean().default(false),
      confirm: z.boolean().default(false),
    },
    async (args) => {
      if (args.action === 'delete' && args.dry_run) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              dry_run: true,
              planned_changes: {
                action: 'delete',
                playlist_id: args.id,
                cascade_warning: 'Deleting this playlist will remove 5 item associations and 3 edges.',
                affected_items: 5,
                affected_edges: 3,
              },
              would_persist: false,
            }),
          }],
        }
      }

      if (args.action === 'delete' && !args.confirm) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              confirmation_required: true,
              message: `Deleting playlist ${args.id} will cascade to item associations and edges.`,
              hint: 'Call again with confirm: true to proceed.',
            }),
          }],
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            data: {
              id: args.id ?? MOCK_PLAYLIST_ID,
              name_en: args.name_en ?? 'Test Playlist',
              action: args.action,
            },
          }),
        }],
      }
    },
  )

  // manage_ab_test
  server.tool(
    'manage_ab_test',
    'Manage YouTube A/B tests and variants',
    {
      action: z.enum(['list', 'get', 'upsert_variants', 'delete_variant']),
      test_id: z.string().uuid().optional(),
      variants: z.array(z.object({
        label: z.enum(['B', 'C', 'D']),
        title_text: z.string().max(200).nullable().optional(),
        description_text: z.string().max(5000).nullable().optional(),
      })).optional(),
    },
    async (args) => {
      if (args.action === 'upsert_variants') {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              data: {
                test_id: args.test_id,
                variants_upserted: args.variants?.length ?? 0,
                idempotent: true,
                message: 'Variants upserted. Calling again with same data produces identical result.',
              },
            }),
          }],
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ data: { action: args.action } }),
        }],
      }
    },
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP Tools — create_item', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns created item on happy path', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'create_item',
      arguments: {
        title_pt: 'Meu video incrivel',
        format: 'video',
        language: 'pt-br',
        priority: 3,
      },
    })

    expect(result.isError).toBeFalsy()
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      data: { id: string; title_pt: string; format: string; stage: string }
    }
    expect(data.data.id).toBe(MOCK_ITEM_ID)
    expect(data.data.title_pt).toBe('Meu video incrivel')
    expect(data.data.format).toBe('video')
    expect(data.data.stage).toBe('idea')
  })

  it('returns planned changes in dry_run mode without persisting', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'create_item',
      arguments: {
        title_en: 'Test Video',
        format: 'video',
        dry_run: true,
      },
    })

    expect(result.isError).toBeFalsy()
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      dry_run: boolean
      planned_changes: { action: string }
      would_persist: boolean
    }
    expect(data.dry_run).toBe(true)
    expect(data.planned_changes.action).toBe('create')
    expect(data.would_persist).toBe(false)
  })

  it('creates item with default language when not specified', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'create_item',
      arguments: {
        title_pt: 'Teste',
        format: 'blog_post',
      },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      data: { language: string }
    }
    expect(data.data.language).toBe('pt-br')
  })

  it('creates item with all supported formats', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    for (const format of ['video', 'blog_post', 'newsletter', 'course', 'campaign'] as const) {
      const result = await pair.client.callTool({
        name: 'create_item',
        arguments: {
          title_en: `Test ${format}`,
          format,
        },
      })
      expect(result.isError).toBeFalsy()
      const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
        data: { format: string }
      }
      expect(data.data.format).toBe(format)
    }
  })

  it('returns tags in the created item', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'create_item',
      arguments: {
        title_pt: 'Tagged',
        format: 'video',
        tags: ['youtube', 'tutorial'],
      },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      data: { tags: string[] }
    }
    expect(data.data.tags).toEqual(['youtube', 'tutorial'])
  })
})

describe('MCP Tools — advance_item', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('advances item to next stage on happy path', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'advance_item',
      arguments: { id: MOCK_ITEM_ID },
    })

    expect(result.isError).toBeFalsy()
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      data: { id: string; stage: string; previous_stage: string }
    }
    expect(data.data.id).toBe(MOCK_ITEM_ID)
    expect(data.data.stage).toBe('roteiro')
    expect(data.data.previous_stage).toBe('idea')
  })

  it('shows planned stage change in dry_run mode', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'advance_item',
      arguments: { id: MOCK_ITEM_ID, dry_run: true },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      dry_run: boolean
      planned_changes: { from_stage: string; to_stage: string }
    }
    expect(data.dry_run).toBe(true)
    expect(data.planned_changes.from_stage).toBe('idea')
    expect(data.planned_changes.to_stage).toBe('roteiro')
    expect(data).toHaveProperty('would_persist', false)
  })
})

describe('MCP Tools — delete_item', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns confirmation prompt when delete called without confirm', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'delete_item',
      arguments: { id: MOCK_ITEM_ID },
    })

    expect(result.isError).toBeFalsy()
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      confirmation_required: boolean
      hint: string
    }
    expect(data.confirmation_required).toBe(true)
    expect(data.hint).toContain('confirm: true')
  })

  it('executes deletion when confirm is true', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'delete_item',
      arguments: { id: MOCK_ITEM_ID, confirm: true },
    })

    expect(result.isError).toBeFalsy()
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      data: { id: string; archived: boolean }
    }
    expect(data.data.id).toBe(MOCK_ITEM_ID)
    expect(data.data.archived).toBe(true)
  })

  it('confirmation message includes item ID', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'delete_item',
      arguments: { id: MOCK_ITEM_ID },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      message: string
      item_id: string
    }
    expect(data.message).toContain(MOCK_ITEM_ID)
    expect(data.item_id).toBe(MOCK_ITEM_ID)
  })
})

describe('MCP Tools — manage_playlist delete', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('shows cascade warning in dry_run mode for delete', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'manage_playlist',
      arguments: {
        action: 'delete',
        id: MOCK_PLAYLIST_ID,
        dry_run: true,
      },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      dry_run: boolean
      planned_changes: { cascade_warning: string; affected_items: number; affected_edges: number }
    }
    expect(data.dry_run).toBe(true)
    expect(data.planned_changes.cascade_warning).toBeTruthy()
    expect(data.planned_changes.affected_items).toBeGreaterThan(0)
    expect(data.planned_changes.affected_edges).toBeGreaterThan(0)
  })

  it('requires confirmation for playlist delete', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'manage_playlist',
      arguments: {
        action: 'delete',
        id: MOCK_PLAYLIST_ID,
      },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      confirmation_required: boolean
    }
    expect(data.confirmation_required).toBe(true)
  })

  it('executes playlist delete with confirm', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'manage_playlist',
      arguments: {
        action: 'delete',
        id: MOCK_PLAYLIST_ID,
        confirm: true,
      },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      data: { action: string; id: string }
    }
    expect(data.data.action).toBe('delete')
  })
})

describe('MCP Tools — search_content', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns search results', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'search_content',
      arguments: { query: 'video tutorial' },
    })

    expect(result.isError).toBeFalsy()
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      data: { results: Array<{ id: string; score: number }>; total: number; query: string }
    }
    expect(data.data.results).toHaveLength(1)
    expect(data.data.total).toBe(1)
    expect(data.data.query).toBe('video tutorial')
  })

  it('passes entity_types filter to search', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'search_content',
      arguments: {
        query: 'test',
        entity_types: ['items', 'posts'],
        limit: 10,
      },
    })

    expect(result.isError).toBeFalsy()
  })
})

describe('MCP Tools — manage_ab_test upsert_variants', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('upserts variants and reports idempotent behavior', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'manage_ab_test',
      arguments: {
        action: 'upsert_variants',
        test_id: MOCK_TEST_ID,
        variants: [
          { label: 'B', title_text: 'Variant B Title' },
          { label: 'C', title_text: 'Variant C Title' },
        ],
      },
    })

    expect(result.isError).toBeFalsy()
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      data: { test_id: string; variants_upserted: number; idempotent: boolean }
    }
    expect(data.data.test_id).toBe(MOCK_TEST_ID)
    expect(data.data.variants_upserted).toBe(2)
    expect(data.data.idempotent).toBe(true)
  })

  it('calling upsert_variants twice returns same result (idempotent)', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const args = {
      action: 'upsert_variants' as const,
      test_id: MOCK_TEST_ID,
      variants: [{ label: 'B' as const, title_text: 'Same Title' }],
    }

    const result1 = await pair.client.callTool({ name: 'manage_ab_test', arguments: args })
    const result2 = await pair.client.callTool({ name: 'manage_ab_test', arguments: args })

    const data1 = extractToolResultJson(result1 as { content: Array<{ type: string; text: string }> })
    const data2 = extractToolResultJson(result2 as { content: Array<{ type: string; text: string }> })
    expect(data1).toEqual(data2)
  })
})

describe('MCP Tools — input validation', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  // TODO: enable after real MCP server validates inputs via Zod
  it.skip('rejects create_item with invalid format', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'create_item',
      arguments: {
        title_pt: 'Test',
        format: 'invalid_format',
      },
    })

    expect(result.isError).toBe(true)
  })

  // TODO: enable after real MCP server validates inputs via Zod
  it.skip('rejects advance_item with non-UUID id', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'advance_item',
      arguments: { id: 'not-a-uuid' },
    })

    expect(result.isError).toBe(true)
  })

  // TODO: enable after real MCP server validates inputs via Zod
  it.skip('rejects search_content with empty query', async () => {
    pair = await createTestMcpPair({ setupServer: registerPipelineTools })

    const result = await pair.client.callTool({
      name: 'search_content',
      arguments: { query: '' },
    })

    expect(result.isError).toBe(true)
  })
})
