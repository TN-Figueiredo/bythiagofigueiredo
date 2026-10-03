import { NextRequest } from 'next/server'
import { z } from 'zod'
import { authenticateIntel, parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { failTask } from '@/lib/pipeline/services/youtube'
import { refuseTask } from '@/lib/pipeline/services/forja-queue'

export const dynamic = 'force-dynamic'

/**
 * retry: back to the queue (failTask; it clears released_at, R27). refuse (observatory only): the forja declines the
 * task, e.g. 'dado-velho' — refuseTask, which does not use the quota. The two are mutually exclusive.
 */
const FailSchema = z.object({
  reason: z.string().max(500),
  retry: z.boolean().optional(),
  refuse: z.boolean().optional(),
}).refine(b => !(b.refuse === true && b.retry === true), { message: 'refuse and retry are mutually exclusive', path: ['refuse'] })

/** Thin adapter: authenticate, validate, delegate. The CAS and every outcome live in failTask / refuseTask. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await authenticateIntel(req, { apiKeyOnly: true })
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params
  if (!UUID_REGEX.test(id)) return pipelineError('VALIDATION_ERROR', 'id: invalid uuid', 400, auth)

  const body = await parseBody(req, FailSchema, auth)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    if (body.refuse === true) {
      const { data } = await refuseTask(ctx, id, body.reason)
      return pipelineSuccess(data, 200, auth)
    }
    const { data } = await failTask(ctx, id, { reason: body.reason, ...(body.retry !== undefined ? { retry: body.retry } : {}) })
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
