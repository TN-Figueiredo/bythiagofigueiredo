import type { SupabaseClient } from '@supabase/supabase-js'

export type Permission = 'read' | 'write' | 'admin'

export interface ServiceContext {
  siteId: string
  permissions: Permission[]
  keyHash?: string
  /**
   * pipeline_api_keys.id of the key that authenticated this request, when
   * source === 'api_key'. Lets write paths attribute content_pipeline_history
   * rows to the key (changed_by_key_id) instead of leaving them anonymous —
   * changed_by is a strict FK to auth.users and stays NULL for key-authenticated
   * writes.
   */
  keyId?: string
  supabase: SupabaseClient
  source?: 'api_key' | 'session'
}

export interface ServiceResult<T> {
  data: T
  status?: number
  meta?: {
    total?: number
    has_next?: boolean
    next_cursor?: string
    limit?: number
    version?: number
    etag?: string
    updated_at?: string
    section_key?: string
    item_version?: number
    exists?: boolean
  }
  warnings?: string[]
}

export class PipelineServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'PipelineServiceError'
  }
}

export function ok<T>(data: T, status = 200): ServiceResult<T> {
  return { data, status }
}

export function err(code: string, message: string, status: number): never {
  throw new PipelineServiceError(code, message, status)
}

export function fail(code: string, message: string, status: number): never {
  throw new PipelineServiceError(code, message, status)
}
