import { NextRequest } from 'next/server'
import { z } from 'zod'
import { authenticateRead, authenticateWrite, parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { fetchUpNextData } from '@/lib/pipeline/up-next-fetcher'
import { buildScheduledAt } from '@/lib/pipeline/build-scheduled-at'
import { SITE_TIMEZONE } from '@/lib/pipeline/up-next-constants'

const ParamsSchema = z.object({
  maxCards: z.coerce.number().int().min(1).max(10).default(5),
  tz: z.string().refine((val) => {
    try { Intl.DateTimeFormat(undefined, { timeZone: val }); return true }
    catch { return false }
  }, 'Invalid IANA timezone').default(SITE_TIMEZONE),
})

const AssignSlotSchema = z.object({
  itemId: z.string().uuid(),
  slotDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotHour: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().default(null),
  previousItemId: z.string().uuid().optional(),
})

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const params = ParamsSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!params.success) {
    return pipelineError('VALIDATION_ERROR', params.error.message, 400, auth)
  }

  const { maxCards, tz } = params.data
  const supabase = getSupabaseServiceClient()
  const response = await fetchUpNextData(supabase, auth.siteId, tz, new Date(), maxCards)

  return pipelineSuccess(response, 200, auth)
}

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const params = AssignSlotSchema.safeParse(body)
  if (!params.success) {
    return pipelineError('VALIDATION_ERROR', params.error.message, 400, auth)
  }

  const { itemId, slotDay, slotHour, previousItemId } = params.data
  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const scheduledAt = buildScheduledAt(slotDay, slotHour, SITE_TIMEZONE)
  const { data, error } = await supabase
    .from('content_pipeline')
    .update({ scheduled_at: scheduledAt, updated_at: now })
    .eq('id', itemId)
    .eq('site_id', auth.siteId)
    .select('id, scheduled_at')
    .single()

  if (error || !data) {
    return pipelineError('NOT_FOUND', 'Item not found or not accessible', 404, auth)
  }

  if (previousItemId && previousItemId !== itemId) {
    const { error: clearError } = await supabase
      .from('content_pipeline')
      .update({ scheduled_at: null, updated_at: now })
      .eq('id', previousItemId)
      .eq('site_id', auth.siteId)

    if (clearError) {
      // Rollback: restore new item to unscheduled so both aren't in the same slot
      await supabase
        .from('content_pipeline')
        .update({ scheduled_at: null, updated_at: now })
        .eq('id', itemId)
        .eq('site_id', auth.siteId)

      return pipelineError('SWAP_FAILED', 'Falha ao trocar item do slot', 500, auth)
    }
  }

  return pipelineSuccess(data, 200, auth)
}
