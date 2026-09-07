import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('env example documents Sprint 1b vars', () => {
  const p = resolve(__dirname, '../../.env.local.example');
  const pkg = resolve(__dirname, '../../package.json');
  it('file exists', () => expect(existsSync(p)).toBe(true));
  it('documents AWS_SES_REGION, TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY', () => {
    const s = readFileSync(p, 'utf8');
    expect(s).toMatch(/AWS_SES_REGION=/);
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

describe('env examples documentam as 5 chaves do Instagram OAuth (C2)', () => {
  const files = [
    resolve(__dirname, '../../.env.example'),
    resolve(__dirname, '../../.env.local.example'),
  ];

  const KEYS = [
    'INSTAGRAM_APP_ID',
    'INSTAGRAM_APP_SECRET',
    'INSTAGRAM_ALLOW_META_SECRET_FALLBACK',
    'NTFY_URL',
    'SOCIAL_MASTER_KEY',
  ];

  it('os dois arquivos existem', () => {
    for (const f of files) expect(existsSync(f), f).toBe(true);
  });

  it('as 5 chaves aparecem nos DOIS arquivos', () => {
    for (const f of files) {
      const s = readFileSync(f, 'utf8');
      for (const key of KEYS) {
        expect(new RegExp(`^${key}=`, 'm').test(s), `${key} em ${f}`).toBe(true);
      }
    }
  });

  it('nenhum arquivo de exemplo traz VALOR para as chaves secretas', () => {
    for (const f of files) {
      const s = readFileSync(f, 'utf8');
      for (const key of ['INSTAGRAM_APP_SECRET', 'SOCIAL_MASTER_KEY']) {
        const line = s.split('\n').find((l) => l.startsWith(`${key}=`)) ?? '';
        const value = line.slice(key.length + 1).split('#')[0]!.trim();
        expect(value, `${key} em ${f}`).toBe('');
      }
    }
  });
});
