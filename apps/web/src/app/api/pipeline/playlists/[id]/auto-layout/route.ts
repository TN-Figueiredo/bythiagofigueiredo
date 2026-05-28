import { type NextRequest } from 'next/server'
import { authenticateWrite, pipelineSuccess } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { autoLayoutService } from '@/lib/pipeline/services/playlists'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId } = await params

  try {
    const data = await autoLayoutService(authToServiceContext(auth), playlistId)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
