import { NextRequest, NextResponse } from 'next/server'
import { authenticateRead, authenticateWrite, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { UUID_REGEX, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getRecording, putRecording, RecordingPreconditionError } from './service'

// GET /api/pipeline/items/:id/recording?lang=pt
// Derive the current fala beats for the lang, reconcile against the durable ledger.
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
    const serviceResult = await getRecording(ctx, id, req.nextUrl.searchParams.get('lang'))
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({ data: serviceResult.data, meta: serviceResult.meta }, { headers })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

// PUT /api/pipeline/items/:id/recording?lang=pt
// Upsert the status of a single beat. Optional if_unmodified_since → 412 with current row.
// Does NOT touch content_pipeline.version.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const serviceResult = await putRecording(ctx, id, req.nextUrl.searchParams.get('lang'), body)
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({ data: serviceResult.data }, { headers })
  } catch (err) {
    if (err instanceof RecordingPreconditionError) {
      const headers = buildRateLimitHeaders(auth)
      return NextResponse.json({
        error: {
          code: 'PRECONDITION_FAILED',
          message: err.message,
          details: { current: err.current },
        },
      }, { status: 412, headers: headers ?? {} })
    }
    return serviceErrorToResponse(err, auth)
  }
}
