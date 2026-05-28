import { NextRequest, NextResponse } from 'next/server'
import { authenticateRead, pipelineSuccess } from '@/lib/pipeline/helpers'
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
    const { data: task } = await claimNextTask(ctx, status)

    if (!task) {
      return new NextResponse(null, { status: 204 })
    }

    return pipelineSuccess(task, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
