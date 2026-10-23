import { NextRequest } from 'next/server'
import { authenticateWrite, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { dismissNicheSignal } from '@/lib/pipeline/services/niche-signals'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return pipelineError('VALIDATION_ERROR', 'Invalid JSON body', 400, auth)
  }

  try {
    const { data } = await dismissNicheSignal(authToServiceContext(auth), id, body)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
