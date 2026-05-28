import { NextRequest, NextResponse } from 'next/server'
import { authenticateWrite, pipelineError } from '@/lib/pipeline/helpers'
import { UUID_REGEX, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { restoreItem } from '@/lib/pipeline/services/items'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const serviceResult = await restoreItem(ctx, id)
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({
      data: serviceResult.data,
      meta: serviceResult.meta,
    }, { headers })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
