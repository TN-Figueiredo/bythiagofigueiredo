/**
 * MCP adapter for YouTube A/B tests service.
 *
 * Translates flat MCP tool parameters into ServiceContext-based calls
 * to the YouTube service layer and returns CallToolResult.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineServiceError } from '@/lib/pipeline/services/types'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import type { VariantInput } from '@/lib/pipeline/services/youtube'
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

export async function manageAbTest(params: Params): Promise<CallToolResult> {
  const action = params.action as string | undefined

  try {
    // Write permission guard for mutation actions
    const WRITE_ACTIONS = ['upsert_variants', 'delete_variant']
    if (action && WRITE_ACTIONS.includes(action)) {
      const mcp = getMcpContext()
      if (!mcpRequirePermission(mcp, 'write')) {
        return toMcpError({ code: 'FORBIDDEN', message: 'Write permission required' })
      }
    }

    switch (action) {
      case 'list_variants': {
        const testId = params.test_id as string
        if (!testId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'test_id is required' })
        const result = await youtube.listVariants(buildCtx(), testId)
        return toMcpSuccess(result.data)
      }

      case 'upsert_variants': {
        const testId = params.test_id as string
        const variants = params.variants as VariantInput[] | undefined
        if (!testId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'test_id is required' })
        if (!variants?.length) return toMcpError({ code: 'VALIDATION_ERROR', message: 'variants array is required and must not be empty' })
        const result = await youtube.upsertVariants(buildCtx(), testId, variants)
        return toMcpSuccess(result.data)
      }

      case 'delete_variant': {
        const testId = params.test_id as string
        const label = params.variant_label as string
        const confirm = params.confirm as boolean | undefined
        if (!testId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'test_id is required' })
        if (!label) return toMcpError({ code: 'VALIDATION_ERROR', message: 'variant_label is required' })

        // Safety layer: dry-run first unless confirm=true
        if (!confirm) {
          const preview = await youtube.deleteVariant(buildCtx(), testId, label, { dryRun: true })
          return toMcpSuccess({
            ...preview.data,
            confirm_required: true,
            message: `Variant "${label}" found. Resend with confirm: true to delete.`,
          })
        }

        const result = await youtube.deleteVariant(buildCtx(), testId, label)
        return toMcpSuccess(result.data)
      }

      default:
        return toMcpError({
          code: 'VALIDATION_ERROR',
          message: `Unknown action "${action ?? '(missing)'}". Supported: list_variants, upsert_variants, delete_variant`,
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
