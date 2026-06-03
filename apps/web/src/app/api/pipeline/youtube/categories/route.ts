import { NextRequest } from 'next/server'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listCategories, updateCategoryKeywords, type CategoryUpdateInput } from '@/lib/pipeline/services/youtube'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await listCategories(ctx)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function PATCH(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const input = body as CategoryUpdateInput
  if (!input.id) return pipelineError('VALIDATION_ERROR', 'id required', 400, auth)
  if (!input.match_keywords) return pipelineError('VALIDATION_ERROR', 'match_keywords required', 400, auth)

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await updateCategoryKeywords(ctx, input)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
