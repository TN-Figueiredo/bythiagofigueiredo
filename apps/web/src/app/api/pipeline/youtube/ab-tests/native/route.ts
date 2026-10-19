import { NextRequest } from 'next/server'
import { authenticateRead, pipelineSuccess } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listNativeTests } from '@/lib/pipeline/services/youtube-native'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result
  const sp = req.nextUrl.searchParams
  try {
    const ctx = authToServiceContext(auth)
    const { data } = await listNativeTests(ctx, {
      youtubeVideoId: sp.get('video_id') ?? undefined,
      estado: sp.get('estado') ?? undefined,
    })
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
