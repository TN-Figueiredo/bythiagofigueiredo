import { describe, it, expect } from 'vitest';
import nextConfig from '../next.config';

describe('next.config security headers', () => {
  it('includes global CSP covering Supabase/Sentry', async () => {
    const headers = await (nextConfig.headers as any)();
    const root = headers.find((h: any) => h.source === '/:path*');
    expect(root).toBeDefined();
    const csp = root.headers.find((h: any) => h.key === 'Content-Security-Policy');
    expect(csp.value).toContain('*.supabase.co');
    expect(csp.value).not.toContain('api.brevo.com'); // Brevo fully removed in Sprint 5e
    expect(csp.value).toContain('*.ingest.sentry.io');
    expect(csp.value).toContain("frame-ancestors 'none'");
  });

  // Waitlists Surface 2 — /embed/waitlists/* must be iframable by third-party
  // sites (frame-ancestors * + NO X-Frame-Options); everything else stays DENY.
  describe('embed frameability exception (/embed/waitlists/*)', () => {
    it('serves the embed path a CSP with frame-ancestors * AFTER the global CSP block (last key wins)', async () => {
      const headers = await (nextConfig.headers as any)();
      const embedIdx = headers.findIndex((h: any) => h.source === '/embed/waitlists/:path*');
      const globalIdx = headers.findIndex((h: any) => h.source === '/:path*');
      expect(embedIdx).toBeGreaterThan(-1);
      // Next.js resolves duplicate header keys by "last match wins" — the embed
      // override is dead code unless it comes after the global '/:path*' CSP.
      expect(embedIdx).toBeGreaterThan(globalIdx);
      const csp = headers[embedIdx].headers.find((h: any) => h.key === 'Content-Security-Policy');
      expect(csp.value).toContain('frame-ancestors *');
      expect(csp.value).not.toContain("frame-ancestors 'none'");
    });

    it('keeps every non-frame-ancestors directive of the embed CSP identical to the global CSP', async () => {
      const headers = await (nextConfig.headers as any)();
      const directives = (source: string) =>
        headers
          .find((h: any) => h.source === source)
          .headers.find((h: any) => h.key === 'Content-Security-Policy')
          .value.split('; ')
          .filter((d: string) => !d.startsWith('frame-ancestors'))
          .sort();
      // the embed page still loads Turnstile etc. — only the framing policy differs
      expect(directives('/embed/waitlists/:path*')).toEqual(directives('/:path*'));
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
      // the embed block itself never sets X-Frame-Options
      const embed = headers.find((h: any) => h.source === '/embed/waitlists/:path*');
      expect(embed.headers.some((x: any) => x.key === 'X-Frame-Options')).toBe(false);
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
