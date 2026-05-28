/**
 * MCP adapter for pipeline items service.
 *
 * Translates flat MCP tool parameters into ServiceContext-based calls
 * and returns CallToolResult.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import {
  validateConfirmationToken,
  checkRateGovernor,
  formatDryRunResult,
} from '../safety'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import * as svc from '@/lib/pipeline/services/items'

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

/** Returns a FORBIDDEN error if the current MCP context lacks write permission, or null if allowed. */
function requireWrite(): CallToolResult | null {
  const mcp = getMcpContext()
  if (!mcpRequirePermission(mcp, 'write')) {
    return toMcpError({ code: 'FORBIDDEN', message: 'Write permission required' })
  }
  return null
}

// ---------------------------------------------------------------------------
// 1. create_item
// ---------------------------------------------------------------------------

export async function createItem(params: Params): Promise<CallToolResult> {
  try {
    const denied = requireWrite()
    if (denied) return denied
    const ctx = buildCtx()

    if (params.dry_run !== false) {
      return toMcpSuccess({
        dry_run: true,
        action: 'create_item',
        would_create: {
          format: params.format,
          title_pt: params.title_pt,
          title_en: params.title_en,
          language: params.language,
          priority: params.priority,
          tags: params.tags,
        },
        message: 'Call again with dry_run: false to execute.',
      })
    }

    const rateCheck = checkRateGovernor(ctx.keyHash ?? 'anonymous', 'single')
    if (!rateCheck.allowed) {
      return toMcpError({
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Retry after ${rateCheck.retryAfterSeconds}s`,
      })
    }

    // Wrap single item into the items array the service expects
    const { dry_run: _dr, ...itemData } = params
    const result = await svc.createItems(ctx, { items: [itemData] })
    return toMcpSuccess(result.data, result.meta ? { ...result.meta } : undefined)
  } catch (err) {
    return toMcpError(toPipelineServiceError(err))
  }
}

// ---------------------------------------------------------------------------
// 2. update_item
// ---------------------------------------------------------------------------

export async function updateItem(params: Params): Promise<CallToolResult> {
  try {
    const denied = requireWrite()
    if (denied) return denied
    const ctx = buildCtx()
    const id = params.id as string

    if (params.dry_run !== false) {
      // Fetch current to show field-by-field diff
      const current = await svc.getItem(ctx, id)
      const currentData = current.data as Record<string, unknown>
      const changes = Object.entries(params)
        .filter(([k, v]) => !['id', 'dry_run'].includes(k) && v !== undefined)
        .map(([k, v]) => ({
          field: k,
          from: currentData[k],
          to: v,
        }))
      return toMcpSuccess({
        dry_run: true,
        action: 'update_item',
        target: { id, title: currentData.title_pt ?? currentData.title_en },
        changes,
        message: 'Call again with dry_run: false to execute.',
      })
    }

    const rateCheck = checkRateGovernor(ctx.keyHash ?? 'anonymous', 'single')
    if (!rateCheck.allowed) {
      return toMcpError({
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Retry after ${rateCheck.retryAfterSeconds}s`,
      })
    }

    // Fetch current version for optimistic concurrency (MCP callers
    // don't manage versions explicitly -- we handle it transparently)
    const current = await svc.getItem(ctx, id)
    const expectedVersion = (current.data as Record<string, unknown>).version as number

    const { id: _id, dry_run: _dr, ...body } = params
    const result = await svc.updateItem(ctx, id, { body, expectedVersion })
    return toMcpSuccess(result.data, result.meta ? { ...result.meta } : undefined)
  } catch (err) {
    return toMcpError(toPipelineServiceError(err))
  }
}

// ---------------------------------------------------------------------------
// 3. advance_item (forward + backward)
// ---------------------------------------------------------------------------

