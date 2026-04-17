import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

const captureSpy = vi.fn();
vi.mock('@sentry/nextjs', () => ({ captureException: captureSpy }));

describe('middleware unknown hostname', () => {
  it('fires Sentry and rewrites to /site-not-configured on /cms', async () => {
    vi.resetModules();
    vi.doMock('@tn-figueiredo/cms/ring', () => ({
      SupabaseRingContext: class { getSiteByDomain() { return null; } }
    }));
    const { middleware } = await import('@/middleware');
    const req = new NextRequest('https://unknown.test/cms/blog');
    const res = await middleware(req);
    expect(captureSpy).toHaveBeenCalled();
    expect(res.headers.get('x-middleware-rewrite')).toContain('/site-not-configured');
  });
});
