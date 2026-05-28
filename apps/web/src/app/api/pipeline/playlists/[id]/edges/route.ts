import { type NextRequest } from 'next/server'
import { PipelineCreateEdgeSchema } from '@/lib/pipeline/schemas'
import { authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { createEdgeService } from '@/lib/pipeline/services/playlists'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId } = await params

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineCreateEdgeSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  try {
    const { data, status = 200 } = await createEdgeService(authToServiceContext(auth), playlistId, parsed.data)
    return pipelineSuccess({ id: data.id, already_existed: data.already_existed }, status, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
