import { NextRequest, NextResponse } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getResearchItem, updateResearchItem, deleteResearchItem } from '@/lib/pipeline/services/research'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const { data, meta } = await getResearchItem(ctx, id)

    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({ data, meta }, { headers })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const expectedVersionRaw = req.headers.get('X-Expected-Version') ?? req.headers.get('If-Match')
  if (!expectedVersionRaw) return pipelineError('VALIDATION_ERROR', 'X-Expected-Version header required', 400, auth)
  const expectedVersion = parseInt(expectedVersionRaw)

  const body = await parseBody(req)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const { data, meta } = await updateResearchItem(ctx, id, body, expectedVersion)

    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({ data, meta }, { headers })
  } catch (err) {
    if (err instanceof PipelineServiceError && err.code === 'VERSION_CONFLICT') {
      return NextResponse.json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      }, { status: err.status })
    }
    return serviceErrorToResponse(err, auth)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const data = await deleteResearchItem(ctx, id)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
