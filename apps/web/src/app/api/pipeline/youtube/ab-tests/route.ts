import { NextRequest } from 'next/server'
import { authenticateRead, pipelineSuccess } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listAbTests } from '@/lib/pipeline/services/youtube'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await listAbTests(ctx, { status })
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
