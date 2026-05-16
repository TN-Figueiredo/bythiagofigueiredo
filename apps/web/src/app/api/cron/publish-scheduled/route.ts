import { getSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { withCronLock, newRunId } from '../../../../../lib/logger';
import * as Sentry from '@sentry/nextjs';
import { socialConfigSchema } from '@/lib/social/schemas';
import type { SocialConfig } from '@/lib/social/types';

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
    async function updateBlogPosts() {
      const res = await supabase
        .from('blog_posts')
        .update({ status: 'published', published_at: nowIso })
        .eq('status', 'scheduled')
        .lte('scheduled_for', nowIso)
        .select('id, site_id, social_config');
      if (res.error) throw new Error(`blog_posts: ${res.error.message ?? 'update failed'}`);
      return res.data ?? [];
    }

    async function updateCampaigns() {
      const res = await supabase
        .from('campaigns')
        .update({ status: 'published', published_at: nowIso })
        .eq('status', 'scheduled')
        .lte('scheduled_for', nowIso)
        .select('id');
      if (res.error) throw new Error(`campaigns: ${res.error.message ?? 'update failed'}`);
      return res.data?.length ?? 0;
    }

    const results = await Promise.allSettled([
      updateBlogPosts(),
      updateCampaigns(),
    ]);

    let processed = 0;
    let publishedPosts: Array<{ id: string; site_id: string; social_config: unknown }> = [];
    const errors: string[] = [];
    const stacks: string[] = [];

    if (results[0]!.status === 'fulfilled') {
      publishedPosts = results[0]!.value as Array<{ id: string; site_id: string; social_config: unknown }>;
      processed += publishedPosts.length;
    } else {
      const reason = results[0]!.reason;
      errors.push(reason instanceof Error ? reason.message : String(reason));
      if (reason instanceof Error && reason.stack) stacks.push(reason.stack);
    }

    if (results[1]!.status === 'fulfilled') {
      processed += results[1]!.value as number;
    } else {
      const reason = results[1]!.reason;
      errors.push(reason instanceof Error ? reason.message : String(reason));
      if (reason instanceof Error && reason.stack) stacks.push(reason.stack);
    }

    // Trigger social post creation for published blog posts with social_config.enabled
    for (const post of publishedPosts) {
      const parsed = socialConfigSchema.safeParse(post.social_config);
      if (parsed.success && parsed.data.enabled) {
        import('@/lib/social/create-from-content').then(({ createSocialPostFromContent }) =>
          createSocialPostFromContent({
            supabase,
            siteId: post.site_id,
            contentType: 'blog',
            contentId: post.id,
            config: parsed.data as SocialConfig,
            origin: 'auto',
            userId: 'system',
          }).catch((err) => Sentry.captureException(err, {
            tags: { component: 'cron-publish-scheduled', action: 'social-trigger' },
          })),
        )
      }
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
        stack: stacks.length ? stacks.join('\n---\n') : undefined,
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
