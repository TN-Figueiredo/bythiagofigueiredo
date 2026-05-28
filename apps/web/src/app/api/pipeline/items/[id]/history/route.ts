import { NextRequest } from 'next/server'
import { authenticateRead, pipelineSuccess, pipelineError } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getHistory } from '@/lib/pipeline/services/items'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200)

  try {
    const ctx = authToServiceContext(auth)
    const serviceResult = await getHistory(ctx, id, { limit })
    return pipelineSuccess(serviceResult.data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
