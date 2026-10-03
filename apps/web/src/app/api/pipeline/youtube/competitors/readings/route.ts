import { NextRequest } from 'next/server'
import { authenticateIntel, parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { completeReading, readSent, ReadingSubmissionSchema } from '@/lib/pipeline/services/forja-queue'

export const dynamic = 'force-dynamic'
/**
 * The site-side half of the forja's coupled budget (CLAUDE.md): claim → last site request stays under the worker's
 * 20 min, below the cron's 25 min and the vigia's 30 min. Same ceiling as the intelligence route; the worker's POST
 * timeout (T_POST) is this value.
 */
export const maxDuration = 60

/**
 * GET ?task_id=<uuid> → {task_id, task_type, target, sent}. The first read builds `sent` and freezes it into the task;
 * every later read returns the same frozen object. 409 when the task is not running or is held by another key.
 */
export async function GET(req: NextRequest) {
  const result = await authenticateIntel(req, { apiKeyOnly: true })
  if (result instanceof Response) return result
  const { auth } = result

  const taskId = req.nextUrl.searchParams.get('task_id')
  if (!taskId || !UUID_REGEX.test(taskId)) return pipelineError('VALIDATION_ERROR', 'task_id: required uuid', 400, auth)

  try {
    const { data } = await readSent(authToServiceContext(auth), taskId)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

/**
 * POST a reading for a running observatory task → {reading_id}. The body shape is parsed here (the same schema the
 * service re-checks); completeReading validates the numbers against sent.numbers and the evidence against sent.ids
 * (400), and the task state (409).
 */
export async function POST(req: NextRequest) {
  const result = await authenticateIntel(req, { apiKeyOnly: true })
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req, ReadingSubmissionSchema, auth)
  if (body instanceof Response) return body

  try {
    const { data } = await completeReading(authToServiceContext(auth), body)
    return pipelineSuccess({ reading_id: data.readingId }, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
