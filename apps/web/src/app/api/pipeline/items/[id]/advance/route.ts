import { NextRequest, NextResponse } from 'next/server'
import { authenticateWrite, pipelineError } from '@/lib/pipeline/helpers'
import { UUID_REGEX, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { advanceItem } from '@/lib/pipeline/services/items'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

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
    const serviceResult = await advanceItem(ctx, id)
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({
      data: serviceResult.data,
      meta: serviceResult.meta,
      ...(serviceResult.warnings && serviceResult.warnings.length > 0 ? { warnings: serviceResult.warnings } : {}),
    }, { headers })
  } catch (err) {
    // Preserve special error response formats
    if (err instanceof PipelineServiceError) {
      if (err.code === 'VVS_BELOW_THRESHOLD') {
        return NextResponse.json(
          { ok: false, error: 'VVS_BELOW_THRESHOLD', message: err.message },
          { status: 400 },
        )
      }
      if (err.code === 'DEPENDENCY_BLOCKED' && err.details) {
        return NextResponse.json({
          error: { code: 'DEPENDENCY_BLOCKED', message: err.message, details: err.details },
        }, { status: 409 })
      }
    }
    return serviceErrorToResponse(err, auth)
  }
}
