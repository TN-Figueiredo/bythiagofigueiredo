import { NextRequest } from 'next/server'
import { authenticateRead, pipelineSuccess } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listNicheSignals } from '@/lib/pipeline/services/niche-signals'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const limitRaw = new URL(req.url).searchParams.get('limit')
  const limit = limitRaw && /^\d{1,3}$/.test(limitRaw) ? parseInt(limitRaw, 10) : undefined

  try {
    const { data } = await listNicheSignals(authToServiceContext(auth), { limit })
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
