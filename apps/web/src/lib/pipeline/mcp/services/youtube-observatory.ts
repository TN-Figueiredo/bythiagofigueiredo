/**
 * MCP adapter for YouTube Observatory (competitor intelligence).
 *
 * Delegates to the competitors service layer — never issues direct
 * Supabase queries. This keeps column names and business logic in
 * a single source of truth.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineServiceError } from '@/lib/pipeline/services/types'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import * as competitors from '@/lib/pipeline/services/competitors'
import { toMcpError, toMcpSuccess } from '../errors'

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

export async function youtubeObservatory(params: Params): Promise<CallToolResult> {
  const action = params.action as string | undefined

  try {
    switch (action) {
      case 'list_channels': {
        const result = await competitors.listCompetitorChannels(buildCtx())
        return toMcpSuccess(result.data)
      }

      case 'get_changes': {
        const result = await competitors.listCompetitorChanges(buildCtx(), {
          type: (params.type as string) || 'all',
          bookmarked: params.bookmarked as boolean | undefined,
          limit: (params.limit as number) || 25,
        })
        return toMcpSuccess(result.data)
      }

      case 'get_outliers': {
        const result = await competitors.listCompetitorOutliers(buildCtx(), {
          tier: (params.tier as string) || 'all',
          limit: (params.limit as number) || 25,
        })
        return toMcpSuccess(result.data)
      }

      case 'get_insights': {
        const result = await competitors.getCompetitorInsights(buildCtx())
        return toMcpSuccess(result.data)
      }

      default:
        return toMcpError({
          code: 'VALIDATION_ERROR',
          message: `Unknown action "${action ?? '(missing)'}". Supported: list_channels, get_changes, get_outliers, get_insights`,
        })
    }
  } catch (error) {
    if (error instanceof PipelineServiceError) {
      return toMcpError({
        code: error.code,
        message: error.message,
        status: error.status,
        details: error.details,
      })
    }
    const message = error instanceof Error ? error.message : String(error)
    return toMcpError({ code: 'INTERNAL_ERROR', message })
  }
}
