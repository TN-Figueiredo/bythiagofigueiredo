/**
 * Tests for the /api/mcp route wrapper (GET/POST → authenticatedHandler).
 *
 * This is the broad execution surface for the pipeline MCP server. The route
 * itself is a thin auth/permission gate in front of the mcp-handler transport:
 *   1. resolveMcpAuth(req)         — extract + validate the API key
 *   2. mcpRequirePermission(read)  — 403 if the key lacks read
 *   3. runWithMcpContext(ctx, ...) — delegate the JSON-RPC body to the handler
 *   4. McpAuthError → 401/403; any other throw → 500
 *
 * We exercise the REAL auth module (key extraction via Bearer AND X-Pipeline-Key,
 * SHA-256 hash lookup, permission tiers) with only its supabase dependency mocked.
 * The mcp-handler transport + tool/resource/prompt registration are stubbed so
 * "routing" is asserted as: an authorized request is delegated to the handler,
 * inside the auth context.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted stubs referenced inside vi.mock factories.
const { handlerMock, runWithMcpContextMock } = vi.hoisted(() => ({
  handlerMock: vi.fn(),
  runWithMcpContextMock: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

// Stub the transport factory so no real MCP server is constructed at import.
vi.mock('mcp-handler', () => ({
  createMcpHandler: vi.fn(() => handlerMock),
}))

// Keep tool/resource/prompt registration cheap — the factory callback is never
// invoked by the stubbed createMcpHandler anyway.
vi.mock('@/lib/pipeline/mcp/tools', () => ({ registerTools: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/resources', () => ({ registerResources: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/prompts', () => ({ registerPrompts: vi.fn() }))
vi.mock('@/lib/pipeline/logger', () => ({ pipelineLog: vi.fn() }))

// Passthrough that also records the ctx it ran under.
vi.mock('@/lib/pipeline/mcp/context', () => ({
  runWithMcpContext: runWithMcpContextMock,
  getMcpContext: vi.fn(),
}))

import { GET, POST } from '../../../src/app/api/mcp/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

/**
 * Mocks the supabase client used by the REAL resolveMcpAuth:
 *   .from('pipeline_api_keys').select(...).eq('key_hash',h).is('revoked_at',null).single()
 *   .from('pipeline_api_keys').update({last_used_at}).eq('id',id)  (fire-and-forget)
 */
function makeAuthSupabase(opts: {
  keyRow?: { id: string; site_id: string; permissions: string[] } | null
  throwOnFrom?: boolean
} = {}) {
  const keyRow = opts.keyRow ?? null

  if (opts.throwOnFrom) {
    return {
      from: vi.fn(() => {
        throw new Error('db down')
      }),
    }
  }

  const selectSub = {
    eq: vi.fn(() => selectSub),
    is: vi.fn(() => selectSub),
    single: vi.fn(() =>
      Promise.resolve({
        data: keyRow,
        error: keyRow ? null : { message: 'not found' },
      }),
    ),
  }

  const from = vi.fn(() => ({
    select: vi.fn(() => selectSub),
    // fire-and-forget last_used_at touch: .update(...).eq(...).then(...)
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      })),
    })),
  }))

  return { from }
}

function mcpReq(headers: Record<string, string> = {}, method = 'POST') {
  return new Request('http://localhost/api/mcp', {
    method,
    headers,
    body:
      method === 'POST'
        ? JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
        : undefined,
  })
}

const READ_KEY_ROW = { id: 'key-1', site_id: 'site-1', permissions: ['read'] }

beforeEach(() => {
  vi.clearAllMocks()
  // Default passthrough: run the delegated fn (which calls handlerMock).
  runWithMcpContextMock.mockImplementation((_ctx: unknown, fn: () => unknown) => fn())
  handlerMock.mockResolvedValue(
    new Response(JSON.stringify({ jsonrpc: '2.0', result: { tools: [] }, id: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('/api/mcp — rejection without a key', () => {
  it('returns 401 JSON-RPC error when no API key header is present', async () => {
    const supabase = makeAuthSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(mcpReq())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.jsonrpc).toBe('2.0')
    expect(body.error.code).toBe(-32600)
    expect(body.error.message).toMatch(/API key required/i)
    // Never reached the transport.
    expect(handlerMock).not.toHaveBeenCalled()
  })

  it('returns 401 for an invalid / revoked key (no matching row)', async () => {
    const supabase = makeAuthSupabase({ keyRow: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(mcpReq({ Authorization: 'Bearer bogus-key' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.message).toMatch(/invalid or revoked/i)
    expect(handlerMock).not.toHaveBeenCalled()
  })
})

describe('/api/mcp — accepted authentication', () => {
  it('accepts a valid Bearer key and delegates to the MCP handler', async () => {
    const supabase = makeAuthSupabase({ keyRow: READ_KEY_ROW })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(mcpReq({ Authorization: 'Bearer valid-key' }))
    expect(res.status).toBe(200)
    expect(handlerMock).toHaveBeenCalledTimes(1)
    // Delegation happened inside the auth context, carrying the resolved ctx.
    expect(runWithMcpContextMock).toHaveBeenCalledTimes(1)
    const ctx = runWithMcpContextMock.mock.calls[0][0]
    expect(ctx.siteId).toBe('site-1')
    expect(ctx.permissions).toEqual(['read'])
  })

  it('accepts the alternative X-Pipeline-Key header', async () => {
    const supabase = makeAuthSupabase({ keyRow: READ_KEY_ROW })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(mcpReq({ 'X-Pipeline-Key': 'valid-key' }))
    expect(res.status).toBe(200)
    expect(handlerMock).toHaveBeenCalledTimes(1)
  })

  it('shares the same handler for GET and POST', async () => {
    expect(GET).toBe(POST)

    const supabase = makeAuthSupabase({ keyRow: READ_KEY_ROW })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await GET(mcpReq({ Authorization: 'Bearer valid-key' }, 'GET'))
    expect(res.status).toBe(200)
    expect(handlerMock).toHaveBeenCalledTimes(1)
  })
})

describe('/api/mcp — permission gate', () => {
  it('returns 403 when the key lacks read permission', async () => {
    const supabase = makeAuthSupabase({
      keyRow: { id: 'k', site_id: 'site-1', permissions: ['something-else'] },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(mcpReq({ Authorization: 'Bearer valid-key' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.message).toMatch(/insufficient permissions/i)
    // Authenticated but not authorized → never delegated.
    expect(handlerMock).not.toHaveBeenCalled()
  })

  it('a write key still satisfies the read requirement (delegates)', async () => {
    const supabase = makeAuthSupabase({
      keyRow: { id: 'k', site_id: 'site-1', permissions: ['write'] },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(mcpReq({ Authorization: 'Bearer valid-key' }))
    expect(res.status).toBe(200)
    expect(handlerMock).toHaveBeenCalledTimes(1)
  })
})

describe('/api/mcp — unexpected error handling', () => {
  it('returns a 500 JSON-RPC error when auth throws a non-McpAuthError', async () => {
    const supabase = makeAuthSupabase({ throwOnFrom: true })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(mcpReq({ Authorization: 'Bearer valid-key' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.jsonrpc).toBe('2.0')
    expect(body.error.code).toBe(-32603)
    expect(handlerMock).not.toHaveBeenCalled()
  })
})
