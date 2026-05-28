import { NextRequest } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getContextByKey, upsertContext, deleteContext, type ContextUpsertData } from '@/lib/pipeline/services/utilities'

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const data = await getContextByKey(ctx, key)
    const headers = buildRateLimitHeaders(auth)
    return Response.json({ data }, { headers: headers ?? {} })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const data = await upsertContext(ctx, key, body as ContextUpsertData)
    const headers = buildRateLimitHeaders(auth)
    return Response.json({ data }, { headers: headers ?? {} })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const data = await deleteContext(ctx, key)
    const headers = buildRateLimitHeaders(auth)
    return Response.json({ data }, { headers: headers ?? {} })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
