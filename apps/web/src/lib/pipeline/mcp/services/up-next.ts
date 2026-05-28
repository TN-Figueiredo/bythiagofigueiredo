/**
 * MCP adapter for pipeline up-next service.
 *
 * Translates flat MCP tool parameters into ServiceContext-based calls
 * and returns CallToolResult. Dispatches by `action` field:
 *   - "get"    → getUpNext(ctx, { timezone, maxCards })
 *   - "assign" → assignUpNextSlot(ctx, data)
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getUpNext, assignUpNextSlot } from '@/lib/pipeline/services/utilities'
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

export async function manageUpNext(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const action = typeof params.action === 'string' ? params.action : 'get'

    if (action === 'assign') {
      const result = await assignUpNextSlot(ctx, {
        itemId: typeof params.itemId === 'string' ? params.itemId : '',
        slotDay: typeof params.slotDay === 'string' ? params.slotDay : '',
        slotHour: typeof params.slotHour === 'string' ? params.slotHour : null,
        previousItemId: typeof params.previousItemId === 'string' ? params.previousItemId : undefined,
      })
      return toMcpSuccess(result.data)
    }

    // Default: action === "get"
    const result = await getUpNext(ctx, {
      tz: typeof params.timezone === 'string' ? params.timezone : undefined,
      maxCards: typeof params.maxCards === 'number' ? params.maxCards : undefined,
    })
    return toMcpSuccess(result.data)
  } catch (error) {
    return toMcpError(toPipelineServiceError(error))
  }
}
