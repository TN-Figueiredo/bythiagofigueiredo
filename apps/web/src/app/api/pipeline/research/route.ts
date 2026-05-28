import { NextRequest, NextResponse } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listResearchItems, createResearchItem } from '@/lib/pipeline/services/research'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const params = req.nextUrl.searchParams
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200)

  try {
    const ctx = authToServiceContext(auth)
    const { data, meta } = await listResearchItems(ctx, {
      limit,
      cursor: params.get('cursor') || undefined,
      includeContent: params.get('include') === 'content',
      topicId: params.get('topic_id') || undefined,
      topicSlug: params.get('topic_slug') || undefined,
      status: params.get('status')?.split(',') ?? undefined,
      search: params.get('search') || undefined,
      pipelineItemId: params.get('pipeline_item_id') || undefined,
    })

    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({ data, meta }, { headers })
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
    const result = await createResearchItem(ctx, body)

    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({ data: result.data }, { status: result.data.upserted ? 200 : 201, headers })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
