import { type NextRequest } from 'next/server'
import { authenticateRead, authenticateWrite, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listResearchDecisions, createResearchDecision } from '@/lib/pipeline/services/research-decisions'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const params = req.nextUrl.searchParams

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await listResearchDecisions(ctx, {
      horizon: params.get('horizon') || undefined,
      theme_id: params.get('theme_id') || undefined,
      status: params.get('status')?.split(',') ?? undefined,
      limit: params.get('limit') ? parseInt(params.get('limit')!, 10) : undefined,
      offset: params.get('offset') ? parseInt(params.get('offset')!, 10) : undefined,
    })
    return pipelineSuccess(data.data, 200, auth, data.meta as Record<string, unknown>)
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

  try {
    const ctx = authToServiceContext(auth)
    const { data, status } = await createResearchDecision(ctx, body)
    return pipelineSuccess(data, status ?? 201, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
