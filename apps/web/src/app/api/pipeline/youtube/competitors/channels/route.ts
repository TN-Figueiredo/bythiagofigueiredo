import { NextRequest } from 'next/server'
import { authenticateRead, pipelineSuccess } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listCompetitorChannels } from '@/lib/pipeline/services/competitors'

export const dynamic = 'force-dynamic'
// A5 · E7 (Lote 2): as medidas por canal pedem mais tempo que a lista de hoje; o prazo do pedido (40 s) cabe nos 60 s
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const { data } = await listCompetitorChannels(ctx)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
