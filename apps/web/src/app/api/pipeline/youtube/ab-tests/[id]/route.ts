import { NextRequest } from 'next/server'
import { authenticateRead, pipelineSuccess } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getAbTest } from '@/lib/pipeline/services/youtube'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params

  try {
    const ctx = authToServiceContext(auth)
    const test = await getAbTest(ctx, id)
    return pipelineSuccess(test, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
