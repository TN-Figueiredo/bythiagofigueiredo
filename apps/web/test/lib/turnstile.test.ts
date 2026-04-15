import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyTurnstileToken } from '../../lib/turnstile';
import { setLogger, resetLogger } from '../../lib/logger';

beforeEach(() => {
  process.env.TURNSTILE_SECRET_KEY = 'sekret';
  setLogger({ warn: () => {}, error: () => {} });
});
afterEach(() => {
  vi.restoreAllMocks();
  resetLogger();
});

describe('verifyTurnstileToken', () => {
  it('returns true for success=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await verifyTurnstileToken('tok', '1.2.3.4');
    expect(ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(URLSearchParams);
    const body = init.body as URLSearchParams;
    expect(body.get('secret')).toBe('sekret');
    expect(body.get('response')).toBe('tok');
    expect(body.get('remoteip')).toBe('1.2.3.4');
  });

  it('returns false for success=false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ success: false, 'error-codes': ['bad-token'] }),
    }));
    expect(await verifyTurnstileToken('tok')).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    expect(await verifyTurnstileToken('tok')).toBe(false);
  });

  it('returns false when secret env is missing (and logs once)', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    // re-import both modules together so setLogger writes to the same logger
    // instance that the re-imported turnstile reads.
    vi.resetModules();
    const logs: string[] = [];
    const loggerMod = await import('../../lib/logger');
    loggerMod.setLogger({ warn: (m) => logs.push(m), error: (m) => logs.push(m) });
    const mod = await import('../../lib/turnstile');
    expect(await mod.verifyTurnstileToken('tok')).toBe(false);
    expect(logs.some((m) => /TURNSTILE_SECRET_KEY/.test(m))).toBe(true);
  });

  it('returns false on non-ok HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }));
    expect(await verifyTurnstileToken('tok')).toBe(false);
  });

  it('returns false when hostname does not match expectedHostname', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ success: true, hostname: 'evil.example' }),
    }));
    expect(await verifyTurnstileToken('tok', undefined, { expectedHostname: 'bythiagofigueiredo.com' })).toBe(false);
  });

  it('returns true when hostname matches expectedHostname', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ success: true, hostname: 'bythiagofigueiredo.com' }),
    }));
    expect(await verifyTurnstileToken('tok', undefined, { expectedHostname: 'bythiagofigueiredo.com' })).toBe(true);
  });

  it('aborts after timeoutMs and returns false', async () => {
    // Simulate AbortError rejection when the controller aborts — robust across fetch impls.
    const fetchMock = vi.fn((_url: string, init: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await verifyTurnstileToken('tok', undefined, { timeoutMs: 20 });
    expect(result).toBe(false);
  });
});
