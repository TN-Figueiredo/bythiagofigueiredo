import { type NextRequest } from 'next/server'
import { PipelineCreatePlaylistSchema } from '@/lib/pipeline/schemas'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listPlaylistsService, createPlaylistService } from '@/lib/pipeline/services/playlists'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const url = req.nextUrl
  const filters = {
    status: url.searchParams.get('status') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
  }

  try {
    const data = await listPlaylistsService(authToServiceContext(auth), filters)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineCreatePlaylistSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  try {
    const data = await createPlaylistService(authToServiceContext(auth), parsed.data)
    return pipelineSuccess(data, 201, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
