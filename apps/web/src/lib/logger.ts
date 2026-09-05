import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { recordCronSuccess, recordCronFailure } from './cron-health'

export function newRunId(): string {
  return crypto.randomUUID()
}

const activeLocks = new Set<string>()

// Extracts a human-readable error message from a cron result payload for
// cron_health.last_error. Falls back to a generic message when the result
// doesn't carry a string `error`/`err_code` field — every shape observed
// across the ~31 routes wrapped by withCronLock uses one of those two.
function errorMessageFromResult(result: unknown, tag: string): string {
  if (result && typeof result === 'object') {
    const candidate = result as { error?: unknown; err_code?: unknown }
    if (typeof candidate.error === 'string' && candidate.error) return candidate.error
    if (typeof candidate.err_code === 'string' && candidate.err_code) return candidate.err_code
  }
  return `${tag} reported status=error`
}

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
    // Instrumentation point: covers every route that passes through this
    // lock (see docs/superpowers/plans/2026-09-02-falhas-silenciosas.md
    // WP-H) without each of them having to call recordCronSuccess/
    // recordCronFailure by hand.
    const status = result && typeof result === 'object' ? (result as { status?: unknown }).status : undefined
    const skipped = result && typeof result === 'object' ? (result as { skipped?: unknown }).skipped === true : false
    // `health_written: true` (Critico 1, same plan): a route that already
    // called recordCronSuccess/recordCronFailure itself for this job sets
    // this so the wrapper does not write again — writing twice is NOT
    // harmless (see the twin comment in apps/web/lib/logger.ts, the other
    // withCronLock implementation): consecutive_failures/severity mutate on
    // every write, so a redundant success write can erase a failure the
    // route just recorded.
    const healthWritten = result && typeof result === 'object' ? (result as { health_written?: unknown }).health_written === true : false
    // Best-effort: a cron_health write failure must never break the cron's
    // own response. `skipped: true` (guard bailed out before real work —
    // e.g. a non-prod env check) is not recorded as success or failure: it
    // would make a cron that never actually runs in prod look healthy.
    if (!skipped && !healthWritten) {
      try {
        if (status === 'error') {
          await recordCronFailure(tag, errorMessageFromResult(result, tag))
        } else {
          await recordCronSuccess(tag)
        }
      } catch (healthErr) {
        console.error(`[withCronLock] cron_health write failed for ${tag}:`, healthErr)
      }
    }
    // `health_written` is wrapper-internal signaling (see above) — never
    // surface it in the HTTP response body.
    if (healthWritten && result && typeof result === 'object' && 'health_written' in result) {
      const { health_written: _healthWritten, ...rest } = result as Record<string, unknown>
      return Response.json(rest)
    }
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    try {
      await recordCronFailure(tag, message)
    } catch (healthErr) {
      console.error(`[withCronLock] cron_health write failed for ${tag}:`, healthErr)
    }
    Sentry.captureException(err, {
      tags: { component: 'cron', job: tag },
    })
    return Response.json({ status: 'error', job: tag }, { status: 500 })
  } finally {
    activeLocks.delete(key)
  }
}
