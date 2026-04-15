import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { withCronLock, newRunId } from '../../../../../lib/logger';

const JOB = 'purge-sent-emails';
const LOCK_KEY = 'cron:purge-sent-emails';
const RETENTION_DAYS = 90;

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const runId = newRunId();

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const { data, error } = await supabase.rpc('purge_sent_emails', {
      p_older_than_days: RETENTION_DAYS,
    });
    if (error) {
      return {
        status: 'error' as const,
        err_code: 'rpc_failed',
        error: error.message,
      };
    }

    const deleted_count = typeof data === 'number' ? data : Number(data ?? 0);

    try {
      await supabase.from('cron_runs').insert({
        job: JOB,
        status: 'ok',
        items_processed: deleted_count,
      });
    } catch {
      /* best-effort */
    }

    return { status: 'ok' as const, ok: true, deleted_count };
  });
}
