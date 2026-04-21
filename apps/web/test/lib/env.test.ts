import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('env example documents Sprint 1b vars', () => {
  const p = resolve(__dirname, '../../.env.local.example');
  const pkg = resolve(__dirname, '../../package.json');
  it('file exists', () => expect(existsSync(p)).toBe(true));
  it('documents RESEND_API_KEY, TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY', () => {
    const s = readFileSync(p, 'utf8');
    expect(s).toMatch(/RESEND_API_KEY=/);
    expect(s).toMatch(/NEXT_PUBLIC_TURNSTILE_SITE_KEY=/);
    expect(s).toMatch(/TURNSTILE_SECRET_KEY=/);
  });
  it('pins p-retry, react-markdown, remark-gfm, @supabase/supabase-js in apps/web/package.json', () => {
    const j = JSON.parse(readFileSync(pkg, 'utf8'));
    const deps = { ...(j.dependencies ?? {}), ...(j.devDependencies ?? {}) };
    expect(deps['p-retry']).toBe('6.2.0');
    expect(deps['react-markdown']).toBe('9.0.1');
    expect(deps['remark-gfm']).toBe('4.0.0');
    expect(deps['@supabase/supabase-js']).toBe('2.103.2');
  });
});
