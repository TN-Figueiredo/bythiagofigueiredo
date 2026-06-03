/**
 * MCP adapter for YouTube Analytics.
 *
 * Delegates to the youtube service layer — never issues direct
 * Supabase queries. This keeps column names and business logic in
 * a single source of truth.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineServiceError } from '@/lib/pipeline/services/types'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import * as youtube from '@/lib/pipeline/services/youtube'
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

export async function youtubeAnalytics(params: Params): Promise<CallToolResult> {
  const action = params.action as string | undefined

  try {
    const channelId = params.channel_id as string
    const days = (params.days as number) || 28

    switch (action) {
      case 'get_overview': {
        if (!channelId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'channel_id is required' })
        const result = await youtube.getAnalyticsOverview(buildCtx(), channelId, days)
        return toMcpSuccess(result.data)
      }

      case 'get_grades': {
        if (!channelId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'channel_id is required' })
        const sort = ((params.sort as string) || 'published_at') as 'score' | 'published_at' | 'views'
        const limit = (params.limit as number) || 50
        const result = await youtube.getAnalyticsGrades(buildCtx(), channelId, sort, limit)
        return toMcpSuccess(result.data)
      }

      case 'get_demographics': {
        if (!channelId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'channel_id is required' })
        const result = await youtube.getAnalyticsDemographics(buildCtx(), channelId, days)
        return toMcpSuccess(result.data)
      }

      case 'get_search_terms': {
        if (!channelId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'channel_id is required' })
        const result = await youtube.getAnalyticsSearchTerms(buildCtx(), channelId, days)
        return toMcpSuccess(result.data)
      }

      case 'get_notes': {
        if (!channelId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'channel_id is required' })
        const result = await youtube.listAnalyticsNotes(buildCtx(), channelId)
        return toMcpSuccess(result.data)
      }

      default:
        return toMcpError({
          code: 'VALIDATION_ERROR',
          message: `Unknown action "${action ?? '(missing)'}". Supported: get_overview, get_grades, get_demographics, get_search_terms, get_notes`,
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
