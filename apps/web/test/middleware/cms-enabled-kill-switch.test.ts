import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

describe('middleware cms_enabled kill switch', () => {
  it('rewrites /cms to /cms/disabled when site.cms_enabled=false', async () => {
    vi.resetModules();
    vi.doMock('@tn-figueiredo/cms/ring', () => ({
      SupabaseRingContext: class {
        getSiteByDomain() { return { id: 'x', org_id: 'y', default_locale: 'pt-BR', cms_enabled: false }; }
      }
    }));
    const { middleware } = await import('@/middleware');
    const req = new NextRequest('https://disabled.test/cms/blog');
    const res = await middleware(req);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/cms/disabled');
  });
});