export async function advanceItem(params: Params): Promise<CallToolResult> {
  try {
    const denied = requireWrite()
    if (denied) return denied
    const ctx = buildCtx()
    const id = params.id as string
    const direction = (params.direction as string) ?? 'forward'
    const dryRun = params.dry_run !== false

    if (dryRun) {
      // Fetch current to show stage transition preview
      const current = await svc.getItem(ctx, id)
      const currentStage = (current.data as Record<string, unknown>).stage
      if (direction === 'backward') {
        return toMcpSuccess({
          dry_run: true,
          action: 'advance_item',
          target: { id, title: (current.data as Record<string, unknown>).title_pt ?? (current.data as Record<string, unknown>).title_en },
          current_stage: currentStage,
          direction: 'backward',
          message: 'Call again with dry_run: false to execute.',
        })
      }
      // Forward dry run via service
      const result = await svc.advanceItem(ctx, id, { dryRun: true })
      const meta: Record<string, unknown> = result.meta ? { ...result.meta } : {}
      if (result.warnings && result.warnings.length > 0) {
        meta.warnings = result.warnings
      }
      return toMcpSuccess({
        ...result.data as Record<string, unknown>,
        action: 'advance_item',
        message: 'Call again with dry_run: false to execute.',
      }, Object.keys(meta).length > 0 ? meta : undefined)
    }

    const rateCheck = checkRateGovernor(ctx.keyHash ?? 'anonymous', 'single')
    if (!rateCheck.allowed) {
      return toMcpError({
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Retry after ${rateCheck.retryAfterSeconds}s`,
      })
    }

    if (direction === 'backward') {
      const result = await svc.retreatItem(ctx, id)
      return toMcpSuccess(result.data, result.meta ? { ...result.meta } : undefined)
    }

    // Forward execute
    const result = await svc.advanceItem(ctx, id, { dryRun: false })
    const meta: Record<string, unknown> = result.meta ? { ...result.meta } : {}
    if (result.warnings && result.warnings.length > 0) {
      meta.warnings = result.warnings
    }
    return toMcpSuccess(result.data, Object.keys(meta).length > 0 ? meta : undefined)
  } catch (err) {
    return toMcpError(toPipelineServiceError(err))
  }
}

// ---------------------------------------------------------------------------
// 5. delete_item (archive)
// ---------------------------------------------------------------------------

export async function deleteItem(params: Params): Promise<CallToolResult> {
  try {
    const denied = requireWrite()
    if (denied) return denied
    const ctx = buildCtx()
    const id = params.id as string
    const confirm = params.confirm === true
    const confirmationToken = params.confirmation_token as string | undefined

    // Safety: default to preview unless dry_run is explicitly false
    if (params.dry_run !== false) {
      const result = await svc.archiveItem(ctx, id, { dryRun: true })
      void result
      return formatDryRunResult(
        'delete_item',
        { id },
        [{ entity: 'pipeline_item', id, field: 'is_archived', from: false, to: true }],
      )
    }

    // Even with dry_run: false, require confirmation for destructive op
    if (!confirm && !confirmationToken) {
      return formatDryRunResult(
        'delete_item',
        { id },
        [{ entity: 'pipeline_item', id, field: 'is_archived', from: false, to: true }],
      )
    }

    if (confirmationToken) {
      const valid = validateConfirmationToken(confirmationToken, 'delete_item', { id })
      if (!valid) {
        return toMcpError({
          code: 'VALIDATION_ERROR',
          message: 'Invalid or expired confirmation token. Request a new dry_run.',
        })
      }
    }

    const rateCheck = checkRateGovernor(ctx.keyHash ?? 'anonymous', 'destructive')
    if (!rateCheck.allowed) {
      return toMcpError({
        code: 'RATE_LIMITED',
        message: `Destructive rate limit exceeded. Retry after ${rateCheck.retryAfterSeconds}s`,
      })
    }

    const result = await svc.archiveItem(ctx, id)
    return toMcpSuccess(result.data)
  } catch (err) {
    return toMcpError(toPipelineServiceError(err))
  }
}

// ---------------------------------------------------------------------------
// 6. graduate_item
// ---------------------------------------------------------------------------

export async function graduateItem(params: Params): Promise<CallToolResult> {
  try {
    const denied = requireWrite()
    if (denied) return denied
    const ctx = buildCtx()
    const id = params.id as string
    const target = params.target as string
    const confirm = params.confirm === true
    const confirmationToken = params.confirmation_token as string | undefined

    if (params.dry_run !== false) {
      const result = await svc.graduateItem(ctx, id, { target }, { dryRun: true })
      void result
      return formatDryRunResult(
        'graduate_item',
        { id, target },
        [{ entity: 'pipeline_item', id, field: 'graduated_to', from: null, to: target }],
      )
    }

    if (!confirm && !confirmationToken) {
      return formatDryRunResult(
        'graduate_item',
        { id, target },
        [{ entity: 'pipeline_item', id, field: 'graduated_to', from: null, to: target }],
      )
    }

    if (confirmationToken) {
      const valid = validateConfirmationToken(confirmationToken, 'graduate_item', { id, target })
      if (!valid) {
        return toMcpError({
          code: 'VALIDATION_ERROR',
          message: 'Invalid or expired confirmation token. Request a new dry_run.',
        })
      }
    }

    const rateCheck = checkRateGovernor(ctx.keyHash ?? 'anonymous', 'destructive')
    if (!rateCheck.allowed) {
      return toMcpError({
        code: 'RATE_LIMITED',
        message: `Destructive rate limit exceeded. Retry after ${rateCheck.retryAfterSeconds}s`,
      })
    }

    const result = await svc.graduateItem(ctx, id, { target })
    return toMcpSuccess(result.data)
  } catch (err) {
    return toMcpError(toPipelineServiceError(err))
  }
}

// ---------------------------------------------------------------------------
// 7. publish_item
// ---------------------------------------------------------------------------

export async function publishItem(params: Params): Promise<CallToolResult> {
  try {
    const denied = requireWrite()
    if (denied) return denied
    const ctx = buildCtx()
    const id = params.id as string
    const scheduledAt = params.scheduled_at as string | undefined
    const confirm = params.confirm === true
    const confirmationToken = params.confirmation_token as string | undefined

    const targetStage = scheduledAt ? 'scheduled' : 'published'
    const publishBody = {
      targetStage,
      scheduledFor: scheduledAt ?? null,
    }

    if (params.dry_run !== false) {
      const result = await svc.publishItem(ctx, id, publishBody, { dryRun: true })
      void result
      return formatDryRunResult(
        'publish_item',
        { id, scheduled_at: scheduledAt },
        [{ entity: 'blog_post', id, field: 'status', from: 'draft', to: targetStage }],
      )
    }

    if (!confirm && !confirmationToken) {
      return formatDryRunResult(
        'publish_item',
        { id, scheduled_at: scheduledAt },
        [{ entity: 'blog_post', id, field: 'status', from: 'draft', to: targetStage }],
      )
    }

    if (confirmationToken) {
      const valid = validateConfirmationToken(
        confirmationToken,
        'publish_item',
        { id, scheduled_at: scheduledAt },
      )
      if (!valid) {
        return toMcpError({
          code: 'VALIDATION_ERROR',
          message: 'Invalid or expired confirmation token. Request a new dry_run.',
        })
      }
    }

    const rateCheck = checkRateGovernor(ctx.keyHash ?? 'anonymous', 'destructive')
    if (!rateCheck.allowed) {
      return toMcpError({
        code: 'RATE_LIMITED',
        message: `Destructive rate limit exceeded. Retry after ${rateCheck.retryAfterSeconds}s`,
      })
    }

    const result = await svc.publishItem(ctx, id, publishBody)
    return toMcpSuccess(result.data)
  } catch (err) {
    return toMcpError(toPipelineServiceError(err))
  }
}

// ---------------------------------------------------------------------------
// 8. bulk_items
// ---------------------------------------------------------------------------

export async function bulkItems(params: Params): Promise<CallToolResult> {
  try {
    const denied = requireWrite()
    if (denied) return denied
    const ctx = buildCtx()
    const operations = params.operations as unknown[]
    const confirm = params.confirm === true
    const confirmationToken = params.confirmation_token as string | undefined

    if (params.dry_run !== false) {
      const result = await svc.bulkOperate(ctx, { operations }, { dryRun: true })
      void result
      const changes = (operations as Array<{ id: string; op: string }>).map((op) => ({
        entity: 'pipeline_item',
        id: op.id,
        field: 'op',
        from: null as unknown,
        to: op.op,
      }))
      return formatDryRunResult('bulk_items', { operations }, changes)
    }

    if (!confirm && !confirmationToken) {
      const changes = (operations as Array<{ id: string; op: string }>).map((op) => ({
        entity: 'pipeline_item',
        id: op.id,
        field: 'op',
        from: null as unknown,
        to: op.op,
      }))
      return formatDryRunResult('bulk_items', { operations }, changes)
    }

    if (confirmationToken) {
      const valid = validateConfirmationToken(confirmationToken, 'bulk_items', { operations })
      if (!valid) {
        return toMcpError({
          code: 'VALIDATION_ERROR',
          message: 'Invalid or expired confirmation token. Request a new dry_run.',
        })
      }
    }

    const rateCheck = checkRateGovernor(ctx.keyHash ?? 'anonymous', 'bulk')
    if (!rateCheck.allowed) {
      return toMcpError({
        code: 'RATE_LIMITED',
        message: `Bulk rate limit exceeded. Retry after ${rateCheck.retryAfterSeconds}s`,
      })
    }

    const result = await svc.bulkOperate(ctx, { operations })
    return toMcpSuccess(result.data, result.meta ? { ...result.meta } : undefined)
  } catch (err) {
    return toMcpError(toPipelineServiceError(err))
  }
}
