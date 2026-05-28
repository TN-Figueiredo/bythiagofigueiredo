/**
 * MCP adapter for pipeline items service.
 *
 * Translates flat MCP tool parameters into ServiceContext-based calls
 * and returns CallToolResult.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { toMcpError, toMcpSuccess, toPipelineServiceError } from '../errors'
import {
  generateConfirmationToken,
  validateConfirmationToken,
  checkRateGovernor,
  formatDryRunResult,
} from '../safety'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
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
  }
}

// ---------------------------------------------------------------------------
// 1. create_item
// ---------------------------------------------------------------------------

export async function createItem(params: Params): Promise<CallToolResult> {
  try {
    const ctx = buildCtx()

    if (params.dry_run) {
      return toMcpSuccess({
        dry_run: true,
        would_create: {
          format: params.format,
          title_pt: params.title_pt,
          title_en: params.title_en,
          language: params.language,
          priority: params.priority,
          tags: params.tags,
        },
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
    const ctx = buildCtx()
    const id = params.id as string

    if (params.dry_run) {
      // Fetch current to show what would change
      const current = await svc.getItem(ctx, id)
      return toMcpSuccess({
        dry_run: true,
        current: current.data,
        would_update: Object.fromEntries(
          Object.entries(params).filter(
            ([k]) => !['id', 'dry_run'].includes(k) && params[k] !== undefined,
          ),
        ),
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
    const ctx = buildCtx()
    const id = params.id as string
    const direction = (params.direction as string) ?? 'forward'
    const dryRun = params.dry_run === true

    const rateCheck = checkRateGovernor(ctx.keyHash ?? 'anonymous', 'single')
    if (!rateCheck.allowed) {
      return toMcpError({
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Retry after ${rateCheck.retryAfterSeconds}s`,
      })
    }

    if (direction === 'backward') {
      if (dryRun) {
        // For dry run on retreat, fetch current to show transition
        const current = await svc.getItem(ctx, id)
        return toMcpSuccess({
          dry_run: true,
          current_stage: (current.data as Record<string, unknown>).stage,
          direction: 'backward',
        })
      }
      const result = await svc.retreatItem(ctx, id)
      return toMcpSuccess(result.data, result.meta ? { ...result.meta } : undefined)
    }

    // Forward
    const result = await svc.advanceItem(ctx, id, { dryRun })
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
    const ctx = buildCtx()
    const id = params.id as string
    const dryRun = params.dry_run === true
    const confirm = params.confirm === true
    const confirmationToken = params.confirmation_token as string | undefined

    // Safety: dry_run always previews
    if (dryRun) {
      const result = await svc.archiveItem(ctx, id, { dryRun: true })
      return formatDryRunResult(
        'delete_item',
        { id },
        [{ entity: 'pipeline_item', id, field: 'is_archived', from: false, to: true }],
      )
    }

    // Safety: require confirmation for destructive op
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
    const ctx = buildCtx()
    const id = params.id as string
    const target = params.target as string
    const dryRun = params.dry_run === true
    const confirm = params.confirm === true
    const confirmationToken = params.confirmation_token as string | undefined

    if (dryRun) {
      const result = await svc.graduateItem(ctx, id, { target }, { dryRun: true })
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
    const ctx = buildCtx()
    const id = params.id as string
    const scheduledAt = params.scheduled_at as string | undefined
    const dryRun = params.dry_run === true
    const confirm = params.confirm === true
    const confirmationToken = params.confirmation_token as string | undefined

    const targetStage = scheduledAt ? 'scheduled' : 'published'
    const publishBody = {
      targetStage,
      scheduledFor: scheduledAt ?? null,
    }

    if (dryRun) {
      const result = await svc.publishItem(ctx, id, publishBody, { dryRun: true })
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
    const ctx = buildCtx()
    const operations = params.operations as unknown[]
    const dryRun = params.dry_run === true
    const confirm = params.confirm === true
    const confirmationToken = params.confirmation_token as string | undefined

    if (dryRun) {
      const result = await svc.bulkOperate(ctx, { operations }, { dryRun: true })
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
