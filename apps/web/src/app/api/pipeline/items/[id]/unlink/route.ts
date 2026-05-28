import { NextRequest, NextResponse } from 'next/server'
import { authenticateWrite, pipelineSuccess, pipelineError } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { unlinkBlogPost } from '@/lib/pipeline/services/items'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const serviceResult = await unlinkBlogPost(ctx, id)
    return pipelineSuccess(serviceResult.data, 200, auth)
  } catch (err) {
    // Preserve the original error response format
    if (err instanceof PipelineServiceError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status },
      )
    }
    return serviceErrorToResponse(err, auth)
  }
}
