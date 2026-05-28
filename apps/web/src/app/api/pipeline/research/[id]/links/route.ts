import { NextRequest } from 'next/server'
import { authenticateWrite, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { addResearchLink } from '@/lib/pipeline/services/research'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await addResearchLink(ctx, id, body)
    return pipelineSuccess(data, 201, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
