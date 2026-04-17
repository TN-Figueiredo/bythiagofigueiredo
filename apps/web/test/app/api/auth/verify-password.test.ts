import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Mocks ----
// Mock the auth-nextjs server helpers (requireUser + createServerClient).
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireUser: vi.fn(),
  createServerClient: vi.fn(),
  UnauthenticatedError: class UnauthenticatedError extends Error {
    constructor() {
      super('User is not authenticated');
      this.name = 'UnauthenticatedError';
    }
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
}));

import { POST } from '../../../../src/app/api/auth/verify-password/route';
import { verifyPasswordRateLimiter } from '../../../../src/lib/lgpd/verify-password-rate-limiter';
import {
  requireUser,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';
import { createClient } from '@supabase/supabase-js';

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://x/api/auth/verify-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.local';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  // Fix 14 (Sprint 5a): verify-password now signs a server-side
  // `lgpd_recently_verified` cookie on success; tests must provide a key
  // so signRecentlyVerified can HMAC a value.
  process.env.LGPD_VERIFY_SECRET = 'test-verify-secret';
  vi.clearAllMocks();
  // P1-5 (Sprint 5a): reset the module-scoped rate limiter so counter
  // accumulation from one case doesn't leak into the next.
  try {
    verifyPasswordRateLimiter._store.clear();
  } catch {
    /* noop */
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/auth/verify-password', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthenticatedError());
    const res = await POST(makeReq({ password: 'x' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.valid).toBe(false);
  });

  it('401 when password is wrong', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    const signInWithPassword = vi
      .fn()
      .mockResolvedValue({ error: { message: 'invalid_credentials' } });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockReturnValue({
      auth: { signInWithPassword, signOut },
    } as never);

    const res = await POST(makeReq({ password: 'bad' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'bad',
    });
  });

  it('200 + valid when password re-auth succeeds; calls signOut; sets verify cookie', async () => {
    const setCookie = vi.fn();
    // Re-mock next/headers to observe cookie writes for this single test.
    const { cookies } = await import('next/headers');
    vi.mocked(cookies).mockResolvedValueOnce({
      getAll: () => [],
      get: () => undefined,
      set: setCookie,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockReturnValue({
      auth: { signInWithPassword, signOut },
    } as never);

    const res = await POST(makeReq({ password: 'correct' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(signOut).toHaveBeenCalled();
    // Fix 14: server sets a signed HTTPOnly verify cookie.
    const setCall = setCookie.mock.calls.find(
      (c) => c[0] === 'lgpd_recently_verified',
    );
    expect(setCall).toBeDefined();
    const opts = setCall![2] as Record<string, unknown>;
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('strict');
    expect(opts.maxAge).toBe(300);
    // Cookie value binds to userId.
    expect(typeof setCall![1]).toBe('string');
    expect(String(setCall![1]).startsWith('u1.')).toBe(true);
  });

  it('400 when body is missing password', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });

    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('429 after 5 failed attempts per user within the window (P1-5)', async () => {
    const signInWithPassword = vi
      .fn()
      .mockResolvedValue({ error: { message: 'invalid_credentials' } });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockReturnValue({
      auth: { signInWithPassword, signOut },
    } as never);

    // 5 allowed attempts (all 401)
    for (let i = 0; i < 5; i++) {
      vi.mocked(requireUser).mockResolvedValueOnce({
        id: 'rate-u',
        email: 'a@b.com',
      });
      const res = await POST(makeReq({ password: 'bad' }));
      expect(res.status).toBe(401);
    }

    // 6th attempt blocks with 429
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'rate-u',
      email: 'a@b.com',
    });
    const blocked = await POST(makeReq({ password: 'bad' }));
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error).toBe('rate_limited');
    expect(typeof body.retryAfterSec).toBe('number');
    expect(blocked.headers.get('Retry-After')).toBeDefined();

    // Rate limit is scoped per-user: a different user id should still be
    // allowed even while `rate-u` is blocked.
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'other-u',
      email: 'c@d.com',
    });
    const otherRes = await POST(makeReq({ password: 'bad' }));
    expect(otherRes.status).toBe(401);
  });

  it('successful verify resets the rate-limit counter (P1-5)', async () => {
    // Four failed attempts first.
    const signInWithPasswordBad = vi
      .fn()
      .mockResolvedValue({ error: { message: 'invalid_credentials' } });
    const signOutBad = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signInWithPassword: signInWithPasswordBad,
        signOut: signOutBad,
      },
    } as never);
    for (let i = 0; i < 4; i++) {
      vi.mocked(requireUser).mockResolvedValueOnce({
        id: 'reset-u',
        email: 'e@f.com',
      });
      const res = await POST(makeReq({ password: 'bad' }));
      expect(res.status).toBe(401);
    }

    // Successful attempt (cookie set is mocked away by the default
    // cookies() mock which exposes `.set` as a noop).
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'reset-u',
      email: 'e@f.com',
    });
    const signInWithPasswordOk = vi.fn().mockResolvedValue({ error: null });
    const signOutOk = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signInWithPassword: signInWithPasswordOk,
        signOut: signOutOk,
      },
    } as never);
    const ok = await POST(makeReq({ password: 'correct' }));
    expect(ok.status).toBe(200);

    // After reset, user can still try >1 time without hitting 429.
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signInWithPassword: signInWithPasswordBad,
        signOut: signOutBad,
      },
    } as never);
    for (let i = 0; i < 5; i++) {
      vi.mocked(requireUser).mockResolvedValueOnce({
        id: 'reset-u',
        email: 'e@f.com',
      });
      const res = await POST(makeReq({ password: 'bad' }));
      expect(res.status).toBe(401);
    }
  });
});
