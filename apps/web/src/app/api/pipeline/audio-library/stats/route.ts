import { NextRequest, NextResponse } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getAudioStats } from '@/lib/pipeline/services/audio'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await getAudioStats(ctx)
    return NextResponse.json({ data }, { headers: { ...buildRateLimitHeaders(auth), 'Cache-Control': 'private, max-age=30' } })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
