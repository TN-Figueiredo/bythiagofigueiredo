import { NextRequest, NextResponse } from 'next/server'
import { authenticateIntel, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { requirePermission } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { claimNextTask } from '@/lib/pipeline/services/youtube'

export const dynamic = 'force-dynamic'

/**
 * Legacy claim endpoint — the Cowork path. It keeps claiming without channel filters,
 * so it now requires write/admin: the narrow {read,intelligence} key claims only through
 * POST .../task/claim, which forces channel_ids. `?status=` is gone: it used to let a
 * caller reopen an already-completed task.
 */
export async function GET(req: NextRequest) {
  const result = await authenticateIntel(req, { apiKeyOnly: true })
  if (result instanceof Response) return result
  const { auth } = result

  if (!requirePermission(auth, 'write')) {
    return pipelineError('FORBIDDEN', 'Insufficient permissions', 403, auth)
  }

  try {
    const ctx = authToServiceContext(auth)
    const { data: task } = await claimNextTask(ctx)

    if (!task) return new NextResponse(null, { status: 204 })

    return pipelineSuccess(task, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
