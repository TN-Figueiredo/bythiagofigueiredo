import { describe, it, expect } from 'vitest';
import nextConfig from '../next.config';

describe('next.config security headers', () => {
  it('includes global CSP covering Supabase/Sentry', async () => {
    const headers = await (nextConfig.headers as any)();
    const root = headers.find((h: any) => h.source === '/:path*');
    expect(root).toBeDefined();
    const csp = root.headers.find((h: any) => h.key === 'Content-Security-Policy');
    expect(csp.value).toContain('*.supabase.co');
    expect(csp.value).not.toContain('api.brevo.com');
    expect(csp.value).toContain('o*.ingest.sentry.io');
    expect(csp.value).toContain("frame-ancestors 'none'");
  });
});
