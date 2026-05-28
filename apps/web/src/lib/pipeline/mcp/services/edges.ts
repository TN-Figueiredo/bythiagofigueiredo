/**
 * MCP adapter for pipeline edges service.
 *
 * Dispatches manage_edges tool calls to the real service layer
 * based on the `action` field. Delete is destructive and requires
 * confirmation via HMAC token flow.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import {
  validateConfirmationToken,
  formatDryRunResult,
} from '../safety'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ServiceContext, Permission } from '@/lib/pipeline/services/types'
import * as playlistsService from '@/lib/pipeline/services/playlists'

type Params = Record<string, unknown>

/** Bridge McpServiceContext → ServiceContext expected by the service layer. */
function buildServiceContext(): ServiceContext {
  const mcp = getMcpContext()
  return {
    siteId: mcp.siteId,
    permissions: mcp.permissions as Permission[],
    keyHash: mcp.keyHash,
    supabase: getSupabaseServiceClient(),
    source: 'api_key',
  }
}

export async function manageEdges(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildServiceContext()
    const action = params.action as string
    const playlistId = params.playlist_id as string

    if (!playlistId) {
      return toMcpError({ code: 'VALIDATION_ERROR', message: 'playlist_id is required' })
    }

    // All edge actions are mutations — require write permission
    const mcp = getMcpContext()
    if (!mcpRequirePermission(mcp, 'write')) {
      return toMcpError({ code: 'FORBIDDEN', message: 'Write permission required' })
    }

    switch (action) {
      // ── create ───────────────────────────────────────────────────
      case 'create': {
        const body = {
          source_item_id: params.source_item_id,
          target_item_id: params.target_item_id,
          edge_type: params.edge_type,
          label: params.label,
        }

        if (params.dry_run !== false) {
          return toMcpSuccess({
            dry_run: true,
            action: 'create_edge',
            target: { playlist_id: playlistId },
            would_create: {
              from: params.source_item_id,
              to: params.target_item_id,
              edge_type: params.edge_type,
              label: params.label,
            },
            message: 'Call again with dry_run: false to execute.',
          })
        }

        const result = await playlistsService.createEdgeService(ctx, playlistId, body)
        return toMcpSuccess(result.data)
      }

      // ── delete (destructive — confirm flow) ─────────────────────
      case 'delete': {
        const edgeId = params.edge_id as string
        if (!edgeId) {
          return toMcpError({ code: 'VALIDATION_ERROR', message: 'edge_id is required for delete action' })
        }

        // Default to preview unless dry_run is explicitly false
        if (params.dry_run !== false) {
          const dryResult = await playlistsService.deleteEdgeService(ctx, playlistId, edgeId, { dryRun: true })
          void dryResult
          return formatDryRunResult('manage_edges:delete', { action: 'delete', playlist_id: playlistId, edge_id: edgeId }, [
            { entity: 'playlist_edge', id: edgeId, field: 'deleted', from: false, to: true },
          ])
        }

        const confirmToken = params.confirmation_token as string | undefined

        if (confirmToken) {
          const tokenParams = { action: 'delete', playlist_id: playlistId, edge_id: edgeId }
          if (!validateConfirmationToken(confirmToken, 'manage_edges:delete', tokenParams)) {
            return toMcpError({ code: 'VALIDATION_ERROR', message: 'Invalid or expired confirmation token. Request a new dry_run.' })
          }
          const result = await playlistsService.deleteEdgeService(ctx, playlistId, edgeId, { dryRun: false })
          return toMcpSuccess(result.data)
        }

        if (!params.confirm) {
          const dryResult = await playlistsService.deleteEdgeService(ctx, playlistId, edgeId, { dryRun: true })
          void dryResult
          return formatDryRunResult('manage_edges:delete', { action: 'delete', playlist_id: playlistId, edge_id: edgeId }, [
            { entity: 'playlist_edge', id: edgeId, field: 'deleted', from: false, to: true },
          ])
        }

        const result = await playlistsService.deleteEdgeService(ctx, playlistId, edgeId, { dryRun: false })
        return toMcpSuccess(result.data)
      }

      // ── bulk_create ─────────────────────────────────────────────
      case 'bulk_create': {
        const edges = params.edges as unknown
        if (!edges) {
          return toMcpError({ code: 'VALIDATION_ERROR', message: 'edges array is required for bulk_create action' })
        }

        if (params.dry_run !== false) {
          const edgeArr = Array.isArray(edges) ? edges : []
          return toMcpSuccess({
            dry_run: true,
            action: 'bulk_create_edges',
            target: { playlist_id: playlistId },
            edge_count: edgeArr.length,
            would_create: edgeArr.map((e: Record<string, unknown>) => ({
              from: e.source_item_id,
              to: e.target_item_id,
              edge_type: e.edge_type,
              label: e.label,
            })),
            message: 'Call again with dry_run: false to execute.',
          })
        }

        const result = await playlistsService.bulkCreateEdgesService(ctx, playlistId, { edges })
        return toMcpSuccess(result.data)
      }

      default:
        return toMcpError({ code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` })
    }
  } catch (err) {
    return toMcpError(toPipelineServiceError(err))
  }
}
