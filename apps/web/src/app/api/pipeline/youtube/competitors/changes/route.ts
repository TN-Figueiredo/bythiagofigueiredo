import { NextRequest } from 'next/server'
import { authenticateRead, pipelineSuccess } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listCompetitorChanges } from '@/lib/pipeline/services/competitors'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const bookmarkedRaw = searchParams.get('bookmarked')
  const limitRaw = searchParams.get('limit')

  const bookmarked = bookmarkedRaw === 'true' ? true : bookmarkedRaw === 'false' ? false : null
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await listCompetitorChanges(ctx, { type, bookmarked, limit })
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
