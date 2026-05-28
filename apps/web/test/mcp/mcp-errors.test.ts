/**
 * MCP Error handling tests — verifies that error responses follow the
 * structured error envelope convention with severity, retryable flag,
 * and recovery actions.
 *
 * Error envelope contract:
 * {
 *   error: {
 *     code: string,
 *     message: string,
 *     severity: 'fatal' | 'recoverable' | 'transient',
 *     retryable: boolean,
 *     retry_after_seconds?: number,
 *     recovery_action?: string,
 *     details?: unknown,
 *   }
 * }
 */
import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createTestMcpPair, extractToolResultJson, MOCK_ITEM_ID, type McpTestPair } from './helpers'

// ---------------------------------------------------------------------------
// Error envelope type (mirrors what the MCP server will return)
// ---------------------------------------------------------------------------

interface McpErrorEnvelope {
  error: {
    code: string
    message: string
    severity: 'fatal' | 'recoverable' | 'transient'
    retryable: boolean
    retry_after_seconds?: number
    recovery_action?: string
    details?: unknown
  }
}

// ---------------------------------------------------------------------------
// Helper: register tools that simulate various error conditions
// ---------------------------------------------------------------------------

function registerErrorTools(server: McpServer): void {
  // Tool that simulates VERSION_CONFLICT
  server.tool(
    'update_with_version_conflict',
    'Simulates version conflict on optimistic concurrency update',
    {
      id: z.string().uuid(),
      version: z.number().int(),
    },
    async (args) => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          error: {
            code: 'VERSION_CONFLICT',
            message: `Item ${args.id} was modified since version ${args.version}. Current version is ${args.version + 1}.`,
            severity: 'recoverable',
            retryable: true,
            recovery_action: `Re-fetch item ${args.id} to get current version, then retry with updated version.`,
          },
        } satisfies McpErrorEnvelope),
      }],
      isError: true,
    }),
  )

  // Tool that simulates NOT_FOUND
  server.tool(
    'get_nonexistent_item',
    'Simulates not found error',
    {
      id: z.string().uuid(),
    },
    async (args) => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: `Item ${args.id} does not exist or has been archived.`,
            severity: 'fatal',
            retryable: false,
          },
        } satisfies McpErrorEnvelope),
      }],
      isError: true,
    }),
  )

  // Tool that simulates RATE_LIMITED
  server.tool(
    'trigger_rate_limit',
    'Simulates rate limit error',
    {},
    async () => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          error: {
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded. Max 100 requests per minute.',
            severity: 'transient',
            retryable: true,
            retry_after_seconds: 30,
          },
        } satisfies McpErrorEnvelope),
      }],
      isError: true,
    }),
  )

  // Tool that simulates VALIDATION_ERROR
  server.tool(
    'create_with_invalid_data',
    'Simulates validation error with field-level details',
    {
      title_pt: z.string().optional(),
      format: z.string().optional(),
    },
    async () => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            severity: 'fatal',
            retryable: false,
            details: {
              field_errors: [
                { path: 'format', message: 'Invalid enum value. Expected "video" | "blog_post" | "newsletter" | "course" | "campaign"' },
                { path: 'title_pt', message: 'At least one title (title_pt or title_en) is required' },
              ],
            },
          },
        } satisfies McpErrorEnvelope),
      }],
      isError: true,
    }),
  )

  // Tool that simulates DB_ERROR
  server.tool(
    'trigger_db_error',
    'Simulates a database connection error',
    {},
    async () => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          error: {
            code: 'DB_ERROR',
            message: 'Database connection temporarily unavailable. The operation was not applied.',
            severity: 'transient',
            retryable: true,
            retry_after_seconds: 5,
          },
        } satisfies McpErrorEnvelope),
      }],
      isError: true,
    }),
  )

  // Tool that simulates PERMISSION_DENIED
  server.tool(
    'trigger_permission_denied',
    'Simulates permission denied',
    {},
    async () => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Insufficient permissions to perform this action.',
            severity: 'fatal',
            retryable: false,
            recovery_action: 'Request write permissions from the site admin.',
          },
        }),
      }],
      isError: true,
    }),
  )

  // Tool that simulates CONFLICT (e.g., duplicate)
  server.tool(
    'trigger_conflict',
    'Simulates a conflict/duplicate error',
    { code: z.string() },
    async (args) => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          error: {
            code: 'CONFLICT',
            message: `An item with code "${args.code}" already exists.`,
            severity: 'recoverable',
            retryable: false,
            recovery_action: `Use a different code or update the existing item.`,
          },
        }),
      }],
      isError: true,
    }),
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP Errors — VERSION_CONFLICT', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns recoverable severity with retryable true', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'update_with_version_conflict',
      arguments: { id: MOCK_ITEM_ID, version: 3 },
    })

    expect(result.isError).toBe(true)
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.code).toBe('VERSION_CONFLICT')
    expect(data.error.severity).toBe('recoverable')
    expect(data.error.retryable).toBe(true)
  })

  it('recovery_action contains "re-fetch"', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'update_with_version_conflict',
      arguments: { id: MOCK_ITEM_ID, version: 3 },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.recovery_action).toBeDefined()
    expect(data.error.recovery_action!.toLowerCase()).toContain('re-fetch')
  })

  it('message includes the item ID and version info', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'update_with_version_conflict',
      arguments: { id: MOCK_ITEM_ID, version: 5 },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.message).toContain(MOCK_ITEM_ID)
    expect(data.error.message).toContain('5')
  })
})

