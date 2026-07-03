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
    // X-Frame-Options intentionally NOT here — it rides the embed-excluding
    // negative-lookahead source (see the XFO test below).
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

  // Waitlists Surface 2 — /embed/waitlists/* must be iframable by third-party
  // sites (frame-ancestors * + NO X-Frame-Options); everything else stays DENY.
  describe('embed frameability exception (/embed/waitlists/*)', () => {
    it('has NO embed CSP block here — the frameable policy lives in the middleware (path-aware frame-ancestors)', async () => {
      // Under the middleware-owned CSP (BTF-089b) a config-level embed CSP
      // would be a SECOND enforced policy (browsers intersect) — guard against
      // reintroducing it. The frame-ancestors * for /embed/waitlists/* comes
      // from buildCsp/buildLegacyCsp({ frameAncestors: '*' }) in the middleware
      // (covered in test/security/csp.test.ts + test/middleware-csp.test.ts).
      const headers = await (nextConfig.headers as any)();
      const embed = headers.find((h: any) => h.source === '/embed/waitlists/:path*');
      expect(embed).toBeUndefined();
    });

    it('omits X-Frame-Options on the embed path but keeps DENY everywhere else', async () => {
      const headers = await (nextConfig.headers as any)();
      const xfoBlocks = headers.filter((h: any) =>
        h.headers.some((x: any) => x.key === 'X-Frame-Options'),
      );
      expect(xfoBlocks.length).toBeGreaterThan(0);
      for (const block of xfoBlocks) {
        const xfo = block.headers.find((x: any) => x.key === 'X-Frame-Options');
        // XFO has no "allow anyone" value, so the embed path must be EXCLUDED from
        // every XFO source (negative lookahead / login paths), never given a value.
        expect(xfo.value).toBe('DENY');
        expect(block.source).not.toBe('/(.*)');
        expect(block.source).not.toBe('/:path*');
        const isLoginPath = /^\/(admin|cms)\//.test(block.source);
        if (!isLoginPath) {
          expect(block.source).toBe('/((?!embed/waitlists/).*)');
        }
      }
    });

    it('keeps the baseline hardening headers (HSTS/nosniff/referrer) on ALL paths including the embed', async () => {
      const headers = await (nextConfig.headers as any)();
      const catchAll = headers.find((h: any) => h.source === '/(.*)');
      const keys = catchAll.headers.map((x: any) => x.key);
      expect(keys).toContain('Strict-Transport-Security');
      expect(keys).toContain('X-Content-Type-Options');
      expect(keys).toContain('Referrer-Policy');
      expect(keys).toContain('Permissions-Policy');
      // XFO moved out of the catch-all (it now rides the embed-excluding source)
      expect(keys).not.toContain('X-Frame-Options');
    });
  });
});
