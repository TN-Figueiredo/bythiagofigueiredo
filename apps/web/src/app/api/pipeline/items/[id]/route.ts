import { NextRequest, NextResponse } from 'next/server'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { UUID_REGEX, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getItem, updateItem, archiveItem } from '@/lib/pipeline/services/items'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const serviceResult = await getItem(ctx, id)
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({
      data: serviceResult.data,
      meta: serviceResult.meta,
    }, { headers })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
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
    const serviceResult = await updateItem(ctx, id, { expectedVersion, body })
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({
      data: serviceResult.data,
      meta: serviceResult.meta,
    }, { headers })
  } catch (err) {
    if (err instanceof PipelineServiceError && err.code === 'VERSION_CONFLICT' && err.details) {
      const details = err.details as { current_version: number; your_version: number; current_state: unknown }
      return NextResponse.json({
        error: {
          code: 'VERSION_CONFLICT',
          message: err.message,
          details,
        },
      }, { status: 409 })
    }
    return serviceErrorToResponse(err, auth)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const serviceResult = await archiveItem(ctx, id)
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({ data: serviceResult.data }, { headers })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
