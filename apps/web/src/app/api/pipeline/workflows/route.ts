import { NextRequest } from 'next/server'
import { WORKFLOWS, DEFAULT_CHECKLISTS } from '@/lib/pipeline/workflows'
import { authenticateRead, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  return pipelineSuccess({ workflows: WORKFLOWS, default_checklists: DEFAULT_CHECKLISTS }, 200, auth)
}
