import { NextRequest } from 'next/server'
import { authenticateRead, pipelineSuccess } from '@/lib/pipeline/helpers'
import { serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { getDomainDocs } from '@/lib/pipeline/services/utilities'

export async function GET(req: NextRequest, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const data = await getDomainDocs(domain)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
