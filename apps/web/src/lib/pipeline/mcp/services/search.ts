/**
 * MCP adapter for pipeline search service.
 *
 * Translates flat MCP tool parameters into ServiceContext-based calls
 * and returns CallToolResult.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { searchContent as searchContentService } from '@/lib/pipeline/services/utilities'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import type { Permission } from '@/lib/pipeline/services/types'

function buildCtx(): ServiceContext {
  const mcp = getMcpContext()
  return {
    siteId: mcp.siteId,
    permissions: mcp.permissions as Permission[],
    keyHash: mcp.keyHash,
    supabase: getSupabaseServiceClient(),
  }
}

type Params = Record<string, unknown>

export async function searchContent(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const query = typeof params.query === 'string' ? params.query : ''
    const limit = typeof params.limit === 'number' ? params.limit : undefined

    const result = await searchContentService(ctx, query, { limit })
    return toMcpSuccess(result.data)
  } catch (error) {
    return toMcpError(toPipelineServiceError(error))
  }
}
