import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { withCronLock, newRunId, getLogger } from '../../../../../lib/logger';
import { createLgpdContainer } from '@/lib/lgpd/container';

const JOB = 'lgpd-cleanup-sweep';
const LOCK_KEY = 'cron:lgpd-cleanup-sweep';

/**
 * POST /api/cron/lgpd-cleanup-sweep
 *
 * Daily sweep (spec Section 2 v2). Runs THREE jobs in sequence:
 *  1. `cleanupSweep.advancePhase3()` — moves lgpd_requests past
 *     `scheduled_purge_at` into phase 3 (hard-delete or permanent soft-
 *     anonymize if FK-blocked).
 *  2. `cleanupSweep.sendReminders()` — emits D+7 / D+14 reminder emails
 *     (with cancel-deletion links) for in-grace requests.
 *  3. `cleanupSweep.deleteExpiredBlobs()` — removes `lgpd-exports/*` rows
 *     past their 7-day TTL.
 *
 * Each job is wrapped in try/catch so one failure does NOT skip the
 * others — we still want reminders + blob cleanup to progress even if
 * phase 3 hits a transient issue. The route returns 500 if ANY job
 * failed so the cron dashboard lights up.
 *
 * Gated by `LGPD_CRON_SWEEP_ENABLED` — 204 fast-path when disabled so
 * Vercel cron invocations don't burn compute.
 */
export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (process.env.LGPD_CRON_SWEEP_ENABLED !== 'true') {
    // Flag off — intentional no-op. 204 short-circuit before acquiring
    // the advisory lock so we don't churn pg for a disabled feature.
    return new Response(null, { status: 204 });
  }

  const supabase = getSupabaseServiceClient();
  const runId = newRunId();

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const container = createLgpdContainer();
    let phase3Processed = 0;
    let remindersSent = 0;
    let blobsDeleted = 0;
    const errors: string[] = [];

    try {
      const r = await container.cleanupSweep.advancePhase3();
      phase3Processed = r.processed;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`phase3:${msg}`);
      getLogger().error('[lgpd_sweep_phase3_failed]', { message: msg });
    }

    try {
      const r = await container.cleanupSweep.sendReminders();
      remindersSent = r.sent;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`reminders:${msg}`);
      getLogger().error('[lgpd_sweep_reminders_failed]', { message: msg });
    }

    try {
      const r = await container.cleanupSweep.deleteExpiredBlobs();
      blobsDeleted = r.deleted;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`blobs:${msg}`);
      getLogger().error('[lgpd_sweep_blobs_failed]', { message: msg });
    }

    // Best-effort cron audit row — matches the pattern from the other
    // cron handlers so `/admin/audit` can surface this job's history.
    try {
      await supabase.from('cron_runs').insert({
        job: JOB,
        status: errors.length === 0 ? 'ok' : 'error',
        items_processed:
          phase3Processed + remindersSent + blobsDeleted,
      });
    } catch {
      /* best-effort */
    }

    if (errors.length > 0) {
      return {
        status: 'error' as const,
        err_code: 'partial_failure',
        phase3_processed: phase3Processed,
        reminders_sent: remindersSent,
        blobs_deleted: blobsDeleted,
        errors_count: errors.length,
      };
    }

    return {
      status: 'ok' as const,
      phase3_processed: phase3Processed,
      reminders_sent: remindersSent,
      blobs_deleted: blobsDeleted,
    };
  });
}
