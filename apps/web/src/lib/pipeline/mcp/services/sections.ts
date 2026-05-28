import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import { checkRateGovernor } from '../safety'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
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
    source: 'api_key',
  }
}

export async function manageSections(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const action = (params.action as string) ?? 'get'
    const dryRun = params.dry_run === true

    // Batch mode: update multiple sections at once
    const batch = params.batch as Array<Record<string, unknown>> | undefined
    if (batch && Array.isArray(batch) && batch.length > 0) {
      if (action !== 'update') {
        return toMcpError({ code: 'VALIDATION_ERROR', message: 'batch is only supported for action "update"' })
      }

      const mcp = getMcpContext()
      if (!mcpRequirePermission(mcp, 'write')) {
        return toMcpError({ code: 'FORBIDDEN', message: 'Write permission required' })
      }

      if (dryRun) {
        return toMcpSuccess({
          dry_run: true,
          would_update: batch.map((b) => ({
            item_id: b.item_id,
            section: b.section,
            lang: b.lang ?? 'en',
          })),
        })
      }

      const rateCheck = checkRateGovernor(ctx.keyHash ?? 'anonymous', 'bulk')
      if (!rateCheck.allowed) {
        return toMcpError({
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Retry after ${rateCheck.retryAfterSeconds}s`,
        })
      }

      const updates = batch.map((b) => ({
        item_id: b.item_id as string,
        section: b.section as string,
        lang: (b.lang as string) ?? 'en',
        content: b.content as string | Record<string, unknown> | unknown[],
        source: (b.source as string) ?? 'cowork',
        modified_by: b.modified_by as string | undefined,
      }))

      const result = await svc.batchUpdateSections(ctx, { updates })
      return toMcpSuccess(result.data)
    }

    // Single mode: get or update one section
    const id = params.item_id as string
    const section = params.section as string
    const lang = (params.lang as string) ?? 'en'

    if (!id) return toMcpError({ code: 'VALIDATION_ERROR', message: 'item_id is required' })
    if (!section) return toMcpError({ code: 'VALIDATION_ERROR', message: 'section is required' })

    if (action === 'get') {
      const result = await svc.getSection(ctx, id, { section, lang })
      return toMcpSuccess(result.data, result.meta ? { ...result.meta } : undefined)
    }

    if (action === 'update') {
      const mcp = getMcpContext()
      if (!mcpRequirePermission(mcp, 'write')) {
        return toMcpError({ code: 'FORBIDDEN', message: 'Write permission required' })
      }

      if (dryRun) {
        const current = await svc.getSection(ctx, id, { section, lang })
        return toMcpSuccess({
          dry_run: true,
          current: current.data,
          would_update: { item_id: id, section, lang },
        })
      }

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
        source: params.source,
        modified_by: params.modified_by,
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