describe('MCP Errors — NOT_FOUND', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns fatal severity with retryable false', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'get_nonexistent_item',
      arguments: { id: MOCK_ITEM_ID },
    })

    expect(result.isError).toBe(true)
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.code).toBe('NOT_FOUND')
    expect(data.error.severity).toBe('fatal')
    expect(data.error.retryable).toBe(false)
  })

  it('does not include retry_after_seconds', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'get_nonexistent_item',
      arguments: { id: MOCK_ITEM_ID },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.retry_after_seconds).toBeUndefined()
  })
})

describe('MCP Errors — RATE_LIMITED', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns transient severity with retryable true', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'trigger_rate_limit',
      arguments: {},
    })

    expect(result.isError).toBe(true)
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.code).toBe('RATE_LIMITED')
    expect(data.error.severity).toBe('transient')
    expect(data.error.retryable).toBe(true)
  })

  it('includes retry_after_seconds > 0', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'trigger_rate_limit',
      arguments: {},
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.retry_after_seconds).toBeDefined()
    expect(data.error.retry_after_seconds!).toBeGreaterThan(0)
  })
})

describe('MCP Errors — VALIDATION_ERROR', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns fatal severity with retryable false', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'create_with_invalid_data',
      arguments: { format: 'invalid' },
    })

    expect(result.isError).toBe(true)
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.code).toBe('VALIDATION_ERROR')
    expect(data.error.severity).toBe('fatal')
    expect(data.error.retryable).toBe(false)
  })

  it('details contains field errors', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'create_with_invalid_data',
      arguments: {},
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.details).toBeDefined()

    const details = data.error.details as { field_errors: Array<{ path: string; message: string }> }
    expect(details.field_errors).toBeDefined()
    expect(details.field_errors.length).toBeGreaterThan(0)
    expect(details.field_errors.some((e) => e.path === 'format')).toBe(true)
  })

  it('field errors include path and message for each invalid field', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'create_with_invalid_data',
      arguments: {},
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    const details = data.error.details as { field_errors: Array<{ path: string; message: string }> }

    for (const fieldError of details.field_errors) {
      expect(fieldError.path).toBeTruthy()
      expect(fieldError.message).toBeTruthy()
    }
  })
})

describe('MCP Errors — DB_ERROR', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns transient severity with retryable true', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'trigger_db_error',
      arguments: {},
    })

    expect(result.isError).toBe(true)
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.code).toBe('DB_ERROR')
    expect(data.error.severity).toBe('transient')
    expect(data.error.retryable).toBe(true)
  })

  it('includes a positive retry_after_seconds', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'trigger_db_error',
      arguments: {},
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.retry_after_seconds).toBeDefined()
    expect(data.error.retry_after_seconds!).toBeGreaterThan(0)
  })

  it('message indicates the operation was not applied', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'trigger_db_error',
      arguments: {},
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.message.toLowerCase()).toContain('not applied')
  })
})

describe('MCP Errors — PERMISSION_DENIED', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns fatal severity with retryable false', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'trigger_permission_denied',
      arguments: {},
    })

    expect(result.isError).toBe(true)
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.code).toBe('PERMISSION_DENIED')
    expect(data.error.severity).toBe('fatal')
    expect(data.error.retryable).toBe(false)
  })

  it('includes a recovery_action', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'trigger_permission_denied',
      arguments: {},
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.recovery_action).toBeTruthy()
  })
})

describe('MCP Errors — CONFLICT', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns recoverable severity', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'trigger_conflict',
      arguments: { code: 'VID-001' },
    })

    expect(result.isError).toBe(true)
    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.code).toBe('CONFLICT')
    expect(data.error.severity).toBe('recoverable')
    expect(data.error.retryable).toBe(false)
  })

  it('recovery_action suggests an alternative path', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const result = await pair.client.callTool({
      name: 'trigger_conflict',
      arguments: { code: 'VID-001' },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
    expect(data.error.recovery_action).toBeTruthy()
    expect(data.error.recovery_action!.toLowerCase()).toContain('different')
  })
})

describe('MCP Errors — error envelope structure', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('all error tools return consistent envelope structure', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const errorTools = [
      { name: 'update_with_version_conflict', args: { id: MOCK_ITEM_ID, version: 1 } },
      { name: 'get_nonexistent_item', args: { id: MOCK_ITEM_ID } },
      { name: 'trigger_rate_limit', args: {} },
      { name: 'create_with_invalid_data', args: {} },
      { name: 'trigger_db_error', args: {} },
    ]

    for (const { name, args } of errorTools) {
      const result = await pair.client.callTool({ name, arguments: args })
      expect(result.isError).toBe(true)

      const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
      // Every error must have these fields
      expect(data.error).toBeDefined()
      expect(data.error.code).toBeTruthy()
      expect(data.error.message).toBeTruthy()
      expect(data.error.severity).toMatch(/^(fatal|recoverable|transient)$/)
      expect(typeof data.error.retryable).toBe('boolean')
    }
  })

  it('transient errors always include retry_after_seconds', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const transientTools = ['trigger_rate_limit', 'trigger_db_error']

    for (const name of transientTools) {
      const result = await pair.client.callTool({ name, arguments: {} })
      const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
      expect(data.error.severity).toBe('transient')
      expect(data.error.retry_after_seconds).toBeGreaterThan(0)
    }
  })

  it('fatal errors never include retry_after_seconds', async () => {
    pair = await createTestMcpPair({ setupServer: registerErrorTools })

    const fatalTools = [
      { name: 'get_nonexistent_item', args: { id: MOCK_ITEM_ID } },
      { name: 'create_with_invalid_data', args: {} },
    ]

    for (const { name, args } of fatalTools) {
      const result = await pair.client.callTool({ name, arguments: args })
      const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as McpErrorEnvelope
      expect(data.error.severity).toBe('fatal')
      expect(data.error.retry_after_seconds).toBeUndefined()
    }
  })
})
