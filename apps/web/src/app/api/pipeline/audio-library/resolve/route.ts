import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateRead, pipelineSuccess, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { ResolveQuerySchema } from '@/lib/pipeline/audio-schemas'
import { resolveAudio } from '@/lib/pipeline/audio-resolver'
import { pipelineLog } from '@/lib/pipeline/logger'

export async function POST(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = ResolveQuerySchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)
  }

  const supabase = getSupabaseServiceClient()
  let resolveResult
  try {
    resolveResult = await resolveAudio(supabase, auth.siteId, parsed.data)
  } catch (err) {
    pipelineLog('error', 'audio-library', 'resolve failed', { error: err })
    return pipelineError('DB_ERROR', 'Failed to resolve audio', 500, auth)
  }

  return pipelineSuccess(resolveResult, 200, auth)
}
