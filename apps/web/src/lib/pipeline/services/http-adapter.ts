import { PipelineServiceError, type ServiceContext } from './types'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { pipelineError } from '@/lib/pipeline/helpers'
import type { PipelineAuth } from '@/lib/pipeline/auth'

export function authToServiceContext(auth: PipelineAuth): ServiceContext {
  return {
    siteId: auth.siteId,
    permissions: auth.permissions as ServiceContext['permissions'],
    keyHash: auth.keyHash,
    keyId: auth.keyId,
    supabase: getSupabaseServiceClient(),
    // Carries the authentication channel so write services can attribute the row
    // (api_key → 'cowork', session → 'user') instead of trusting a body field.
    source: auth.source,
  }
}

export function serviceErrorToResponse(err: unknown, auth: PipelineAuth) {
  if (err instanceof PipelineServiceError) {
    return pipelineError(err.code, err.message, err.status, auth)
  }
  return pipelineError('INTERNAL_ERROR', 'An unexpected error occurred', 500, auth)
}
