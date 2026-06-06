import { type NextRequest } from 'next/server'
import { authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import {
  linkDecisionToResearch,
  unlinkDecisionFromResearch,
} from '@/lib/pipeline/services/research-decisions'

/** Link a research item to this decision. Body: { research_id, note? }. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id } = await params

  const body = await parseBody(req)
  if (body instanceof Response) return body
  const { research_id, note } = (body ?? {}) as { research_id?: unknown; note?: unknown }
  if (typeof research_id !== 'string') {
    return pipelineError('VALIDATION_ERROR', 'research_id is required', 400, auth)
  }

  try {
    const ctx = authToServiceContext(auth)
    const { data, status } = await linkDecisionToResearch(
      ctx,
      id,
      research_id,
      typeof note === 'string' ? note : undefined,
    )
    return pipelineSuccess(data, status ?? 201, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

/** Unlink a research item from this decision. Query: ?research_id=<uuid>. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id } = await params

  const researchId = req.nextUrl.searchParams.get('research_id')
  if (!researchId) {
    return pipelineError('VALIDATION_ERROR', 'research_id query param is required', 400, auth)
  }

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await unlinkDecisionFromResearch(ctx, id, researchId)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
