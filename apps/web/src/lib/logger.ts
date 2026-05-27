import type { SupabaseClient } from '@supabase/supabase-js'

export function newRunId(): string {
  return crypto.randomUUID()
}

const activeLocks = new Set<string>()

export async function withCronLock<T>(
  _supabase: SupabaseClient,
  key: string,
  _runId: string,
  _tag: string,
  fn: () => Promise<T>,
): Promise<Response> {
  if (activeLocks.has(key)) {
    return Response.json({ status: 'skipped', reason: 'already running' }, { status: 409 })
  }
  activeLocks.add(key)
  try {
    const result = await fn()
    return Response.json(result)
  } finally {
    activeLocks.delete(key)
  }
}
