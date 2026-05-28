import { type NextRequest } from 'next/server'
import { PipelineUpdatePlaylistSchema } from '@/lib/pipeline/schemas'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getPlaylistService, updatePlaylistService, deletePlaylistService } from '@/lib/pipeline/services/playlists'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id } = await params

  try {
    const data = await getPlaylistService(authToServiceContext(auth), id)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id } = await params

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineUpdatePlaylistSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  try {
    const data = await updatePlaylistService(authToServiceContext(auth), id, parsed.data)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id } = await params

  try {
    const data = await deletePlaylistService(authToServiceContext(auth), id)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
