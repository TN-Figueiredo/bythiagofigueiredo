import { NextRequest } from 'next/server'
import { authenticateRead, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { resolveAudioAssets } from '@/lib/pipeline/services/audio'

export async function POST(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await resolveAudioAssets(ctx, body)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
