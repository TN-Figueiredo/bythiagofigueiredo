import { NextRequest, NextResponse } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead, authenticateWrite, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listBRollAssets, createBRollAsset } from '@/lib/pipeline/services/broll'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const params = req.nextUrl.searchParams
  const limit = Math.max(1, Math.min(parseInt(params.get('limit') || '50') || 50, 200))

  try {
    const ctx = authToServiceContext(auth)
    const { data, meta } = await listBRollAssets(ctx, {
      limit,
      cursor: params.get('cursor') ?? undefined,
      type: params.get('type') ?? undefined,
      status: params.get('status') ?? undefined,
      source_type: params.get('source_type') ?? undefined,
      category: params.get('category') ?? undefined,
      resolution: params.get('resolution') ?? undefined,
      tags: params.get('tags') ?? undefined,
      has_audio: params.get('has_audio') ?? undefined,
      reusable: params.get('reusable') ?? undefined,
      location: params.get('location') ?? undefined,
      q: params.get('q') ?? undefined,
    })
    return NextResponse.json({ data, meta }, { headers: buildRateLimitHeaders(auth) })
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
    const { data, status = 201 } = await createBRollAsset(ctx, body)
    return pipelineSuccess(data, status, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
