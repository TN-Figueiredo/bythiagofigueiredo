import { PipelineServiceError, type ServiceContext } from './types'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { pipelineError } from '@/lib/pipeline/helpers'
import type { PipelineAuth } from '@/lib/pipeline/auth'

export function authToServiceContext(auth: PipelineAuth): ServiceContext {
  return {
    siteId: auth.siteId,
    permissions: auth.permissions as ServiceContext['permissions'],
    keyHash: auth.keyHash,
    supabase: getSupabaseServiceClient(),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bridge between route auth and pipelineError
export function serviceErrorToResponse(err: unknown, auth: any) {
  if (err instanceof PipelineServiceError) {
    return pipelineError(err.code, err.message, err.status, auth)
  }
  return pipelineError('INTERNAL_ERROR', 'An unexpected error occurred', 500, auth)
}
