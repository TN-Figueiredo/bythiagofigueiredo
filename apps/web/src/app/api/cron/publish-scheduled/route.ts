import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { withCronLock, newRunId } from '../../../../../lib/logger';

const LOCK_KEY = 'cron:publish-scheduled';
const JOB = 'publish-scheduled';

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const runId = newRunId();
  const nowIso = new Date().toISOString();

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
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

    if (errors.length > 0) {
      const errMsg = errors.join('; ');
      try {
        await supabase.from('cron_runs').insert({
          job: JOB,
          status: 'error',
          items_processed: processed,
          error: errMsg,
        });
      } catch {
        /* best-effort */
      }
      return {
        status: 'error' as const,
        err_code: 'update_failed',
        error: 'cron_failed',
        processed,
        published_count: processed,
      };
    }

    try {
      await supabase.from('cron_runs').insert({
        job: JOB,
        status: 'ok',
        items_processed: processed,
      });
    } catch {
      /* best-effort */
    }

    return {
      status: 'ok' as const,
      processed,
      published_count: processed,
    };
  });
}
