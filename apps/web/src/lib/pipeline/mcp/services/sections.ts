import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import { checkRateGovernor } from '../safety'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import * as svc from '@/lib/pipeline/services/items'

type Params = Record<string, unknown>

function buildCtx(): ServiceContext {
  const mcp = getMcpContext()
  return {
    siteId: mcp.siteId,
    permissions: mcp.permissions as ServiceContext['permissions'],
    keyHash: mcp.keyHash,
    supabase: getSupabaseServiceClient(),
  }
}

export async function manageSections(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const action = (params.action as string) ?? 'get'
    const id = params.item_id as string
    const section = params.section_key as string
    const lang = (params.lang as string) ?? 'en'

    if (!id) return toMcpError({ code: 'VALIDATION_ERROR', message: 'item_id is required' })
    if (!section) return toMcpError({ code: 'VALIDATION_ERROR', message: 'section_key is required' })

    if (action === 'get') {
      const result = await svc.getSection(ctx, id, { section, lang })
      return toMcpSuccess(result.data, result.meta ? { ...result.meta } : undefined)
    }

    if (action === 'update') {
      const rateCheck = checkRateGovernor(ctx.keyHash ?? 'anonymous', 'single')
      if (!rateCheck.allowed) {
        return toMcpError({
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Retry after ${rateCheck.retryAfterSeconds}s`,
        })
      }

      const current = await svc.getItem(ctx, id)
      const expectedVersion = (current.data as Record<string, unknown>).version as number

      const body = {
        content: params.content,
        content_md: params.content_md,
      }

      const result = await svc.patchSection(ctx, id, {
        section,
        lang,
        body,
        expectedVersion,
      })
      return toMcpSuccess(result.data, result.meta ? { ...result.meta } : undefined)
    }

    return toMcpError({ code: 'VALIDATION_ERROR', message: `Unknown action: ${action}. Use "get" or "update".` })
  } catch (err) {
    return toMcpError(toPipelineServiceError(err))
  }
}
