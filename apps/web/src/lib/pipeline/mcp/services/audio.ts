/**
 * MCP adapter for pipeline audio library service.
 *
 * `manageAudio` dispatches by `action` field: create, update, retire, import, resolve.
 * `matchAudio` calls resolveAudioAssets directly.
 * Destructive ops (retire) use the confirm flow via safety.ts.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import { formatDryRunResult, validateConfirmationToken } from '../safety'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import {
  listAudioAssets,
  createAudioAsset,
  getAudioAsset,
  updateAudioAsset,
  retireAudioAsset,
  resolveAudioAssets,
  importAudioAssets,
  exportAudioAssets,
  getAudioStats,
} from '@/lib/pipeline/services/audio'

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

export async function manageAudio(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const action = params.action as string | undefined

    // Write permission guard for mutation actions
    const WRITE_ACTIONS = ['create', 'update', 'retire', 'import']
    if (action && WRITE_ACTIONS.includes(action)) {
      const mcp = getMcpContext()
      if (!mcpRequirePermission(mcp, 'write')) {
        return toMcpError({ code: 'FORBIDDEN', message: 'Write permission required' })
      }
    }

    switch (action) {
      case 'create': {
        if (params.dry_run !== false) {
          const { action: _a, dry_run: _d, ...createFields } = params
          return toMcpSuccess({
            dry_run: true,
            action: 'create_audio',
            would_create: createFields,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await createAudioAsset(ctx, params)
        return toMcpSuccess(result.data)
      }

      case 'update': {
        const id = params.id as string
        if (params.dry_run !== false) {
          const existing = await getAudioAsset(ctx, id)
          const existingData = existing.data as unknown as Record<string, unknown>
          const changes = Object.entries(params)
            .filter(([k, v]) => !['id', 'action', 'dry_run'].includes(k) && v !== undefined)
            .map(([k, v]) => ({
              field: k,
              from: existingData[k],
              to: v,
            }))
          return toMcpSuccess({
            dry_run: true,
            action: 'update_audio',
            target: { id, track_name: existingData.track_name },
            changes,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await updateAudioAsset(ctx, id, params)
        return toMcpSuccess(result.data)
      }

      case 'retire': {
        const id = params.id as string

        // Default to preview unless dry_run is explicitly false
        if (params.dry_run !== false) {
          const existing = await getAudioAsset(ctx, id)
          return formatDryRunResult('retire_audio', params, [
            { entity: 'audio_asset', id, field: 'status', from: existing.data.status, to: 'retired' },
            { entity: 'audio_asset', id, field: 'track_name', from: existing.data.track_name, to: existing.data.track_name },
          ])
        }

        const confirmationToken = params.confirmation_token as string | undefined

        if (confirmationToken) {
          const { confirmation_token: _ct, ...confirmParams } = params
          if (!validateConfirmationToken(confirmationToken, 'retire_audio', confirmParams)) {
            return toMcpError({ code: 'VALIDATION_ERROR', message: 'Invalid or expired confirmation token. Request a new dry-run.' })
          }
          const result = await retireAudioAsset(ctx, id)
          return toMcpSuccess(result.data)
        }

        // No token — still show dry-run with confirmation token
        const existing = await getAudioAsset(ctx, id)
        return formatDryRunResult('retire_audio', params, [
          { entity: 'audio_asset', id, field: 'status', from: existing.data.status, to: 'retired' },
          { entity: 'audio_asset', id, field: 'track_name', from: existing.data.track_name, to: existing.data.track_name },
        ])
      }

      case 'import': {
        if (params.dry_run !== false) {
          const items = params.items as unknown[] | undefined
          return toMcpSuccess({
            dry_run: true,
            action: 'import_audio',
            item_count: Array.isArray(items) ? items.length : 0,
            would_import: items,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await importAudioAssets(ctx, params)
        return toMcpSuccess(result.data)
      }

      case 'resolve': {
        const result = await resolveAudioAssets(ctx, params)
        return toMcpSuccess(result.data)
      }

      case 'export': {
        const result = await exportAudioAssets(ctx)
        return toMcpSuccess(result.data)
      }

      case 'stats': {
        const result = await getAudioStats(ctx)
        return toMcpSuccess(result.data)
      }

      // ----- Read-only -----
      case 'list':
      case undefined: {
        const result = await listAudioAssets(ctx, {
          limit: params.limit as number | undefined,
          cursor: params.cursor as string | undefined,
          type: params.type as string | undefined,
          status: params.status as string | undefined,
          category: params.category as string | undefined,
          tags: params.tags as string | undefined,
          mood: params.mood as string | undefined,
          energy_min: params.energy_min as string | undefined,
          energy_max: params.energy_max as string | undefined,
          bpm_min: params.bpm_min as string | undefined,
          bpm_max: params.bpm_max as string | undefined,
          subcategory: params.subcategory as string | undefined,
          genre: params.genre as string | undefined,
          source: params.source as string | undefined,
          reusable: params.reusable as string | undefined,
          q: params.q as string | undefined,
        })
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      case 'get': {
        const id = params.id as string
        const result = await getAudioAsset(ctx, id)
        return toMcpSuccess(result.data)
      }

      default:
        return toMcpError({ code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` })
    }
  } catch (e) {
    return toMcpError(toPipelineServiceError(e))
  }
}

export async function matchAudio(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const result = await resolveAudioAssets(ctx, params)
    return toMcpSuccess(result.data)
  } catch (e) {
    return toMcpError(toPipelineServiceError(e))
  }
}
