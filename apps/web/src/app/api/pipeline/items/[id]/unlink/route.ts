import { NextRequest, NextResponse } from 'next/server'
import { authenticateWrite, pipelineSuccess, pipelineError } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { unlinkPostFromItem } from '@/lib/pipeline/blog-link'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const unlinkResult = await unlinkPostFromItem(id, auth.siteId, null)
  if (!unlinkResult.ok) return NextResponse.json({ error: { code: 'UNLINK_FAILED', message: unlinkResult.error } }, { status: 400 })

  return pipelineSuccess({ unlinked: true }, 200, auth)
}
