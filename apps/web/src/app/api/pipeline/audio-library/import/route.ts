import { NextRequest, NextResponse } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { importAudioAssets } from '@/lib/pipeline/services/audio'

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await importAudioAssets(ctx, body)
    return NextResponse.json({ data }, { headers: buildRateLimitHeaders(auth) })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
