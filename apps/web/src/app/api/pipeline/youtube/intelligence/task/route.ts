import { NextRequest, NextResponse } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { claimNextTask } from '@/lib/pipeline/services/youtube'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const status = req.nextUrl.searchParams.get('status') ?? 'pending'

  try {
    const ctx = authToServiceContext(auth)
    const task = await claimNextTask(ctx, status)

    if (!task) {
      return new NextResponse(null, { status: 204 })
    }

    const headers = buildRateLimitHeaders(auth)
    return NextResponse.json(task, { headers: headers ?? {} })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
