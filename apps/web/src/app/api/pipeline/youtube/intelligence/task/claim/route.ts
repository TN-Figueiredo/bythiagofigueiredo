import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateIntel, parseBody, pipelineSuccess } from '@/lib/pipeline/helpers'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { claimNextTask } from '@/lib/pipeline/services/youtube'

export const dynamic = 'force-dynamic'

/**
 * channel_ids is required, not optional: the forja drains one channel list and must never
 * claim a task for a channel it cannot analyse (the EN channel has no videos at all).
 */
const ClaimSchema = z.object({
  channel_ids: z.array(z.string().uuid()).min(1).max(10),
})

export async function POST(req: NextRequest) {
  const result = await authenticateIntel(req, { apiKeyOnly: true })
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req, ClaimSchema, auth)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const { data: task } = await claimNextTask(ctx, body.channel_ids)

    // 204 means "empty queue, or the CAS went to someone else" — the worker retries next cycle.
    if (!task) return new NextResponse(null, { status: 204, headers: buildRateLimitHeaders(auth) })

    return pipelineSuccess(task, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
