import type { SupabaseClient } from '@supabase/supabase-js'

export function newRunId(): string {
  return crypto.randomUUID()
}

export async function withCronLock<T>(
  _supabase: SupabaseClient,
  _key: string,
  _runId: string,
  _tag: string,
  fn: () => Promise<T>,
): Promise<Response> {
  const result = await fn()
  return Response.json(result)
}
