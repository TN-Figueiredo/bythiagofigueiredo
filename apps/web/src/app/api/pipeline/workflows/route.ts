import { NextRequest } from 'next/server'
import { authenticateRead, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getWorkflows } from '@/lib/pipeline/services/utilities'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  return pipelineSuccess(getWorkflows(), 200, auth)
}
