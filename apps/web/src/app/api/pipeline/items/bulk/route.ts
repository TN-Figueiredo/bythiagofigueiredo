import { NextRequest } from 'next/server'
import { authenticateWrite, pipelineSuccess, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { bulkOperate } from '@/lib/pipeline/services/items'

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const serviceResult = await bulkOperate(ctx, body)
    const allOk = serviceResult.data.failure_count === 0
    return pipelineSuccess(serviceResult.data, allOk ? 200 : 409, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
