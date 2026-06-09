import { NextRequest, NextResponse } from 'next/server'
import { authenticateWrite, pipelineError } from '@/lib/pipeline/helpers'
import { UUID_REGEX, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { purgeOrphans } from '../service'

// DELETE /api/pipeline/items/:id/recording/orphans?lang=pt
// Purge rows whose beat_id is absent from the current roteiro content (recomputed
// server-side). Returns the count purged. Does NOT touch content_pipeline.version.
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
    const serviceResult = await purgeOrphans(ctx, id, req.nextUrl.searchParams.get('lang'))
    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json({ data: serviceResult.data }, { headers })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
