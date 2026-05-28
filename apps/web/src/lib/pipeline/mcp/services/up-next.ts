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
import { mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
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
    source: 'api_key',
  }
}

type Params = Record<string, unknown>

export async function manageUpNext(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const action = typeof params.action === 'string' ? params.action : 'get'
    const dryRun = params.dry_run === true

    if (action === 'assign') {
      const mcp = getMcpContext()
      if (!mcpRequirePermission(mcp, 'write')) {
        return toMcpError({ code: 'FORBIDDEN', message: 'Write permission required' })
      }

      // MCP schema: day (ISO date), slot_index (int), item_id (uuid | null)
      const day = typeof params.day === 'string' ? params.day : ''
      const itemId = params.item_id
      const slotIndex = typeof params.slot_index === 'number' ? params.slot_index : undefined

      if (!day) {
        return toMcpError({ code: 'VALIDATION_ERROR', message: 'day is required for assign action' })
      }

      // item_id can be null (to clear a slot) or a UUID string
      if (itemId === null) {
        // Clear slot: nothing to schedule
        return toMcpSuccess({ cleared: true, day, slot_index: slotIndex })
      }

      if (typeof itemId !== 'string' || !itemId) {
        return toMcpError({ code: 'VALIDATION_ERROR', message: 'item_id is required for assign action (or null to clear)' })
      }

      if (dryRun) {
        return toMcpSuccess({
          dry_run: true,
          would_assign: { item_id: itemId, day, slot_index: slotIndex },
        })
      }

      // Translate slot_index to slotHour: null means "assign to day without specific time"
      const result = await assignUpNextSlot(ctx, {
        itemId,
        slotDay: day,
        slotHour: null,
      })
      return toMcpSuccess(result.data)
    }

    // Default: action === "get"
    const result = await getUpNext(ctx)
    return toMcpSuccess(result.data)
  } catch (error) {
    return toMcpError(toPipelineServiceError(error))
  }
}
