/**
 * MCP adapter for YouTube Videos.
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

export async function youtubeVideos(params: Params): Promise<CallToolResult> {
  const action = params.action as string | undefined

  try {
    switch (action) {
      case 'list': {
        const channelId = params.channel_id as string
        if (!channelId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'channel_id is required' })
        const result = await youtube.listVideos(buildCtx(), {
          channelId,
          categoryId: (params.category_id as string) || null,
          limit: Math.min((params.limit as number) ?? 50, 100),
          cursor: (params.cursor as string) || null,
        })
        return toMcpSuccess(result.data)
      }

      case 'get': {
        const videoId = params.video_id as string
        if (!videoId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'video_id is required' })
        const result = await youtube.getVideoDetail(buildCtx(), videoId)
        return toMcpSuccess(result.data)
      }

      case 'list_categories': {
        const result = await youtube.listCategories(buildCtx())
        return toMcpSuccess(result.data)
      }

      default:
        return toMcpError({
          code: 'VALIDATION_ERROR',
          message: `Unknown action "${action ?? '(missing)'}". Supported: list, get, list_categories`,
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
