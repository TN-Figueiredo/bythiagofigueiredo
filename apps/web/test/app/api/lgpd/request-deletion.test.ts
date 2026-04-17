import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const requestFn = vi.fn();
const checkDeletionSafetyFn = vi.fn();

const cookieJar: Record<string, string> = {};

vi.mock('@/lib/lgpd/container', () => ({
  createLgpdContainer: () => ({
    accountDeletion: {
      request: requestFn,
    },
    domainAdapter: {
      checkDeletionSafety: checkDeletionSafetyFn,
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

import { POST } from '../../../../src/app/api/lgpd/request-deletion/route';
import {
  requireUser,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';
import {
  signRecentlyVerified,
  LGPD_VERIFY_COOKIE_NAME,
} from '../../../../src/lib/lgpd/verify-cookie';

function makeReq() {
  return new Request('http://x/api/lgpd/request-deletion', { method: 'POST' });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.local';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.LGPD_VERIFY_SECRET = 'test-verify-secret';
  vi.clearAllMocks();
  // Default: deletion is safe so existing tests pass the new gate.
  checkDeletionSafetyFn.mockResolvedValue({ can_delete: true, blockers: [] });
  // Default: fresh verify cookie for u1.
  for (const k of Object.keys(cookieJar)) delete cookieJar[k];
  cookieJar[LGPD_VERIFY_COOKIE_NAME] = signRecentlyVerified('u1');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/lgpd/request-deletion', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthenticatedError());
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('202 + requestId + expiresAt when authenticated', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    const expiresAt = new Date(Date.now() + 86_400_000);
    requestFn.mockResolvedValueOnce({
      requestId: 'req-123',
      token: 'raw-token',
      expiresAt,
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.requestId).toBe('req-123');
    expect(body.expiresAt).toBe(expiresAt.toISOString());
    // token MUST NOT be leaked in the HTTP response; it's only delivered by email.
    expect(body.token).toBeUndefined();
    expect(requestFn).toHaveBeenCalledWith('u1');
  });

  it('500 when container throws', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    requestFn.mockRejectedValueOnce(new Error('db boom'));

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
    expect(requestFn).not.toHaveBeenCalled();
    expect(checkDeletionSafetyFn).not.toHaveBeenCalled();
  });

  // Fix 12 (Sprint 5a): block deletion when checkDeletionSafety fails (e.g.
  // sole master_admin). Route must 409 with the blockers array so the UI
  // can render actionable copy.
  it('409 + blocker array when checkDeletionSafety returns can_delete:false', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    checkDeletionSafetyFn.mockResolvedValueOnce({
      can_delete: false,
      blockers: ['master_ring_sole_admin'],
      details: { org_id: 'org-1' },
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('deletion_blocked');
    expect(body.blockers).toEqual(['master_ring_sole_admin']);
    expect(body.details).toEqual({ org_id: 'org-1' });
    // The actual deletion request must NOT be started.
    expect(requestFn).not.toHaveBeenCalled();
  });
});
