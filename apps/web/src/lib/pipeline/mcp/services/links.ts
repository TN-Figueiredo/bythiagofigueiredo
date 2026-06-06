/**
 * MCP adapter for the pipeline tracked-links service.
 *
 * Dispatches by `action` to the underlying `services/links` layer. Mirrors
 * `mcp/services/research-focos.ts`: builds the same ServiceContext, enforces
 * `mcpRequirePermission(mcp, 'write')` on mutating actions, supports dry_run
 * previews on writes, and returns toMcpSuccess/toMcpError.
 *
 * `archive` is a soft op (active=false), so it follows the same lightweight
 * dry_run preview as `update` — no confirmation token required.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import {
  listTrackedLinks,
  getTrackedLink,
  createTrackedLink,
  updateTrackedLink,
  archiveTrackedLink,
} from '@/lib/pipeline/services/links'

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

export async function manageLinks(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const action = params.action as string | undefined

    // Write permission guard for mutating actions.
    const WRITE_ACTIONS = ['create', 'update', 'archive']
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
          if (!createFields.destination_url) {
            return toMcpError({
              code: 'VALIDATION_ERROR',
              message: 'destination_url is required for create action',
            })
          }
          return toMcpSuccess({
            dry_run: true,
            action: 'create_link',
            would_create: createFields,
            note: 'Code auto-generated if omitted. Link will resolve at /go/{code}.',
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const { action: _a, dry_run: _d, ...createFields } = params
        const result = await createTrackedLink(ctx, createFields)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      // ----- Update -----
      case 'update': {
        const linkId = params.id as string
        if (!linkId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (link UUID) is required for update action' })

        if (params.dry_run !== false) {
          const existing = await getTrackedLink(ctx, linkId)
          const existingData = existing.data as unknown as Record<string, unknown>
          const changes = Object.entries(params)
            .filter(([k, v]) => !['id', 'action', 'dry_run'].includes(k) && v !== undefined)
            .map(([k, v]) => ({ field: k, from: existingData?.[k], to: v }))
          return toMcpSuccess({
            dry_run: true,
            action: 'update_link',
            target: { id: linkId, code: existingData?.code },
            changes,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const { action: _a, dry_run: _d, id: _id, ...updateFields } = params
        const result = await updateTrackedLink(ctx, linkId, updateFields)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      // ----- Archive (soft: active=false) -----
      case 'archive': {
        const linkId = params.id as string
        if (!linkId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (link UUID) is required for archive action' })

        if (params.dry_run !== false) {
          const existing = await getTrackedLink(ctx, linkId)
          const linkRow = existing.data
          return toMcpSuccess({
            dry_run: true,
            action: 'archive_link',
            target: { id: linkId, code: linkRow.code },
            changes: [{ field: 'active', from: linkRow.active, to: false }],
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await archiveTrackedLink(ctx, linkId)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      // ----- Read-only -----
      case 'get': {
        const linkId = params.id as string
        if (!linkId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (link UUID) is required for get action' })
        const result = await getTrackedLink(ctx, linkId)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      case 'list':
      case undefined: {
        const result = await listTrackedLinks(ctx, {
          utm_campaign: params.utm_campaign as string | undefined,
          active: params.active as boolean | undefined,
          search: params.search as string | undefined,
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
