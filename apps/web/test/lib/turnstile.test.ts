import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyTurnstileToken } from '../../lib/turnstile';

beforeEach(() => { process.env.TURNSTILE_SECRET_KEY = 'sekret'; });
afterEach(() => { vi.restoreAllMocks(); });

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
});
