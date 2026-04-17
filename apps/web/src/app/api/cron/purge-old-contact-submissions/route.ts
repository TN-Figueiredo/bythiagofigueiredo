import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { withCronLock, newRunId } from '../../../../../lib/logger';

const JOB = 'purge-old-contact-submissions';
const LOCK_KEY = 'cron:purge-old-contact-submissions';
const RETENTION_DAYS = 730; // 2 years — matches privacy policy Section 6

/**
 * POST /api/cron/purge-old-contact-submissions
 *
 * Sprint 5a P1-9 — weekly enforcement of the 2-year retention SLA disclosed
 * in the privacy policy (Section 6). Calls the `purge_old_contact_submissions`
 * RPC which iterates rows older than 730d and invokes
 * `anonymize_contact_submission(id)` per row — preserves `site_id` +
 * `submitted_at` for aggregate analytics, zeroes PII, and stamps
 * `anonymized_at`. Idempotent — already-anonymized rows are skipped at
 * the SQL level via `anonymized_at is null`.
 *
 * Scheduled via `apps/web/vercel.json` at `0 6 * * 0` (Sunday 06:00 UTC).
 */
export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const runId = newRunId();

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const { data, error } = await supabase.rpc(
      'purge_old_contact_submissions',
      { p_older_than_days: RETENTION_DAYS },
    );
    if (error) {
      return {
        status: 'error' as const,
        err_code: 'rpc_failed',
        error: error.message,
      };
    }

    const anonymized = typeof data === 'number' ? data : Number(data ?? 0);

    try {
      await supabase.from('cron_runs').insert({
        job: JOB,
        status: 'ok',
        items_processed: anonymized,
      });
    } catch {
      /* best-effort */
    }

    return { status: 'ok' as const, ok: true, anonymized };
  });
}
