import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getLogger } from '../../../../../lib/logger';

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const start = Date.now();
  const nowIso = new Date().toISOString();

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
        job: 'publish-scheduled',
        status: 'error',
        duration_ms: Date.now() - start,
        items_processed: processed,
        error: errMsg,
      });
    } catch {
      /* best-effort */
    }
    getLogger().error('[cron_publish_scheduled_error]', {
      error: errMsg,
      stack: results.find((r) => r.status === 'rejected' && r.reason instanceof Error)
        ? (results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason?.stack
        : undefined,
    });
    return Response.json({ error: 'cron_failed', processed }, { status: 500 });
  }

  await supabase.from('cron_runs').insert({
    job: 'publish-scheduled',
    status: 'ok',
    duration_ms: Date.now() - start,
    items_processed: processed,
  });

  return Response.json({ processed });
}
