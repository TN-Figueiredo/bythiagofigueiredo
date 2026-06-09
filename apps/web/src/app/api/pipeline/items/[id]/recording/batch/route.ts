import { NextRequest, NextResponse } from 'next/server'
import { authenticateWrite, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { UUID_REGEX, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { batchRecording } from '../service'

// PATCH /api/pipeline/items/:id/recording/batch?lang=pt
// Multi-row upsert (max 100). Does NOT touch content_pipeline.version.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const serviceResult = await batchRecording(ctx, id, req.nextUrl.searchParams.get('lang'), body)
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({ data: serviceResult.data }, { headers })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
