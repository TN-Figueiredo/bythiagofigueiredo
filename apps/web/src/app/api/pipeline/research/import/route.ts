import { NextRequest, NextResponse } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { importResearchItems } from '@/lib/pipeline/services/research'

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const data = await importResearchItems(ctx, body)

    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({ data }, { headers })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
