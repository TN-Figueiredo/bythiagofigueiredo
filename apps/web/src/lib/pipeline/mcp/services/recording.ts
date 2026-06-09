/**
 * MCP adapter for per-beat recording status.
 *
 * Dispatches by `action` to the shared recording service under the recording route
 * directory. Mirrors `mcp/services/links.ts`: builds the same ServiceContext from the
 * MCP auth context (the permanent PIPELINE_COWORK_KEY path — NEVER creates/revokes keys),
 * enforces `mcpRequirePermission(mcp, 'write')` on mutating actions, supports dry_run
 * previews on writes, and returns toMcpSuccess / toMcpError.
 *
 * Actions:
 *   read          → GET reconciled beats + orphans for (item, lang)
 *   set           → upsert one beat's status (PUT)
 *   batch         → multi-row upsert (PATCH)
 *   purge-orphans → delete rows whose beat_id is gone from the current roteiro (DELETE)
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import {
  getRecording,
  putRecording,
  batchRecording,
  purgeOrphans,
  RecordingPreconditionError,
} from '@/app/api/pipeline/items/[id]/recording/service'

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

export async function manageRecording(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const action = (params.action as string | undefined) ?? 'read'
    const itemId = params.item_id as string | undefined
    const lang = (params.lang as string | undefined) ?? 'pt'

    if (!itemId) {
      return toMcpError({ code: 'VALIDATION_ERROR', message: 'item_id (pipeline item UUID) is required' })
    }

    const WRITE_ACTIONS = ['set', 'batch', 'purge-orphans']
    if (WRITE_ACTIONS.includes(action)) {
      const mcp = getMcpContext()
      if (!mcpRequirePermission(mcp, 'write')) {
        return toMcpError({ code: 'FORBIDDEN', message: 'Write permission required' })
      }
    }

    switch (action) {
      // ----- Read -----
      case 'read': {
        const result = await getRecording(ctx, itemId, lang)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      // ----- Set one beat -----
      case 'set': {
        if (!params.beat_id) {
          return toMcpError({ code: 'VALIDATION_ERROR', message: 'beat_id is required for set action' })
        }
        if (!params.status) {
          return toMcpError({ code: 'VALIDATION_ERROR', message: 'status is required for set action' })
        }
        const beatBody = {
          beat_id: params.beat_id,
          status: params.status,
          retake_note: params.retake_note,
          beat_name: params.beat_name,
          content_hash: params.content_hash,
          if_unmodified_since: params.if_unmodified_since,
          source: 'cowork' as const,
        }
        if (params.dry_run !== false) {
          return toMcpSuccess({
            dry_run: true,
            action: 'set_recording',
            target: { item_id: itemId, lang, beat_id: params.beat_id },
            would_set: { status: params.status, retake_note: params.retake_note ?? null },
            message: 'Call again with dry_run: false to execute.',
          })
        }
        try {
          const result = await putRecording(ctx, itemId, lang, beatBody)
          return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
        } catch (e) {
          if (e instanceof RecordingPreconditionError) {
            return toMcpError({ code: 'PRECONDITION_FAILED', message: e.message, details: { current: e.current } })
          }
          throw e
        }
      }

      // ----- Batch -----
      case 'batch': {
        const updates = params.updates
        if (!Array.isArray(updates) || updates.length === 0) {
          return toMcpError({ code: 'VALIDATION_ERROR', message: 'updates[] (non-empty) is required for batch action' })
        }
        if (params.dry_run !== false) {
          return toMcpSuccess({
            dry_run: true,
            action: 'batch_recording',
            target: { item_id: itemId, lang },
            would_upsert: updates.length,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await batchRecording(ctx, itemId, lang, { updates, source: 'cowork' })
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      // ----- Purge orphans -----
      case 'purge-orphans': {
        if (params.dry_run !== false) {
          // Preview: read shows the orphans that would be purged.
          const preview = await getRecording(ctx, itemId, lang)
          return toMcpSuccess({
            dry_run: true,
            action: 'purge_orphans',
            target: { item_id: itemId, lang },
            would_purge: preview.data.orphans.length,
            orphan_beat_ids: preview.data.orphans.map((o) => o.beat_id),
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await purgeOrphans(ctx, itemId, lang)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      default:
        return toMcpError({ code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` })
    }
  } catch (e) {
    return toMcpError(toPipelineServiceError(e))
  }
}
