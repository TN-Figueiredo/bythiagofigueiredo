import { NextRequest } from 'next/server'
import { z } from 'zod'
import { authenticateIntel, parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { failTask } from '@/lib/pipeline/services/youtube'

export const dynamic = 'force-dynamic'

const FailSchema = z.object({
  reason: z.string().max(500),
  retry: z.boolean().optional(),
})

/** Thin adapter: authenticate, validate, delegate. The CAS and both outcomes live in failTask. */
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
    const { data } = await failTask(ctx, id, body)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
