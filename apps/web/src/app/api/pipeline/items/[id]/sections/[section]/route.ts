import { NextRequest, NextResponse } from 'next/server'
import { authenticateRead, authenticateWrite, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { UUID_REGEX, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getSection, patchSection } from '@/lib/pipeline/services/items'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

type RouteParams = { params: Promise<{ id: string; section: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id, section } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID', 400)
  }

  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const lang = req.nextUrl.searchParams.get('lang') || 'en'

  try {
    const ctx = authToServiceContext(auth)
    const serviceResult = await getSection(ctx, id, { section, lang })
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({
      data: serviceResult.data,
      meta: serviceResult.meta,
    }, { headers })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, section } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID', 400)
  }

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const expectedVersionRaw = req.headers.get('X-Expected-Version') ?? req.headers.get('If-Match')
  if (!expectedVersionRaw) {
    return pipelineError('VALIDATION_ERROR', 'X-Expected-Version header required', 400, auth)
  }
  const expectedVersion = parseInt(expectedVersionRaw)

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const lang = req.nextUrl.searchParams.get('lang') || 'en'

  try {
    const ctx = authToServiceContext(auth)
    const serviceResult = await patchSection(ctx, id, { section, lang, expectedVersion, body })
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({
      data: serviceResult.data,
      meta: serviceResult.meta,
    }, { headers })
  } catch (err) {
    // Preserve special error response formats for section conflicts
    if (err instanceof PipelineServiceError) {
      if (err.code === 'PRECONDITION_FAILED' && err.details) {
        return NextResponse.json({
          error: { code: 'PRECONDITION_FAILED', message: err.message, ...(err.details as Record<string, unknown>) },
        }, { status: 412 })
      }
      if (err.code === 'CONFLICT' && err.details) {
        return NextResponse.json({
          error: { code: 'CONFLICT', message: err.message, ...(err.details as Record<string, unknown>) },
        }, { status: 409 })
      }
    }
    return serviceErrorToResponse(err, auth)
  }
}
