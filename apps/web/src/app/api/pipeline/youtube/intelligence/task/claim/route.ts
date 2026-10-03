import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateIntel, parseBody, pipelineSuccess } from '@/lib/pipeline/helpers'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { claimNextTask } from '@/lib/pipeline/services/youtube'
import { claim, OBS_TYPES } from '@/lib/pipeline/services/forja-queue'

export const dynamic = 'force-dynamic'

/**
 * channel_ids is required, not optional: the forja drains one channel list and must never
 * claim a task for a channel it cannot analyse (the EN channel has no videos at all).
 *
 * task_types (observatory, optional): the reading types the forja announces (OBS_TIPOS=1 on the machine). Only then
 * is the claim widened to those types and the heartbeat written with them as capabilities (ruling R52). A body
 * without task_types is today's production worker: exactly the old claim, 'diagnostico' only, no heartbeat.
 */
const ClaimSchema = z.object({
  channel_ids: z.array(z.string().uuid()).min(1).max(10),
  // min(1): the kit sends all its types (OBS_TIPOS=1) or omits the key; [] would be a heartbeat with no capability
  task_types: z.array(z.enum(OBS_TYPES)).min(1).max(OBS_TYPES.length).optional(),
})

export async function POST(req: NextRequest) {
  const result = await authenticateIntel(req, { apiKeyOnly: true })
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req, ClaimSchema, auth)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const { data: task } = body.task_types
      ? await claim(ctx, { channelIds: body.channel_ids, taskTypes: body.task_types }, Date.now(), { heartbeat: { capabilities: body.task_types } })
      : await claimNextTask(ctx, body.channel_ids)

    // 204 means "empty queue, or the CAS went to someone else" — the worker retries next cycle.
    if (!task) return new NextResponse(null, { status: 204, headers: buildRateLimitHeaders(auth) })

    return pipelineSuccess(task, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
