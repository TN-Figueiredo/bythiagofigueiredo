import { createHash } from 'crypto'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { pipelineLog } from '@/lib/pipeline/logger'

/**
 * MCP-authenticated service context.
 * Transport-agnostic: works with Streamable HTTP headers.
 */
export interface McpServiceContext {
  siteId: string
  permissions: string[]
  keyHash: string
}

/**
 * Extracts the API key from MCP request headers.
 *
 * Checks (in order):
 *  1. Authorization: Bearer <token>  (MCP transport standard)
 *  2. X-Pipeline-Key: <token>        (existing pipeline compat)
 */
function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim() || null
  }
  return req.headers.get('X-Pipeline-Key')
}

/**
 * Resolves MCP authentication from a raw Request.
 *
 * Reuses the same pipeline_api_keys table and SHA-256 key-hash
 * validation that the REST pipeline uses (lib/pipeline/auth.ts).
 *
 * @throws {McpAuthError} on missing/invalid/revoked key
 */
export async function resolveMcpAuth(req: Request): Promise<McpServiceContext> {
  const apiKey = extractApiKey(req)

  if (!apiKey) {
    pipelineLog('warn', 'mcp/auth', 'Missing API key in MCP request')
    throw new McpAuthError('API key required. Send via Authorization: Bearer <key> or X-Pipeline-Key header.', 401)
  }

  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  const supabase = getSupabaseServiceClient()
  const { data: keyRow } = await supabase
    .from('pipeline_api_keys')
    .select('id, site_id, permissions')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .single()

  if (!keyRow) {
    pipelineLog('warn', 'mcp/auth', 'Invalid or revoked API key', { keyHash: keyHash.slice(0, 8) })
    throw new McpAuthError('Invalid or revoked API key', 401)
  }

  // Touch last_used_at (fire-and-forget, non-blocking)
  supabase
    .from('pipeline_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)
    .then(() => { /* intentional no-op */ })

  pipelineLog('info', 'mcp/auth', 'MCP auth success', { siteId: keyRow.site_id, keyHash: keyHash.slice(0, 8) })

  return {
    siteId: keyRow.site_id,
    permissions: keyRow.permissions,
    keyHash,
  }
}

/**
 * Checks whether context has the required permission level.
 * Mirrors requirePermission() from lib/pipeline/auth.ts.
 */
export function mcpRequirePermission(ctx: McpServiceContext, required: 'read' | 'write' | 'admin'): boolean {
  if (required === 'read') return ctx.permissions.includes('read') || ctx.permissions.includes('write') || ctx.permissions.includes('admin')
  if (required === 'write') return ctx.permissions.includes('write') || ctx.permissions.includes('admin')
  return ctx.permissions.includes('admin')
}

/**
 * Structured auth error for MCP layer.
 */
export class McpAuthError extends Error {
  public readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'McpAuthError'
    this.statusCode = statusCode
  }
}
