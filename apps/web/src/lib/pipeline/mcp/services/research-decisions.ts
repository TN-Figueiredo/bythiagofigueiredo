/**
 * MCP adapter for pipeline research-decisions service.
 *
 * Dispatches by `action` field to the underlying research-decisions service
 * layer. The destructive `archive` op uses the confirm flow via safety.ts.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import { formatDryRunResult, validateConfirmationToken } from '../safety'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ResearchDecisionCreateSchema } from '@/lib/pipeline/research-schemas'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import {
  listResearchDecisions,
  getResearchDecision,
  createResearchDecision,
  updateResearchDecision,
  archiveResearchDecision,
  linkDecisionToResearch,
  unlinkDecisionFromResearch,
} from '@/lib/pipeline/services/research-decisions'

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

export async function manageDecisions(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const action = params.action as string | undefined

    // Write permission guard for mutation actions
    const WRITE_ACTIONS = ['create', 'update', 'archive', 'link_research', 'unlink_research']
    if (action && WRITE_ACTIONS.includes(action)) {
      const mcp = getMcpContext()
      if (!mcpRequirePermission(mcp, 'write')) {
        return toMcpError({ code: 'FORBIDDEN', message: 'Write permission required' })
      }
    }

    switch (action) {
      // ----- Create -----
      case 'create': {
        if (params.dry_run !== false) {
          const { action: _a, dry_run: _d, ...createFields } = params
          // Validate up front so the preview surfaces schema errors (e.g.
          // missing required title/horizon) instead of a green preview
          // followed by a hard execute failure.
          const validated = ResearchDecisionCreateSchema.safeParse(createFields)
          if (!validated.success) {
            return toMcpError({
              code: 'VALIDATION_ERROR',
              message: validated.error.issues.map((i) => i.message).join(', '),
            })
          }
          return toMcpSuccess({
            dry_run: true,
            action: 'create_decision',
            would_create: createFields,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await createResearchDecision(ctx, params)
        return toMcpSuccess(result.data)
      }

      // ----- Update -----
      case 'update': {
        const decisionId = params.id as string
        if (params.dry_run !== false) {
          const existing = await getResearchDecision(ctx, decisionId)
          const existingData = existing.data.data as unknown as Record<string, unknown>
          const changes = Object.entries(params)
            .filter(([k, v]) => !['id', 'action', 'dry_run'].includes(k) && v !== undefined)
            .map(([k, v]) => ({
              field: k,
              from: existingData?.[k],
              to: v,
            }))
          return toMcpSuccess({
            dry_run: true,
            action: 'update_decision',
            target: { id: decisionId, title: existingData?.title },
            changes,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await updateResearchDecision(ctx, decisionId, params)
        return toMcpSuccess(result.data)
      }

      // ----- Archive (soft delete) -----
      case 'archive': {
        const decisionId = params.id as string

        // Default to preview unless dry_run is explicitly false
        if (params.dry_run !== false) {
          const existing = await getResearchDecision(ctx, decisionId)
          return formatDryRunResult('archive_decision', params, [
            { entity: 'research_decision', id: decisionId, field: 'status', from: 'exists', to: 'arquivado' },
            { entity: 'research_decision', id: decisionId, field: 'title', from: existing.data.data.title, to: null },
          ])
        }

        const confirmationToken = params.confirmation_token as string | undefined

        if (confirmationToken) {
          const { confirmation_token: _ct, ...confirmParams } = params
          if (!validateConfirmationToken(confirmationToken, 'archive_decision', confirmParams)) {
            return toMcpError({ code: 'VALIDATION_ERROR', message: 'Invalid or expired confirmation token. Request a new dry-run.' })
          }
          const result = await archiveResearchDecision(ctx, decisionId)
          return toMcpSuccess(result.data)
        }

        // No token — still show dry-run with confirmation token
        const existing = await getResearchDecision(ctx, decisionId)
        return formatDryRunResult('archive_decision', params, [
          { entity: 'research_decision', id: decisionId, field: 'status', from: 'exists', to: 'arquivado' },
          { entity: 'research_decision', id: decisionId, field: 'title', from: existing.data.data.title, to: null },
        ])
      }

      // ----- Link / unlink research sources -----
      case 'link_research': {
        const decisionId = params.id as string
        const researchId = params.research_id as string
        if (!decisionId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (decision UUID) is required for link_research action' })
        if (!researchId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'research_id is required for link_research action' })

        if (params.dry_run !== false) {
          return toMcpSuccess({
            dry_run: true,
            action: 'link_research',
            would_link: { decision_id: decisionId, research_id: researchId },
            message: 'Call again with dry_run: false to execute.',
          })
        }

        const result = await linkDecisionToResearch(ctx, decisionId, researchId, params.note as string | undefined)
        return toMcpSuccess(result.data)
      }

      case 'unlink_research': {
        const decisionId = params.id as string
        const researchId = params.research_id as string
        if (!decisionId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (decision UUID) is required for unlink_research action' })
        if (!researchId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'research_id is required for unlink_research action' })

        if (params.dry_run !== false) {
          return toMcpSuccess({
            dry_run: true,
            action: 'unlink_research',
            would_unlink: { decision_id: decisionId, research_id: researchId },
            message: 'Call again with dry_run: false to execute.',
          })
        }

        const result = await unlinkDecisionFromResearch(ctx, decisionId, researchId)
        return toMcpSuccess(result.data)
      }

      // ----- Read-only -----
      case 'get': {
        const decisionId = params.id as string
        const result = await getResearchDecision(ctx, decisionId)
        return toMcpSuccess(result.data)
      }

      case 'list':
      case undefined: {
        const result = await listResearchDecisions(ctx, {
          limit: params.limit as number | undefined,
          offset: params.offset as number | undefined,
          status: params.status as string | string[] | undefined,
          theme_id: params.theme_id as string | undefined,
          horizon: params.horizon as string | undefined,
        })
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      default:
        return toMcpError({ code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` })
    }
  } catch (e) {
    return toMcpError(toPipelineServiceError(e))
  }
}
