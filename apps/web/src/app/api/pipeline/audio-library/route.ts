import { NextRequest, NextResponse } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead, authenticateWrite, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listAudioAssets, createAudioAsset } from '@/lib/pipeline/services/audio'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const params = req.nextUrl.searchParams
  const rawLimit = Number(params.get('limit') || '50')
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.round(rawLimit) : 50, 200))

  try {
    const ctx = authToServiceContext(auth)
    const { data, meta } = await listAudioAssets(ctx, {
      limit,
      cursor: params.get('cursor') ?? undefined,
      type: params.get('type') ?? undefined,
      status: params.get('status') ?? undefined,
      category: params.get('category') ?? undefined,
      tags: params.get('tags') ?? undefined,
      mood: params.get('mood') ?? undefined,
      energy_min: params.get('energy_min') ?? undefined,
      energy_max: params.get('energy_max') ?? undefined,
      bpm_min: params.get('bpm_min') ?? undefined,
      bpm_max: params.get('bpm_max') ?? undefined,
      subcategory: params.get('subcategory') ?? undefined,
      genre: params.get('genre') ?? undefined,
      source: params.get('source') ?? undefined,
      reusable: params.get('reusable') ?? undefined,
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
    const { data, status = 201 } = await createAudioAsset(ctx, body)
    return pipelineSuccess(data, status, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
