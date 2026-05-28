import { NextRequest, NextResponse } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead, authenticateWrite, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { PipelineServiceError } from '@/lib/pipeline/services/types'
import { getIntelligenceSnapshot, submitIntelRecommendations, type IntelRecommendations } from '@/lib/pipeline/services/youtube'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const channelId = req.nextUrl.searchParams.get('channel_id')
  if (!channelId) return pipelineError('VALIDATION_ERROR', 'channel_id required', 400, auth)

  try {
    const ctx = authToServiceContext(auth)
    const response = await getIntelligenceSnapshot(ctx, channelId)
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json(response, { headers: headers ?? {} })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function PATCH(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const response = await submitIntelRecommendations(ctx, body as IntelRecommendations)
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json(response, { headers: headers ?? {} })
  } catch (err) {
    if (err instanceof PipelineServiceError && err.code === 'VALIDATION_FAILED' && err.details) {
      const details = err.details as { details: unknown[] }
      return NextResponse.json({
        error: 'validation_failed',
        details: details.details,
      }, { status: err.status })
    }
    return serviceErrorToResponse(err, auth)
  }
}
