import { NextRequest } from 'next/server'
import { authenticateReadOrIntel, pipelineSuccess } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listOwnChannels } from '@/lib/pipeline/services/youtube'

export const dynamic = 'force-dynamic'

/**
 * The site's own YouTube channels, in registration order — how the forja (and Cowork)
 * DISCOVER which channels exist, with slug, language and niche.
 *
 * Accepts `read` OR `intelligence` (write/admin include both): the forja queue key holds
 * `intelligence` alone and the proxy's read key holds `read`, so neither has to change.
 * The service returns a fixed list of non-sensitive columns — no token, nothing from OAuth.
 */
export async function GET(req: NextRequest) {
  const result = await authenticateReadOrIntel(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const { data } = await listOwnChannels(authToServiceContext(auth))
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
