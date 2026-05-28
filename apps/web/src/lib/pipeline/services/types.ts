import type { SupabaseClient } from '@supabase/supabase-js'

export type Permission = 'read' | 'write' | 'admin'

export interface ServiceContext {
  siteId: string
  permissions: Permission[]
  keyHash?: string
  supabase: SupabaseClient
  source?: 'api_key' | 'session'
}

export interface ServiceResult<T> {
  data: T
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

export function ok<T>(data: T, _status = 200): ServiceResult<T> {
  return { data }
}

export function err(code: string, message: string, status: number): never {
  throw new PipelineServiceError(code, message, status)
}

export function fail(code: string, message: string, status: number): never {
  throw new PipelineServiceError(code, message, status)
}
