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
      case 'list_tests': {
        const status = params.status as string | undefined
        const result = await youtube.listAbTests(buildCtx(), { status })
        return toMcpSuccess(result.data)
      }

      case 'get_test': {
        const testId = params.test_id as string
        if (!testId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'test_id is required' })
        const result = await youtube.getAbTest(buildCtx(), testId)
        return toMcpSuccess(result.data)
      }

      case 'get_funnel': {
        const testId = params.test_id as string
        if (!testId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'test_id is required' })
        const result = await youtube.getAbTestFunnel(buildCtx(), testId)
        return toMcpSuccess(result.data)
      }

      case 'get_performance': {
        const result = await youtube.getAbPerformance(buildCtx())
        return toMcpSuccess(result.data)
      }

      case 'get_intelligence': {
        const channelId = params.channel_id as string
        if (!channelId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'channel_id is required for get_intelligence' })
        const result = await youtube.getIntelligenceSnapshot(buildCtx(), channelId)
        return toMcpSuccess(result.data)
      }

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

        if (params.dry_run !== false) {
          // Fetch current variants to show diff
          let currentVariants: unknown[] = []
          try {
            const current = await youtube.listVariants(buildCtx(), testId)
            currentVariants = (current.data as unknown[]) ?? []
          } catch {
            // No existing variants
          }
          return toMcpSuccess({
            dry_run: true,
            action: 'upsert_variants',
            target: { test_id: testId },
            current_variant_count: currentVariants.length,
            proposed_variants: variants.map((v) => ({
              label: v.label,
              title_text: v.title_text,
              description_text: v.description_text,
            })),
            message: 'Call again with dry_run: false to execute.',
          })
        }

        const result = await youtube.upsertVariants(buildCtx(), testId, variants)
        return toMcpSuccess(result.data)
      }

      case 'delete_variant': {
        const testId = params.test_id as string
        const label = params.variant_label as string
        if (!testId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'test_id is required' })
        if (!label) return toMcpError({ code: 'VALIDATION_ERROR', message: 'variant_label is required' })

        // Default to preview unless dry_run is explicitly false
        if (params.dry_run !== false) {
          const preview = await youtube.deleteVariant(buildCtx(), testId, label, { dryRun: true })
          return toMcpSuccess({
            ...preview.data,
            dry_run: true,
            confirm_required: true,
            message: `Variant "${label}" found. Resend with dry_run: false and confirm: true to delete.`,
          })
        }

        const confirm = params.confirm as boolean | undefined
        // Safety layer: require confirm even after dry_run: false
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
          message: `Unknown action "${action ?? '(missing)'}". Supported: list_tests, get_test, get_funnel, get_performance, get_intelligence, list_variants, upsert_variants, delete_variant`,
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
