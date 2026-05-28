import { NextRequest } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getTopicAggregation } from '@/lib/pipeline/services/utilities'

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const data = await getTopicAggregation(ctx, code)
    const headers = buildRateLimitHeaders(auth)
    return Response.json({ data }, { headers: headers ?? {} })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
