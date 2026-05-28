/**
 * MCP adapter for pipeline research service.
 *
 * Dispatches by `action` field to the underlying research service layer.
 * Destructive ops (delete, delete_topic) use the confirm flow via safety.ts.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import { formatDryRunResult, validateConfirmationToken } from '../safety'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import {
  listResearchItems,
  createResearchItem,
  getResearchItem,
  updateResearchItem,
  deleteResearchItem,
  addResearchLink,
  removeResearchLink,
  importResearchItems,
  listTopics,
  createTopic,
  updateTopic,
  deleteTopic,
} from '@/lib/pipeline/services/research'

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

export async function manageResearch(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()
    const action = params.action as string | undefined

    // Write permission guard for mutation actions
    const WRITE_ACTIONS = ['create', 'update', 'delete', 'import', 'link', 'unlink', 'create_topic', 'update_topic', 'delete_topic']
    if (action && WRITE_ACTIONS.includes(action)) {
      const mcp = getMcpContext()
      if (!mcpRequirePermission(mcp, 'write')) {
        return toMcpError({ code: 'FORBIDDEN', message: 'Write permission required' })
      }
    }

    switch (action) {
      // ----- Research Items -----
      case 'create': {
        if (params.dry_run !== false) {
          const { action: _a, dry_run: _d, ...createFields } = params
          return toMcpSuccess({
            dry_run: true,
            action: 'create_research',
            would_create: createFields,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await createResearchItem(ctx, params)
        return toMcpSuccess(result.data)
      }

      case 'update': {
        const itemId = params.id as string
        if (params.dry_run !== false) {
          const existing = await getResearchItem(ctx, itemId)
          const existingData = existing.data as Record<string, unknown>
          const changes = Object.entries(params)
            .filter(([k, v]) => !['id', 'action', 'dry_run', 'expected_version', 'version'].includes(k) && v !== undefined)
            .map(([k, v]) => ({
              field: k,
              from: (existingData.data as Record<string, unknown>)?.[k],
              to: v,
            }))
          return toMcpSuccess({
            dry_run: true,
            action: 'update_research',
            target: { id: itemId, title: (existingData.data as Record<string, unknown>)?.title },
            changes,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const expectedVersion = Number(params.expected_version ?? params.version)
        const result = await updateResearchItem(ctx, itemId, params, expectedVersion)
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      case 'delete': {
        const itemId = params.id as string

        // Default to preview unless dry_run is explicitly false
        if (params.dry_run !== false) {
          const existing = await getResearchItem(ctx, itemId)
          return formatDryRunResult('delete_research', params, [
            { entity: 'research_item', id: itemId, field: 'status', from: 'exists', to: 'deleted' },
            { entity: 'research_item', id: itemId, field: 'title', from: existing.data.data.title, to: null },
          ])
        }

        const confirmationToken = params.confirmation_token as string | undefined

        if (confirmationToken) {
          const { confirmation_token: _ct, ...confirmParams } = params
          if (!validateConfirmationToken(confirmationToken, 'delete_research', confirmParams)) {
            return toMcpError({ code: 'VALIDATION_ERROR', message: 'Invalid or expired confirmation token. Request a new dry-run.' })
          }
          const result = await deleteResearchItem(ctx, itemId)
          return toMcpSuccess(result.data)
        }

        // No token — still show dry-run with confirmation token
        const existing = await getResearchItem(ctx, itemId)
        return formatDryRunResult('delete_research', params, [
          { entity: 'research_item', id: itemId, field: 'status', from: 'exists', to: 'deleted' },
          { entity: 'research_item', id: itemId, field: 'title', from: existing.data.data.title, to: null },
        ])
      }

      case 'import': {
        if (params.dry_run !== false) {
          const items = params.items as unknown[] | undefined
          return toMcpSuccess({
            dry_run: true,
            action: 'import_research',
            item_count: Array.isArray(items) ? items.length : 0,
            would_import: items,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await importResearchItems(ctx, params)
        return toMcpSuccess(result.data)
      }

      // ----- Research Links -----
      case 'link': {
        const researchId = params.id as string
        if (!researchId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (research item UUID) is required for link action' })

        if (params.dry_run !== false) {
          return toMcpSuccess({
            dry_run: true,
            action: 'link_research',
            would_link: {
              research_id: researchId,
              pipeline_item_id: params.pipeline_item_id,
              link_type: params.link_type,
            },
            message: 'Call again with dry_run: false to execute.',
          })
        }

        const result = await addResearchLink(ctx, researchId, params)
        return toMcpSuccess(result.data)
      }

      case 'unlink': {
        const researchId = params.id as string
        const linkId = params.link_id as string
        if (!researchId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'id (research item UUID) is required for unlink action' })
        if (!linkId) return toMcpError({ code: 'VALIDATION_ERROR', message: 'link_id is required for unlink action' })

        if (params.dry_run !== false) {
          return toMcpSuccess({
            dry_run: true,
            action: 'unlink_research',
            would_unlink: { research_id: researchId, link_id: linkId },
            message: 'Call again with dry_run: false to execute.',
          })
        }

        const result = await removeResearchLink(ctx, researchId, linkId)
        return toMcpSuccess(result.data)
      }

      // ----- Topics -----
      case 'create_topic': {
        if (params.dry_run !== false) {
          const { action: _a, dry_run: _d, ...topicFields } = params
          return toMcpSuccess({
            dry_run: true,
            action: 'create_topic',
            would_create: topicFields,
            message: 'Call again with dry_run: false to execute.',
          })
        }
        const result = await createTopic(ctx, params)
        return toMcpSuccess(result.data)
      }

      case 'update_topic': {
        const topicId = params.topic_id as string

        if (params.dry_run !== false) {
          const { action: _a, dry_run: _d, topic_id: _t, ...topicFields } = params
          return toMcpSuccess({
            dry_run: true,
            action: 'update_topic',
            target: { topic_id: topicId },
            would_update: topicFields,
            message: 'Call again with dry_run: false to execute.',
          })
        }

        const result = await updateTopic(ctx, topicId, params)
        return toMcpSuccess(result.data)
      }

      case 'delete_topic': {
        const topicId = params.topic_id as string

        // Default to preview unless dry_run is explicitly false
        if (params.dry_run !== false) {
          return formatDryRunResult('delete_topic', params, [
            { entity: 'research_topic', id: topicId, field: 'status', from: 'exists', to: 'deleted' },
          ])
        }

        const confirmationToken = params.confirmation_token as string | undefined

        if (confirmationToken) {
          const { confirmation_token: _ct, ...confirmParams } = params
          if (!validateConfirmationToken(confirmationToken, 'delete_topic', confirmParams)) {
            return toMcpError({ code: 'VALIDATION_ERROR', message: 'Invalid or expired confirmation token. Request a new dry-run.' })
          }
          const result = await deleteTopic(ctx, topicId)
          return toMcpSuccess(result.data)
        }

        // No token — still show dry-run with confirmation token
        return formatDryRunResult('delete_topic', params, [
          { entity: 'research_topic', id: topicId, field: 'status', from: 'exists', to: 'deleted' },
        ])
      }

      // ----- Read-only -----
      case 'list':
      case undefined: {
        const result = await listResearchItems(ctx, {
          limit: params.limit as number | undefined,
          cursor: params.cursor as string | undefined,
          includeContent: params.include_content as boolean | undefined,
          topicId: params.topic_id as string | undefined,
          topicSlug: params.topic_slug as string | undefined,
          status: params.status as string[] | undefined,
          search: params.search as string | undefined,
          pipelineItemId: params.pipeline_item_id as string | undefined,
        })
        return toMcpSuccess(result.data, result.meta as Record<string, unknown> | undefined)
      }

      case 'get': {
        const itemId = params.id as string
        const result = await getResearchItem(ctx, itemId)
        return toMcpSuccess(result.data)
      }

      case 'list_topics': {
        const result = await listTopics(ctx)
        return toMcpSuccess(result.data)
      }

      default:
        return toMcpError({ code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` })
    }
  } catch (e) {
    return toMcpError(toPipelineServiceError(e))
  }
}
