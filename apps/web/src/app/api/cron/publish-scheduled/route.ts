import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { logCron, newRunId } from '../../../../../lib/logger';

const LOCK_KEY = 'cron:publish-scheduled';
const JOB = 'publish-scheduled';

type SupabaseSvc = ReturnType<typeof getSupabaseServiceClient>;

async function tryLock(supabase: SupabaseSvc): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('cron_try_lock', { p_job: LOCK_KEY });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}

async function releaseLock(supabase: SupabaseSvc): Promise<void> {
  try {
    await supabase.rpc('cron_unlock', { p_job: LOCK_KEY });
  } catch {
    /* best-effort */
  }
}

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const run_id = newRunId();

  // H7: advisory lock — skip overlapping runs.
  const gotLock = await tryLock(supabase);
  if (!gotLock) {
    logCron({ job: JOB, run_id, status: 'locked' });
    return Response.json({ status: 'locked' }, { status: 200 });
  }

  const start = Date.now();
  const nowIso = new Date().toISOString();

  try {
    async function updateTable(table: 'blog_posts' | 'campaigns') {
      const res = await supabase
        .from(table)
        .update({ status: 'published', published_at: nowIso })
        .eq('status', 'scheduled')
        .lte('scheduled_for', nowIso)
        .select('id');
      if (res.error) throw new Error(`${table}: ${res.error.message ?? 'update failed'}`);
      return res.data?.length ?? 0;
    }

    const results = await Promise.allSettled([
      updateTable('blog_posts'),
      updateTable('campaigns'),
    ]);

    let processed = 0;
    const errors: string[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') processed += r.value;
      else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
    }

    const duration_ms = Date.now() - start;

    if (errors.length > 0) {
      const errMsg = errors.join('; ');
      try {
        await supabase.from('cron_runs').insert({
          job: JOB,
          status: 'error',
          duration_ms,
          items_processed: processed,
          error: errMsg,
        });
      } catch {
        /* best-effort */
      }
      logCron({
        job: JOB,
        run_id,
        status: 'error',
        duration_ms,
        published_count: processed,
        err_code: 'update_failed',
        error: errMsg,
      });
      return Response.json({ error: 'cron_failed', processed }, { status: 500 });
    }

    await supabase.from('cron_runs').insert({
      job: JOB,
      status: 'ok',
      duration_ms,
      items_processed: processed,
    });

    logCron({
      job: JOB,
      run_id,
      status: 'ok',
      duration_ms,
      published_count: processed,
    });

    return Response.json({ processed });
  } finally {
    await releaseLock(supabase);
  }
}
