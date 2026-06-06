/**
 * MCP adapter for pipeline research focos service.
 *
 * Dispatches by `action` field to the underlying research-focos service layer.
 * Mirrors `mcp/services/research.ts`: builds the same ServiceContext, enforces
 * `mcpRequirePermission(mcp, 'write')` on mutating actions, returns
 * toMcpSuccess/toMcpError.
 *
 * `activate` is high-impact (it demotes the current active foco via the DB RPC
 * `activate_research_foco`), so it is gated behind dry_run + confirmation_token
 * like a destructive op, and the dry-run note flags the demotion.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import { formatDryRunResult, validateConfirmationToken } from '../safety'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ResearchFocoCreateSchema } from '@/lib/pipeline/research-schemas'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import {
  listResearchFocos,
  getResearchFoco,
  getActiveFoco,
  createResearchFoco,
  updateResearchFoco,
  saveFocoFull,
  proposeFoco,
  activateResearchFoco,
  archiveResearchFoco,
  linkFocoToResearch,
  unlinkFocoFromResearch,
} from '@/lib/pipeline/services/research-focos'

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

export async function manageFocos(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const action = params.action as string | undefined

    // Write permission guard for mutating actions.
    const WRITE_ACTIONS = [
      'create',
      'update',
      'save_full',
      'propose',
      'activate',
      'archive',
      'link_research',
      'unlink_research',
    ]
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
          // missing required title) instead of a green preview followed by a
          // hard execute failure.
          const validated = ResearchFocoCreateSchema.safeParse(createFields)
          if (!validated.success) {
            return toMcpError({
              code: 'VALIDATION_ERROR',
              message: validated.error.issues.map((i) => i.message).join(', '),
            })
          }
          return toMcpSuccess({
            dry_run: true,
            action: 'create_foco',
            would_create: createFields,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await createResearchFoco(ctx, params)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      // ----- Update -----
      case 'update': {
        const focoId = params.id as string
        if (!focoId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (foco UUID) is required for update action' })

        if (params.dry_run !== false) {
          const existing = await getResearchFoco(ctx, focoId)
          const existingData = existing.data.data as unknown as Record<string, unknown>
          const changes = Object.entries(params)
            .filter(([k, v]) => !['id', 'action', 'dry_run'].includes(k) && v !== undefined)
            .map(([k, v]) => ({ field: k, from: existingData?.[k], to: v }))
          return toMcpSuccess({
            dry_run: true,
            action: 'update_foco',
            target: { id: focoId, title: existingData?.title },
            changes,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await updateResearchFoco(ctx, focoId, params)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      // ----- Save full (atomic upsert + diff-sync) -----
      case 'save_full': {
        if (params.dry_run !== false) {
          const { action: _a, dry_run: _d, ...fullFields } = params
          return toMcpSuccess({
            dry_run: true,
            action: 'save_foco_full',
            would_upsert: fullFields,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await saveFocoFull(ctx, params)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      // ----- Propose (Cowork-authored, state:'proposto') -----
      case 'propose': {
        if (params.dry_run !== false) {
          const { action: _a, dry_run: _d, ...proposeFields } = params
          // Validate the proposable subset (mirrors proposeFoco) so the preview
          // surfaces schema errors (e.g. missing required title) up front.
          const validated = ResearchFocoCreateSchema.safeParse({
            title: params.title,
            description: params.description ?? undefined,
            rationale: params.rationale ?? undefined,
            metric: params.metric ?? undefined,
            horizon: params.horizon ?? 'proximo',
            state: 'proposto',
            theme_ids: params.theme_ids ?? [],
            pinned_research_ids: params.pinned_research_ids ?? [],
          })
          if (!validated.success) {
            return toMcpError({
              code: 'VALIDATION_ERROR',
              message: validated.error.issues.map((i) => i.message).join(', '),
            })
          }
          return toMcpSuccess({
            dry_run: true,
            action: 'propose_foco',
            would_propose: proposeFields,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await proposeFoco(ctx, {
          title: params.title,
          description: params.description,
          rationale: params.rationale,
          metric: params.metric,
          horizon: params.horizon,
          theme_ids: params.theme_ids,
          pinned_research_ids: params.pinned_research_ids,
        })
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      // ----- Activate (high-impact: demotes the current active foco) -----
      case 'activate': {
        const focoId = params.id as string
        if (!focoId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (foco UUID) is required for activate action' })

        const confirmationToken = params.confirmation_token as string | undefined

        // Default to preview unless an explicit dry_run:false + valid token is present.
        if (params.dry_run === false && confirmationToken) {
          const { confirmation_token: _ct, ...confirmParams } = params
          if (!validateConfirmationToken(confirmationToken, 'activate_foco', confirmParams)) {
            return toMcpError({ code: 'VALIDATION_ERROR', message: 'Invalid or expired confirmation token. Request a new dry-run.' })
          }
          const result = await activateResearchFoco(ctx, focoId)
          return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
        }

        // dry-run (or dry_run:false without a token) — show the activation +
        // confirmation token, and the demotion of the *real* current active
        // foco only when one actually exists.
        const existing = await getResearchFoco(ctx, focoId)
        const focoRow = existing.data.data
        const planned: Parameters<typeof formatDryRunResult>[2] = [
          { entity: 'research_foco', id: focoId, field: 'active', from: focoRow.active, to: true },
          { entity: 'research_foco', id: focoId, field: 'state', from: focoRow.state, to: 'ativo' },
        ]
        const currentActive = await getActiveFoco(ctx)
        const activeRow = currentActive.data?.data
        if (activeRow && activeRow.id !== focoId) {
          planned.push({
            entity: 'research_foco',
            id: activeRow.id,
            field: 'active',
            from: true,
            to: false,
          })
        }
        return formatDryRunResult('activate_foco', params, planned)
      }

      // ----- Archive -----
      case 'archive': {
        const focoId = params.id as string
        if (!focoId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (foco UUID) is required for archive action' })

        if (params.dry_run !== false) {
          const existing = await getResearchFoco(ctx, focoId)
          const focoRow = existing.data.data
          return toMcpSuccess({
            dry_run: true,
            action: 'archive_foco',
            target: { id: focoId, title: focoRow.title },
            changes: [
              { field: 'state', from: focoRow.state, to: 'arquivado' },
              { field: 'active', from: focoRow.active, to: false },
            ],
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await archiveResearchFoco(ctx, focoId)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      // ----- Junction links -----
      case 'link_research': {
        const focoId = params.id as string
        const researchId = params.research_id as string
        if (!focoId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (foco UUID) is required for link_research action' })
        if (!researchId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'research_id is required for link_research action' })

        if (params.dry_run !== false) {
          return toMcpSuccess({
            dry_run: true,
            action: 'link_foco_research',
            would_link: { foco_id: focoId, research_id: researchId, note: params.note },
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await linkFocoToResearch(ctx, focoId, researchId, params.note as string | undefined)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      case 'unlink_research': {
        const focoId = params.id as string
        const researchId = params.research_id as string
        if (!focoId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (foco UUID) is required for unlink_research action' })
        if (!researchId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'research_id is required for unlink_research action' })

        if (params.dry_run !== false) {
          return toMcpSuccess({
            dry_run: true,
            action: 'unlink_foco_research',
            would_unlink: { foco_id: focoId, research_id: researchId },
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await unlinkFocoFromResearch(ctx, focoId, researchId)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      // ----- Read-only -----
      case 'get': {
        const focoId = params.id as string
        if (!focoId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (foco UUID) is required for get action' })
        const result = await getResearchFoco(ctx, focoId)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      case 'get_active': {
        const result = await getActiveFoco(ctx)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      case 'list':
      case undefined: {
        const result = await listResearchFocos(ctx, {
          state: params.state as string | undefined,
          limit: params.limit as number | undefined,
          offset: params.offset as number | undefined,
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
