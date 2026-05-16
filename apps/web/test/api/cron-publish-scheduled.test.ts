import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock('@/lib/social/create-from-content', () => ({
  createSocialPostFromContent: vi.fn().mockResolvedValue({ postId: 'sp-1', shortLinkId: null }),
}));

import { POST } from '../../src/app/api/cron/publish-scheduled/route';
import { getSupabaseServiceClient } from '../../lib/supabase/service';
import { setLogger, resetLogger } from '../../lib/logger';

function fakeClient(posts: unknown[] = [], camps: unknown[] = [], throwOn?: string) {
  const cronInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const chain = {
    from: vi.fn((t: string) => {
      if (throwOn === t) throw new Error('db boom');
      if (t === 'cron_runs') {
        return { insert: cronInsert };
      }
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: t === 'blog_posts' ? posts : camps, error: null,
        }),
      };
    }),
    _cronInsert: cronInsert,
  };
  return chain;
}

beforeEach(() => {
  process.env.CRON_SECRET = 'topsecret';
  vi.clearAllMocks();
  setLogger({ warn: () => {}, error: () => {} });
});
afterEach(() => { vi.restoreAllMocks(); resetLogger(); });

describe('POST /api/cron/publish-scheduled', () => {
  it('401 without bearer', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeClient() as never);
    const req = new Request('http://x/api/cron/publish-scheduled', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('401 with wrong bearer', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeClient() as never);
    const req = new Request('http://x/api/cron/publish-scheduled', {
      method: 'POST', headers: { authorization: 'Bearer wrong' },
    });
    expect((await POST(req)).status).toBe(401);
  });

  it('200 with correct bearer, logs cron_runs ok', async () => {
    const c = fakeClient([{ id: 'p1' }, { id: 'p2' }], [{ id: 'c1' }]);
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);
    const req = new Request('http://x/api/cron/publish-scheduled', {
      method: 'POST', headers: { authorization: 'Bearer topsecret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(3);
    expect(c._cronInsert).toHaveBeenCalledWith(expect.objectContaining({
      job: 'publish-scheduled', status: 'ok', items_processed: 3,
    }));
  });

  it('500 + cron_runs error row on DB failure', async () => {
    const c = fakeClient([], [], 'blog_posts');
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);
    const req = new Request('http://x/api/cron/publish-scheduled', {
      method: 'POST', headers: { authorization: 'Bearer topsecret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(c._cronInsert).toHaveBeenCalledWith(expect.objectContaining({
      job: 'publish-scheduled', status: 'error',
    }));
  });
});

describe('POST /api/cron/publish-scheduled — social trigger', () => {
  it('triggers social post creation only for posts with social_config.enabled', async () => {
    const { createSocialPostFromContent } = await import('@/lib/social/create-from-content');
    const postsWithSocial = [
      {
        id: 'p1',
        site_id: 'site-1',
        social_config: {
          enabled: true,
          platforms: ['facebook'],
          captions: {},
          hashtags: [],
          image_source: 'cover_image',
          ig_template: 'card',
          formats: {},
        },
      },
      { id: 'p2', site_id: 'site-1', social_config: null },
      { id: 'p3', site_id: 'site-1', social_config: { enabled: false, platforms: [], captions: {}, hashtags: [], image_source: 'cover_image', ig_template: 'card', formats: {} } },
    ];
    const c = fakeClient(postsWithSocial, []);
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);

    const req = new Request('http://x/api/cron/publish-scheduled', {
      method: 'POST', headers: { authorization: 'Bearer topsecret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Let fire-and-forget dynamic import + .then() resolve
    await new Promise((r) => setTimeout(r, 50));

    // Only p1 has social_config.enabled = true
    expect(createSocialPostFromContent).toHaveBeenCalledTimes(1);
    expect(createSocialPostFromContent).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: 'site-1',
        contentType: 'blog',
        contentId: 'p1',
        origin: 'auto',
        userId: 'system',
      }),
    );
  });
});

describe('POST /api/cron/publish-scheduled — concurrency', () => {
  it('two concurrent invocations process each scheduled row exactly once', async () => {
    const state = {
      posts: [{ id: 'p1' }, { id: 'p2' }] as Array<{ id: string }>,
      camps: [] as Array<{ id: string }>,
    };
    const cronInserts: Array<Record<string, unknown>> = [];

    function makeClient() {
      return {
        from: vi.fn((t: string) => {
          if (t === 'cron_runs') {
            return { insert: vi.fn(async (row: Record<string, unknown>) => {
              cronInserts.push(row); return { data: null, error: null };
            }) };
          }
          const bucket = t === 'blog_posts' ? 'posts' : 'camps';
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            select: vi.fn(async () => {
              const claimed = state[bucket as 'posts' | 'camps'].splice(0);
              return { data: claimed, error: null };
            }),
          };
        }),
      };
    }

    const clientA = makeClient();
    const clientB = makeClient();
    vi.mocked(getSupabaseServiceClient)
      .mockReturnValueOnce(clientA as never)
      .mockReturnValueOnce(clientB as never);

    const mkReq = () => new Request('http://x/api/cron/publish-scheduled', {
      method: 'POST', headers: { authorization: 'Bearer topsecret' },
    });

    const [rA, rB] = await Promise.all([POST(mkReq()), POST(mkReq())]);
    expect(rA.status).toBe(200);
    expect(rB.status).toBe(200);

    const bodyA = await rA.json();
    const bodyB = await rB.json();
    expect(bodyA.processed + bodyB.processed).toBe(2);
    expect(state.posts.length).toBe(0);
    expect(state.camps.length).toBe(0);

    expect(cronInserts.length).toBe(2);
    expect(cronInserts.every((r) => r.job === 'publish-scheduled' && r.status === 'ok')).toBe(true);
  });
});

