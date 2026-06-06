import { NextRequest, NextResponse } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead, authenticateWrite, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listTrackedLinks, createTrackedLink } from '@/lib/pipeline/services/links'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const params = req.nextUrl.searchParams

  try {
    const ctx = authToServiceContext(auth)
    const activeParam = params.get('active')
    const { data } = await listTrackedLinks(ctx, {
      utm_campaign: params.get('utm_campaign') || undefined,
      search: params.get('search') || undefined,
      active: activeParam === null ? undefined : activeParam === 'true',
      limit: params.get('limit') ? parseInt(params.get('limit')!, 10) : undefined,
      offset: params.get('offset') ? parseInt(params.get('offset')!, 10) : undefined,
    })
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json(data, { headers })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const { data, status } = await createTrackedLink(ctx, body)
    return pipelineSuccess(data, status ?? 201, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
