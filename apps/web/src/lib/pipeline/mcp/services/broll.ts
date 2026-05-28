/**
 * MCP adapter for pipeline B-roll library service.
 *
 * `manageBroll` dispatches by `action` field: create, update, retire, import.
 * Destructive ops (retire) use the confirm flow via safety.ts.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import { formatDryRunResult, validateConfirmationToken } from '../safety'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import {
  listBRollAssets,
  createBRollAsset,
  getBRollAsset,
  updateBRollAsset,
  retireBRollAsset,
  importBRollAssets,
} from '@/lib/pipeline/services/broll'

type Params = Record<string, unknown>

function buildCtx(): ServiceContext {
  const mcp = getMcpContext()
  return {
    siteId: mcp.siteId,
    permissions: mcp.permissions as ServiceContext['permissions'],
    keyHash: mcp.keyHash,
    supabase: getSupabaseServiceClient(),
    source: 'api_key',
  }
}

export async function manageBroll(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const action = params.action as string | undefined

    // Write permission guard for mutation actions
    const WRITE_ACTIONS = ['create', 'update', 'retire', 'import']
    if (action && WRITE_ACTIONS.includes(action)) {
      const mcp = getMcpContext()
      if (!mcpRequirePermission(mcp, 'write')) {
        return toMcpError({ code: 'FORBIDDEN', message: 'Write permission required' })
      }
    }

    switch (action) {
      case 'create': {
        const result = await createBRollAsset(ctx, params)
        return toMcpSuccess(result.data)
      }

      case 'update': {
        const id = params.id as string
        const result = await updateBRollAsset(ctx, id, params)
        return toMcpSuccess(result.data)
      }

      case 'retire': {
        const id = params.id as string
        const confirmationToken = params.confirmation_token as string | undefined

        if (confirmationToken) {
          const { confirmation_token: _ct, ...confirmParams } = params
          if (!validateConfirmationToken(confirmationToken, 'retire_broll', confirmParams)) {
            return toMcpError({ code: 'VALIDATION_ERROR', message: 'Invalid or expired confirmation token. Request a new dry-run.' })
          }
          const result = await retireBRollAsset(ctx, id)
          return toMcpSuccess(result.data)
        }

        // Dry-run: show what will be retired and return confirmation token
        const existing = await getBRollAsset(ctx, id)
        return formatDryRunResult('retire_broll', params, [
          { entity: 'broll_asset', id, field: 'status', from: existing.data.status, to: 'retired' },
          { entity: 'broll_asset', id, field: 'original_filename', from: existing.data.original_filename, to: existing.data.original_filename },
        ])
      }

      case 'import': {
        const result = await importBRollAssets(ctx, params)
        return toMcpSuccess(result.data)
      }

      // ----- Read-only -----
      case 'list':
      case undefined: {
        const result = await listBRollAssets(ctx, {
          limit: params.limit as number | undefined,
          cursor: params.cursor as string | undefined,
          type: params.type as string | undefined,
          status: params.status as string | undefined,
          source_type: params.source_type as string | undefined,
          category: params.category as string | undefined,
          resolution: params.resolution as string | undefined,
          tags: params.tags as string | undefined,
          has_audio: params.has_audio as string | undefined,
          reusable: params.reusable as string | undefined,
          location: params.location as string | undefined,
          q: params.q as string | undefined,
        })
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      case 'get': {
        const id = params.id as string
        const result = await getBRollAsset(ctx, id)
        return toMcpSuccess(result.data)
      }

      default:
        return toMcpError({ code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` })
    }
  } catch (e) {
    return toMcpError(toPipelineServiceError(e))
  }
}
