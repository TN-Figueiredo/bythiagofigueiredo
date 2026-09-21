import { NextRequest } from 'next/server'
import { authenticateIntel, authenticateRead, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getIntelligenceSnapshot, submitIntelRecommendations } from '@/lib/pipeline/services/youtube'

export const dynamic = 'force-dynamic'
/**
 * Module-level ceiling, so it binds the snapshot GET below as well as the PATCH.
 * It is the site-side half of the timing invariant: claim → last request stays under
 * 25 min + 30 s, below the watchdog's 30 min (STALE_THRESHOLD_MINUTES).
 */
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const channelId = req.nextUrl.searchParams.get('channel_id')
  if (!channelId) return pipelineError('VALIDATION_ERROR', 'channel_id required', 400, auth)

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await getIntelligenceSnapshot(ctx, channelId)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function PATCH(req: NextRequest) {
  const result = await authenticateIntel(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req, undefined, auth)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await submitIntelRecommendations(ctx, body)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
