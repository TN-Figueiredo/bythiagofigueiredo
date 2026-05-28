import { NextRequest, NextResponse } from 'next/server'
import { authenticateWrite, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { batchUpdateSections } from '@/lib/pipeline/services/items'

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const serviceResult = await batchUpdateSections(ctx, body)
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({
      results: serviceResult.data.results,
      summary: serviceResult.data.summary,
    }, { headers })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
