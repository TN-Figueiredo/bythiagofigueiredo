import { NextRequest } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { searchContent } from '@/lib/pipeline/services/utilities'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const q = req.nextUrl.searchParams.get('q') ?? ''
    const limitRaw = req.nextUrl.searchParams.get('limit')
    const response = await searchContent(ctx, q, {
      limit: limitRaw ? parseInt(limitRaw, 10) : undefined,
    })
    const headers = buildRateLimitHeaders(auth)
    return Response.json(response, { headers: headers ?? {} })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
