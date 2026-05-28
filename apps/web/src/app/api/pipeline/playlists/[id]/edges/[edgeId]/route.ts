import { type NextRequest } from 'next/server'
import { authenticateWrite, pipelineSuccess } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { deleteEdgeService } from '@/lib/pipeline/services/playlists'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; edgeId: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId, edgeId } = await params

  try {
    const data = await deleteEdgeService(authToServiceContext(auth), playlistId, edgeId)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
