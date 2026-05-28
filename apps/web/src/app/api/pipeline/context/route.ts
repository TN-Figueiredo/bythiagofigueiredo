import { NextRequest } from 'next/server'
import { authenticatePipeline, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { pipelineError } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listContext } from '@/lib/pipeline/services/utilities'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return pipelineError('UNAUTHORIZED', authResult.error, authResult.status)
  const { auth } = authResult

  try {
    const ctx = authToServiceContext(auth)
    const data = await listContext(ctx, {
      format: (req.nextUrl.searchParams.get('format') ?? undefined) as 'md' | 'compact' | undefined,
      group: req.nextUrl.searchParams.get('group') ?? undefined,
      skill: req.nextUrl.searchParams.get('skill') ?? undefined,
    })
    const headers = buildRateLimitHeaders(auth)
    return Response.json({ data }, { headers: headers ?? {} })
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
