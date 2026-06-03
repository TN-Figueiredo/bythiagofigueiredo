import { NextRequest } from 'next/server'
import { authenticateRead, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getAnalyticsGrades } from '@/lib/pipeline/services/youtube'

export const dynamic = 'force-dynamic'

const VALID_SORTS = new Set(['score', 'published_at', 'views'])

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const channelId = req.nextUrl.searchParams.get('channel_id')
  if (!channelId) return pipelineError('VALIDATION_ERROR', 'channel_id required', 400, auth)

  const sortParam = req.nextUrl.searchParams.get('sort') ?? 'score'
  if (!VALID_SORTS.has(sortParam)) {
    return pipelineError('VALIDATION_ERROR', 'sort must be score, published_at, or views', 400, auth)
  }
  const sort = sortParam as 'score' | 'published_at' | 'views'
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 50, 1), 200)

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await getAnalyticsGrades(ctx, channelId, sort, limit)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
