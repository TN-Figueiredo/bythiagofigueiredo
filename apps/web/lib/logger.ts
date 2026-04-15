// Minimal logger shim. In production it writes to stderr via console.
// In tests, `setLogger(() => {})` can silence the noise.
// Sprint 4 replaces this with a Sentry-backed implementation via setLogger.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface Logger {
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

let active: Logger = {
  warn: (msg, meta) => console.warn(msg, meta ?? ''),
  error: (msg, meta) => console.error(msg, meta ?? ''),
};

export function getLogger(): Logger {
  return active;
}

export function setLogger(next: Logger): void {
  active = next;
}

export function resetLogger(): void {
  active = {
    warn: (msg, meta) => console.warn(msg, meta ?? ''),
    error: (msg, meta) => console.error(msg, meta ?? ''),
  };
}

// ---------------------------------------------------------------------------
// Structured cron logger (Sprint 4 Epic 9 T69).
//
// Emits a single JSON line per event. Vercel log search parses this shape
// directly; the Sentry transport wired up in T66–T68 will ingest the same
// payload through a `beforeSend` hook, so no downstream refactor is needed
// once Sentry is installed.
// ---------------------------------------------------------------------------

export type CronStatus = 'ok' | 'error' | 'locked' | 'skipped';

export interface CronLogEvent {
  job: string;
  run_id?: string;
  status: CronStatus;
  err_code?: string;
  site_id?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

export function logCron(event: CronLogEvent): void {
  const payload = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  const line = JSON.stringify(payload);
  if (event.status === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function newRunId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// withCronLock — wraps a cron handler body with advisory lock acquire/release
// and emits a logCron event for every outcome. Returns a Response ready to be
// the return value of a Next.js route handler.
//
// Contention ⇒ HTTP 200 { status: 'locked' } and `logCron({status:'locked'})`.
// fn returns { status: 'ok', ...extra }   ⇒ HTTP 200 { ...extra } + ok log.
// fn returns { status: 'error', ...extra} ⇒ HTTP 500 { ...extra } + error log.
// fn throws                                ⇒ HTTP 500 { error } + error log.
// Lock is always released in the finally block.
//
// RPC contract matches the existing handlers: `cron_try_lock(p_job)` returns
// boolean; `cron_unlock(p_job)` is best-effort. If the RPC errors (missing
// migration) we fail open so dev environments keep working.
// ---------------------------------------------------------------------------

type CronFnResult = { status: 'ok' | 'error'; [k: string]: unknown };

export async function withCronLock<T extends CronFnResult>(
  supabase: SupabaseClient,
  lockName: string,
  runId: string,
  job: string,
  fn: () => Promise<T>,
): Promise<Response> {
  // Try acquire.
  let gotLock = true;
  try {
    const { data, error } = await supabase.rpc('cron_try_lock', { p_job: lockName });
    if (!error) gotLock = data === true;
  } catch {
    // Fail open: RPC not available in this env.
    gotLock = true;
  }

  if (!gotLock) {
    logCron({ job, run_id: runId, status: 'locked' });
    return Response.json({ status: 'locked' }, { status: 200 });
  }

  const start = Date.now();
  try {
    try {
      const result = await fn();
      const duration_ms = Date.now() - start;
      const { status, ...extra } = result;
      logCron({ job, run_id: runId, status, duration_ms, ...extra });
      if (status === 'error') {
        return Response.json({ ...extra }, { status: 500 });
      }
      return Response.json({ ...extra }, { status: 200 });
    } catch (e) {
      const duration_ms = Date.now() - start;
      const message = e instanceof Error ? e.message : String(e);
      logCron({
        job,
        run_id: runId,
        status: 'error',
        duration_ms,
        err_code: 'unhandled',
        error: message,
      });
      return Response.json({ error: 'cron_failed' }, { status: 500 });
    }
  } finally {
    try {
      await supabase.rpc('cron_unlock', { p_job: lockName });
    } catch {
      /* best-effort */
    }
  }
}
