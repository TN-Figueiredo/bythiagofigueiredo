import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CRON_SECRET = 'test-secret';
process.env.CRON_SECRET = CRON_SECRET;

vi.mock('../../../lib/seo/host', () => ({
  resolveSiteByHost: vi.fn(),
}));

vi.mock('../../../lib/seo/config', () => ({
  getSiteSeoConfig: vi.fn(),
}));

vi.mock('../../../lib/seo/enumerator', () => ({
  enumerateSiteRoutes: vi.fn(),
}));

import { GET } from '../../../src/app/api/health/seo/route';
import { resolveSiteByHost } from '../../../lib/seo/host';
import { getSiteSeoConfig } from '../../../lib/seo/config';
import { enumerateSiteRoutes } from '../../../lib/seo/enumerator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeSite = { id: 'site-uuid', slug: 'bythiagofigueiredo' };
const fakeConfig = { identityType: 'person' };
const fakeRoutes = ['/pt-BR', '/en', '/privacy', '/terms'];

function req(secret?: string, host = 'bythiagofigueiredo.com') {
  return new Request('http://localhost/api/health/seo', {
    method: 'GET',
    headers: {
      host,
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/health/seo', () => {
  it('returns 401 with no auth header', async () => {
    const res = await GET(req() as never);
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const res = await GET(req('bad-secret') as never);
    expect(res.status).toBe(401);
  });

  it('returns 503 when site does not resolve', async () => {
    vi.mocked(resolveSiteByHost).mockResolvedValue(null);

    const res = await GET(req(CRON_SECRET) as never);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('site_not_resolved');
  });

  it('returns 200 with full health payload on success', async () => {
    vi.mocked(resolveSiteByHost).mockResolvedValue(fakeSite as never);
    vi.mocked(getSiteSeoConfig).mockResolvedValue(fakeConfig as never);
    vi.mocked(enumerateSiteRoutes).mockResolvedValue(fakeRoutes as never);

    const res = await GET(req(CRON_SECRET) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.siteId).toBe('site-uuid');
    expect(body.siteSlug).toBe('bythiagofigueiredo');
    expect(body.identityType).toBe('person');
    expect(body.sitemapRouteCount).toBe(4);
    expect(body.schemaVersion).toBe('v1');
    expect(typeof body.seoConfigCachedMs).toBe('number');
    expect(typeof body.sitemapBuildMs).toBe('number');
    expect(body.flags).toBeDefined();
    expect(typeof body.flags.jsonLd).toBe('boolean');
    expect(typeof body.flags.sitemapKilled).toBe('boolean');
  });

  it('calls resolveSiteByHost once per request', async () => {
    vi.mocked(resolveSiteByHost).mockResolvedValue(fakeSite as never);
    vi.mocked(getSiteSeoConfig).mockResolvedValue(fakeConfig as never);
    vi.mocked(enumerateSiteRoutes).mockResolvedValue([] as never);

    await GET(req(CRON_SECRET) as never);

    expect(vi.mocked(resolveSiteByHost)).toHaveBeenCalledTimes(1);
  });

  it('passes siteId to getSiteSeoConfig', async () => {
    vi.mocked(resolveSiteByHost).mockResolvedValue(fakeSite as never);
    vi.mocked(getSiteSeoConfig).mockResolvedValue(fakeConfig as never);
    vi.mocked(enumerateSiteRoutes).mockResolvedValue([] as never);

    await GET(req(CRON_SECRET) as never);

    const call = vi.mocked(getSiteSeoConfig).mock.calls[0];
    expect(call[0]).toBe('site-uuid');
  });
});
