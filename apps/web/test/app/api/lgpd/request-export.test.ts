import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const exportRequestFn = vi.fn();

// Mutable cookie jar so individual tests can simulate a missing / stale
// `lgpd_recently_verified` cookie. Keyed by cookie name.
const cookieJar: Record<string, string> = {};

vi.mock('@/lib/lgpd/container', () => ({
  createLgpdContainer: () => ({
    dataExport: {
      request: exportRequestFn,
    },
  }),
}));

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

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () =>
      Object.entries(cookieJar).map(([name, value]) => ({ name, value })),
    get: (name: string) =>
      cookieJar[name] ? { name, value: cookieJar[name] } : undefined,
    set: () => {},
  })),
}));

import { POST } from '../../../../src/app/api/lgpd/request-export/route';
import {
  requireUser,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';
import {
  signRecentlyVerified,
  LGPD_VERIFY_COOKIE_NAME,
} from '../../../../src/lib/lgpd/verify-cookie';

function makeReq() {
  return new Request('http://x/api/lgpd/request-export', { method: 'POST' });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.local';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.LGPD_VERIFY_SECRET = 'test-verify-secret';
  vi.clearAllMocks();
  // Default: fresh verify cookie for user u1 so the happy-path tests pass
  // the Fix 14 gate. 403 tests clear this jar.
  for (const k of Object.keys(cookieJar)) delete cookieJar[k];
  cookieJar[LGPD_VERIFY_COOKIE_NAME] = signRecentlyVerified('u1');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/lgpd/request-export', () => {
  it('401 unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthenticatedError());
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('200 + requestId + expiresAt on success', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    const expiresAt = new Date(Date.now() + 7 * 86_400_000);
    exportRequestFn.mockResolvedValueOnce({
      requestId: 'exp-123',
      signedUrl: 'https://s.local/x',
      expiresAt,
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestId).toBe('exp-123');
    expect(body.expiresAt).toBe(expiresAt.toISOString());
    // Raw signed URL MUST NOT leak in the HTTP response — it's emailed instead.
    expect(body.signedUrl).toBeUndefined();
  });

  it('429 when rate limited (container rejects with rate_limited)', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    exportRequestFn.mockRejectedValueOnce(new Error('rate_limited'));

    const res = await POST(makeReq());
    expect(res.status).toBe(429);
  });

  it('409 when user has pending deletion', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    exportRequestFn.mockRejectedValueOnce(new Error('pending_deletion'));

    const res = await POST(makeReq());
    expect(res.status).toBe(409);
  });

  it('500 on unknown error', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    exportRequestFn.mockRejectedValueOnce(new Error('boom'));

    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });

  // Fix 14 (Sprint 5a): missing / stale verify cookie must 403.
  it('403 when the lgpd_recently_verified cookie is missing', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    delete cookieJar[LGPD_VERIFY_COOKIE_NAME];

    const res = await POST(makeReq());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('password_reauth_required');
    expect(exportRequestFn).not.toHaveBeenCalled();
  });

  it('403 when the verify cookie belongs to a different user', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    cookieJar[LGPD_VERIFY_COOKIE_NAME] = signRecentlyVerified('someone-else');

    const res = await POST(makeReq());
    expect(res.status).toBe(403);
  });
});
