/**
 * MCP test helpers — creates in-memory client+server pairs for integration testing.
 *
 * Uses @modelcontextprotocol/sdk InMemoryTransport to avoid any network I/O.
 */
import { Client } from '@modelcontextprotocol/sdk/client'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpTestPair {
  client: Client
  server: McpServer
  cleanup: () => Promise<void>
}

export interface MockSupabaseChain {
  from: ReturnType<typeof vi.fn>
  [key: string]: ReturnType<typeof vi.fn>
}

// ---------------------------------------------------------------------------
// createTestMcpPair
// ---------------------------------------------------------------------------

/**
 * Creates an MCP client+server pair connected via InMemoryTransport.
 * The server has no tools/resources/prompts registered — callers are
 * expected to register them after obtaining the pair (or pass a factory).
 *
 * @param options.apiKey  Optional API key injected via authInfo on the
 *                        transport, enabling auth-layer tests.
 * @param options.setupServer  Optional callback to register tools/resources/prompts
 *                             on the server before connection.
 */
export async function createTestMcpPair(options?: {
  apiKey?: string
  setupServer?: (server: McpServer) => void
}): Promise<McpTestPair> {
  const server = new McpServer(
    { name: 'pipeline-mcp-test', version: '1.0.0' },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  )

  if (options?.setupServer) {
    options.setupServer(server)
  }

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} },
  )

  // Connect both ends
  await server.connect(serverTransport)
  await client.connect(clientTransport)

  return {
    client,
    server,
    cleanup: async () => {
      await client.close()
      await server.close()
    },
  }
}

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

/**
 * Creates a chainable mock Supabase client suitable for testing MCP tool
 * handlers that delegate to Supabase queries.
 *
 * All chain methods return `this` so callers can set up deeply-nested
 * `.from().select().eq().single()` patterns without manual wiring.
 */
export function mockSupabaseForMcp(overrides?: {
  selectData?: unknown
  selectError?: unknown
  insertData?: unknown
  insertError?: unknown
  updateData?: unknown
  updateError?: unknown
  deleteData?: unknown
  deleteError?: unknown
  singleData?: unknown
  singleError?: unknown
  count?: number | null
}): MockSupabaseChain {
  const defaults = {
    selectData: overrides?.selectData ?? [],
    selectError: overrides?.selectError ?? null,
    insertData: overrides?.insertData ?? null,
    insertError: overrides?.insertError ?? null,
    updateData: overrides?.updateData ?? null,
    updateError: overrides?.updateError ?? null,
    deleteData: overrides?.deleteData ?? null,
    deleteError: overrides?.deleteError ?? null,
    singleData: overrides?.singleData ?? null,
    singleError: overrides?.singleError ?? null,
    count: overrides?.count ?? null,
  }

  const chain: Record<string, ReturnType<typeof vi.fn>> = {}

  // All chainable methods return chain itself
  for (const m of [
    'from', 'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'is', 'in', 'or', 'not', 'gt', 'gte', 'lt', 'lte',
    'ilike', 'like', 'order', 'limit', 'range', 'contains', 'containedBy',
    'textSearch', 'filter', 'match',
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }

  // Terminal methods resolve with data
  chain.single = vi.fn().mockResolvedValue({
    data: defaults.singleData,
    error: defaults.singleError,
  })

  chain.maybeSingle = vi.fn().mockResolvedValue({
    data: defaults.singleData,
    error: defaults.singleError,
  })

  // Make the chain thenable so `await supabase.from(...).select(...)` works
  chain.then = vi.fn((resolve: (v: unknown) => unknown) =>
    resolve({
      data: defaults.selectData,
      error: defaults.selectError,
      count: defaults.count,
    }),
  )

  return chain as MockSupabaseChain
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
export const MOCK_ITEM_ID = '22222222-2222-2222-2222-222222222222'
export const MOCK_PLAYLIST_ID = '33333333-3333-3333-3333-333333333333'
export const MOCK_TEST_ID = '44444444-4444-4444-4444-444444444444'
export const MOCK_VARIANT_ID = '55555555-5555-5555-5555-555555555555'

export const VALID_API_KEY = 'test-pipeline-key-valid-1234567890'
export const INVALID_API_KEY = 'invalid-key-should-fail'

// ---------------------------------------------------------------------------
// Helpers for tool result inspection
// ---------------------------------------------------------------------------

/**
 * Extracts the text content from an MCP tool call result.
 * Tool results contain an array of content blocks; this returns
 * the first text block's content parsed as JSON.
 */
export function extractToolResultJson(result: { content: Array<{ type: string; text?: string }> }): unknown {
  const textBlock = result.content.find((c) => c.type === 'text')
  if (!textBlock || !('text' in textBlock) || !textBlock.text) {
    throw new Error('No text content block found in tool result')
  }
  return JSON.parse(textBlock.text)
}

/**
 * Extracts raw text from a tool call result's first text block.
 */
export function extractToolResultText(result: { content: Array<{ type: string; text?: string }> }): string {
  const textBlock = result.content.find((c) => c.type === 'text')
  if (!textBlock || !('text' in textBlock) || !textBlock.text) {
    throw new Error('No text content block found in tool result')
  }
  return textBlock.text
}
