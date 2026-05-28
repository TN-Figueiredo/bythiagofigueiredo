/**
 * MCP adapter for pipeline playlists service.
 *
 * Dispatches manage_playlist tool calls to the real service layer
 * based on the `action` field. Destructive ops (delete, remove_item)
 * require confirmation via HMAC token flow.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import {
  validateConfirmationToken,
  formatDryRunResult,
} from '../safety'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
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

export async function managePlaylist(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildServiceContext()
    const action = params.action as string

    switch (action) {
      // ── create ───────────────────────────────────────────────────
      case 'create': {
        const body = {
          name_en: params.name_en,
          name_pt: params.name_pt,
          description_en: params.description_en,
          description_pt: params.description_pt,
          category: params.category,
          status: params.status ?? 'draft',
          cover_image_url: params.cover_image_url,
        }
        const result = await playlistsService.createPlaylistService(ctx, body)
        return toMcpSuccess(result.data)
      }

      // ── update ───────────────────────────────────────────────────
      case 'update': {
        const id = params.id as string
        if (!id) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id is required for update action' })
        const body: Record<string, unknown> = {}
        for (const key of ['name_en', 'name_pt', 'description_en', 'description_pt', 'category', 'status', 'cover_image_url']) {
          if (params[key] !== undefined) body[key] = params[key]
        }
        const result = await playlistsService.updatePlaylistService(ctx, id, body)
        return toMcpSuccess(result.data)
      }

      // ── delete (destructive — confirm flow) ─────────────────────
      case 'delete': {
        const id = params.id as string
        if (!id) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id is required for delete action' })

        const confirmToken = params.confirmation_token as string | undefined

        // If a token was provided, validate and execute
        if (confirmToken) {
          const tokenParams = { action: 'delete', id }
          if (!validateConfirmationToken(confirmToken, 'manage_playlist:delete', tokenParams)) {
            return toMcpError({ code: 'VALIDATION_ERROR', message: 'Invalid or expired confirmation token. Request a new dry_run.' })
          }
          const result = await playlistsService.deletePlaylistService(ctx, id, { dryRun: false })
          return toMcpSuccess(result.data)
        }

        // No token and not confirmed — dry run
        if (!params.confirm) {
          const dryResult = await playlistsService.deletePlaylistService(ctx, id, { dryRun: true })
          const dryData = dryResult.data as { would_delete: true; playlist_id: string; item_count: number; edge_count: number }
          return formatDryRunResult('manage_playlist:delete', { action: 'delete', id }, [
            { entity: 'playlist', id, field: 'deleted', from: false, to: true },
            { entity: 'playlist_items', id, field: 'count', from: dryData.item_count, to: 0 },
            { entity: 'playlist_edges', id, field: 'count', from: dryData.edge_count, to: 0 },
          ])
        }

        // confirm: true without token — execute directly
        const result = await playlistsService.deletePlaylistService(ctx, id, { dryRun: false })
        return toMcpSuccess(result.data)
      }

      // ── reorder ─────────────────────────────────────────────────
      case 'reorder': {
        const id = params.id as string
        if (!id) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id is required for reorder action' })
        const itemIds = params.item_ids as string[] | undefined
        if (!itemIds || itemIds.length === 0) {
          return toMcpError({ code: 'VALIDATION_ERROR', message: 'item_ids is required for reorder action' })
        }
        const result = await playlistsService.reorderItemsService(ctx, id, { item_ids: itemIds })
        return toMcpSuccess(result.data)
      }

      // ── auto_layout ─────────────────────────────────────────────
      case 'auto_layout': {
        const id = params.id as string
        if (!id) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id is required for auto_layout action' })
        const result = await playlistsService.autoLayoutService(ctx, id)
        return toMcpSuccess(result.data)
      }

      // ── add_item ────────────────────────────────────────────────
      case 'add_item': {
        const id = params.id as string
        if (!id) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (playlist) is required for add_item action' })
        const body = {
          blog_post_id: params.blog_post_id,
          newsletter_edition_id: params.newsletter_edition_id,
          pipeline_id: params.pipeline_id,
          sort_order: params.sort_order,
          position_x: params.position_x,
          position_y: params.position_y,
        }
        const result = await playlistsService.addItemService(ctx, id, body)
        return toMcpSuccess(result.data)
      }

      // ── remove_item (destructive — confirm flow) ────────────────
      case 'remove_item': {
        const id = params.id as string
        const itemId = params.item_id as string
        if (!id || !itemId) {
          return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (playlist) and item_id are required for remove_item action' })
        }

        const confirmToken = params.confirmation_token as string | undefined

        if (confirmToken) {
          const tokenParams = { action: 'remove_item', id, item_id: itemId }
          if (!validateConfirmationToken(confirmToken, 'manage_playlist:remove_item', tokenParams)) {
            return toMcpError({ code: 'VALIDATION_ERROR', message: 'Invalid or expired confirmation token. Request a new dry_run.' })
          }
          const result = await playlistsService.removeItemService(ctx, id, itemId, { dryRun: false })
          return toMcpSuccess(result.data)
        }

        if (!params.confirm) {
          const dryResult = await playlistsService.removeItemService(ctx, id, itemId, { dryRun: true })
          void dryResult // validates item exists
          return formatDryRunResult('manage_playlist:remove_item', { action: 'remove_item', id, item_id: itemId }, [
            { entity: 'playlist_item', id: itemId, field: 'deleted', from: false, to: true },
          ])
        }

        const result = await playlistsService.removeItemService(ctx, id, itemId, { dryRun: false })
        return toMcpSuccess(result.data)
      }

      // ── bulk_add_items ──────────────────────────────────────────
      case 'bulk_add_items': {
        const id = params.id as string
        if (!id) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (playlist) is required for bulk_add_items action' })
        const items = params.items as unknown
        if (!items) return toMcpError({ code: 'VALIDATION_ERROR', message: 'items array is required for bulk_add_items action' })
        const result = await playlistsService.bulkAddItemsService(ctx, id, { items })
        return toMcpSuccess(result.data)
      }

      default:
        return toMcpError({ code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` })
    }
  } catch (err) {
    return toMcpError(toPipelineServiceError(err))
  }
}
