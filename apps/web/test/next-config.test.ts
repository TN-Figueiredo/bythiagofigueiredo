import { describe, it, expect } from 'vitest';
import nextConfig from '../next.config';

describe('next.config security headers', () => {
  it('does NOT emit a global CSP — BTF-089b moved it to the middleware', async () => {
    // Guard against re-adding a global Content-Security-Policy here: the
    // middleware (src/middleware.ts + src/lib/security/csp.ts) is now the
    // single owner of the enforced policy. Two enforced CSPs are applied as
    // an intersection by browsers and would break the nonce policy.
    const headers = await (nextConfig.headers as any)();
    const globalBlocks = headers.filter(
      (h: any) => h.source === '/:path*' || h.source === '/(.*)',
    );
    for (const block of globalBlocks) {
      const csp = block.headers.find(
        (h: any) => h.key.toLowerCase() === 'content-security-policy',
      );
      expect(csp).toBeUndefined();
    }
  });

  it('keeps the non-CSP baseline security headers on every route', async () => {
    const headers = await (nextConfig.headers as any)();
    const root = headers.find((h: any) => h.source === '/(.*)');
    expect(root).toBeDefined();
    const keys = root.headers.map((h: any) => h.key);
    expect(keys).toContain('Strict-Transport-Security');
    expect(keys).toContain('X-Content-Type-Options');
    expect(keys).toContain('X-Frame-Options');
    expect(keys).toContain('Referrer-Policy');
    expect(keys).toContain('Permissions-Policy');
  });

  it('keeps the login-page frame-ancestors block (single-directive, intersection-safe)', async () => {
    const headers = await (nextConfig.headers as any)();
    const login = headers.find((h: any) => h.source === '/admin/login');
    expect(login).toBeDefined();
    const csp = login.headers.find((h: any) => h.key === 'Content-Security-Policy');
    expect(csp.value).toBe("frame-ancestors 'none'");
  });
});
