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

/** Count words in content (handles string, object, or array). */
function countWords(content: unknown): number {
  if (typeof content === 'string') return content.split(/\s+/).filter(Boolean).length
  if (content && typeof content === 'object') return countWords(JSON.stringify(content))
  return 0
}

/** Get first N chars of content for preview. */
function contentPreview(content: unknown, maxChars = 200): string {
  const text = typeof content === 'string' ? content : JSON.stringify(content) ?? ''
  return text.length > maxChars ? text.slice(0, maxChars) + '...' : text
}

export async function manageSections(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const action = (params.action as string) ?? 'get'

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

      if (params.dry_run !== false) {
        // Fetch current state for each section to show content diff
        const summaries = await Promise.all(
          batch.map(async (b) => {
            const itemId = b.item_id as string
            const sec = b.section as string
            const lang = (b.lang as string) ?? 'en'
            try {
              const current = await svc.getSection(ctx, itemId, { section: sec, lang })
              const currentContent = (current.data as Record<string, unknown>)?.content
              return {
                item_id: itemId,
                section: sec,
                lang,
                current: {
                  word_count: countWords(currentContent),
                  preview: contentPreview(currentContent),
                },
                proposed: {
                  word_count: countWords(b.content),
                  preview: contentPreview(b.content),
                },
              }
            } catch {
              return {
                item_id: itemId,
                section: sec,
                lang,
                current: { word_count: 0, preview: '(new section)' },
                proposed: {
                  word_count: countWords(b.content),
                  preview: contentPreview(b.content),
                },
              }
            }
          }),
        )

        return toMcpSuccess({
          dry_run: true,
          action: 'batch_update_sections',
          section_count: batch.length,
          sections: summaries,
          message: 'This will replace entire section contents. Call with dry_run: false to execute.',
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

      if (params.dry_run !== false) {
        // Show content diff with word counts and previews
        let currentContent: unknown = null
        try {
          const current = await svc.getSection(ctx, id, { section, lang })
          currentContent = (current.data as Record<string, unknown>)?.content
        } catch {
          // Section doesn't exist yet
        }

        return toMcpSuccess({
          dry_run: true,
          action: 'update_section',
          target: { item_id: id, section, lang },
          current: {
            word_count: countWords(currentContent),
            preview: currentContent ? contentPreview(currentContent) : '(empty)',
          },
          proposed: {
            word_count: countWords(params.content),
            preview: contentPreview(params.content),
          },
          message: 'This will replace the entire section content. Call with dry_run: false to execute.',
        })
      }

      const rateCheck = checkRateGovernor(ctx.keyHash ?? 'anonymous', 'single')
      if (!rateCheck.allowed) {
        return toMcpError({
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Retry after ${rateCheck.retryAfterSeconds}s`,
        })
      }

      const currentItem = await svc.getItem(ctx, id)
      const expectedVersion = (currentItem.data as Record<string, unknown>).version as number

      // The MCP layer owns optimistic concurrency: SectionPatchSchema requires `rev`,
      // so we read the section's current rev and supply it automatically. The agent
      // never sends `rev` — omitting it used to fail every write with a bare "Required".
      // New section → rev 0; existing → its current rev (matches patchSection's guard).
      let currentRev = 0
      try {
        const current = await svc.getSection(ctx, id, { section, lang })
        currentRev = (current.data as { rev?: number } | null)?.rev ?? 0
      } catch {
        currentRev = 0
      }

      const body = {
        content: params.content,
        rev: currentRev,
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
