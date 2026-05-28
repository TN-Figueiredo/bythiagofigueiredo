import { NextRequest } from 'next/server'
import { authenticateWrite, pipelineSuccess, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { linkBlogPost } from '@/lib/pipeline/services/items'
import { PipelineServiceError } from '@/lib/pipeline/services/types'
import { NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const serviceResult = await linkBlogPost(ctx, id, body)
    return pipelineSuccess(serviceResult.data, 200, auth)
  } catch (err) {
    // Preserve the original error response format for link errors
    if (err instanceof PipelineServiceError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status },
      )
    }
    return serviceErrorToResponse(err, auth)
  }
}
