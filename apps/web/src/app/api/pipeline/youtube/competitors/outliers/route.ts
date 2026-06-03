import { NextRequest } from 'next/server'
import { authenticateRead, pipelineSuccess } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listCompetitorOutliers } from '@/lib/pipeline/services/competitors'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { searchParams } = new URL(req.url)
  const tier = searchParams.get('tier')
  const limitRaw = searchParams.get('limit')
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await listCompetitorOutliers(ctx, { tier, limit })
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
