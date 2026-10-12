import { NextRequest } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listContext } from '@/lib/pipeline/services/utilities'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const data = await listContext(ctx, {
      format: (req.nextUrl.searchParams.get('format') ?? undefined) as 'md' | 'compact' | undefined,
      group: req.nextUrl.searchParams.get('group') ?? undefined,
      skill: req.nextUrl.searchParams.get('skill') ?? undefined,
    })
    const headers = buildRateLimitHeaders(auth)
    return Response.json({ data }, { headers: headers ?? {} })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
