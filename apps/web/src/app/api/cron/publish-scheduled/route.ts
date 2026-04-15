import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getLogger } from '../../../../../lib/logger';

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const start = Date.now();
  const nowIso = new Date().toISOString();
  let processed = 0;

  try {
    const posts = await supabase
      .from('blog_posts')
      .update({ status: 'published', published_at: nowIso })
      .eq('status', 'scheduled')
      .lte('scheduled_for', nowIso)
      .select('id');
    processed += posts.data?.length ?? 0;

    const camps = await supabase
      .from('campaigns')
      .update({ status: 'published', published_at: nowIso })
      .eq('status', 'scheduled')
      .lte('scheduled_for', nowIso)
      .select('id');
    processed += camps.data?.length ?? 0;

    await supabase.from('cron_runs').insert({
      job: 'publish-scheduled',
      status: 'ok',
      duration_ms: Date.now() - start,
      items_processed: processed,
    });

    return Response.json({ processed });
  } catch (e) {
    await supabase.from('cron_runs').insert({
      job: 'publish-scheduled',
      status: 'error',
      duration_ms: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    });
    getLogger().error('[cron_publish_scheduled_error]', {
      error: e instanceof Error ? e.message : String(e),
    });
    return new Response('error', { status: 500 });
  }
}
