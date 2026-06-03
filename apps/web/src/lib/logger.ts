import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'

export function newRunId(): string {
  return crypto.randomUUID()
}

const activeLocks = new Set<string>()

export async function withCronLock<T>(
  _supabase: SupabaseClient,
  key: string,
  _runId: string,
  tag: string,
  fn: () => Promise<T>,
): Promise<Response> {
  if (activeLocks.has(key)) {
    return Response.json({ status: 'skipped', reason: 'already running' }, { status: 409 })
  }
  activeLocks.add(key)
  try {
    const result = await fn()
    return Response.json(result)
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'cron', job: tag },
    })
    return Response.json({ status: 'error', job: tag }, { status: 500 })
  } finally {
    activeLocks.delete(key)
  }
}
