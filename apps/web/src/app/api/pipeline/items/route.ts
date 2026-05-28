import { NextRequest } from 'next/server'
import { authenticateRead, authenticateWrite, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listItems, createItems, type CreateItemsParams } from '@/lib/pipeline/services/items'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const params = req.nextUrl.searchParams
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200)

  try {
    const ctx = authToServiceContext(auth)
    const serviceResult = await listItems(ctx, {
      limit,
      cursor: params.get('cursor') || undefined,
      sort: params.get('sort') || undefined,
      format: params.get('format') || undefined,
      stage: params.get('stage') || undefined,
      lang: params.get('lang') || undefined,
      archived: params.get('archived') || undefined,
      priority_min: params.get('priority_min') || undefined,
      priority_max: params.get('priority_max') || undefined,
      tag: params.get('tag') || undefined,
      parent_id: params.get('parent_id') || undefined,
      graduated: params.get('graduated') || undefined,
      assigned_to: params.get('assigned_to') || undefined,
      stale_days: params.get('stale_days') || undefined,
      search: params.get('search') || undefined,
    })
    return pipelineSuccess(serviceResult.data, 200, auth, serviceResult.meta)
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
    const serviceResult = await createItems(ctx, body as CreateItemsParams)
    return pipelineSuccess(serviceResult.data, 201, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
