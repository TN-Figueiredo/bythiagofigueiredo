import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentStatus } from '../types/content'

export abstract class SupabaseContentRepository {
  constructor(protected readonly supabase: SupabaseClient) {}

  protected nowIso(): string {
    return new Date().toISOString()
  }

  protected statusUpdate(status: ContentStatus, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { status, ...extra }
  }
}
