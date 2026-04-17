import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const confirmFn = vi.fn();
const updateUserById = vi.fn();
const signOutAdmin = vi.fn();

vi.mock('@/lib/lgpd/container', () => ({
  createLgpdContainer: () => ({
    accountDeletion: {
      confirm: confirmFn,
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
    getAll: () => [],
    set: () => {},
  })),
}));

vi.mock('../../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    auth: { admin: { updateUserById, signOut: signOutAdmin } },
  })),
}));

import { POST } from '../../../../src/app/api/lgpd/confirm-deletion/route';
import { getSupabaseServiceClient } from '../../../../lib/supabase/service';
import {
  requireUser,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';

function makeReq(body: unknown) {
  return new Request('http://x/api/lgpd/confirm-deletion', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.local';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  vi.clearAllMocks();
  updateUserById.mockResolvedValue({ data: {}, error: null });
  signOutAdmin.mockResolvedValue({ error: null });
  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    auth: { admin: { updateUserById, signOut: signOutAdmin } },
  } as never);
  // Default: authed user u1 owns the token. Individual tests can override.
  vi.mocked(requireUser).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/lgpd/confirm-deletion', () => {
  it('400 when token missing', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('200 + bans user when confirm succeeds', async () => {
    const scheduledPurgeAt = new Date(Date.now() + 15 * 86_400_000);
    confirmFn.mockResolvedValueOnce({
      userId: 'u1',
      scheduledPurgeAt,
    });

    const res = await POST(makeReq({ token: 'raw' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.scheduledPurgeAt).toBe(scheduledPurgeAt.toISOString());
    expect(confirmFn).toHaveBeenCalledWith('raw');
    expect(updateUserById).toHaveBeenCalledWith('u1', {
      ban_duration: '876000h', // "infinite" ≈ 100 years in seconds-duration string
    });
  });

  it('410 when container rejects with invalid_token', async () => {
    confirmFn.mockRejectedValueOnce(new Error('invalid_token'));
    const res = await POST(makeReq({ token: 'bad' }));
    expect(res.status).toBe(410);
  });

  it('still returns 200 when ban update errors (best-effort)', async () => {
    confirmFn.mockResolvedValueOnce({
      userId: 'u1',
      scheduledPurgeAt: new Date(),
    });
    updateUserById.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    });
    const res = await POST(makeReq({ token: 'raw' }));
    expect(res.status).toBe(200);
  });

  // Fix 13 (Sprint 5a): auth gate + token-ownership check.
  it('401 when unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthenticatedError());
    const res = await POST(makeReq({ token: 'raw' }));
    expect(res.status).toBe(401);
    expect(confirmFn).not.toHaveBeenCalled();
  });

  // Fix 15 (Sprint 5a): confirm-deletion must also revoke outstanding
  // sessions so the just-banned user's current tab can't keep using its
  // already-issued access token.
  it('calls auth.admin.signOut(userId, "global") after successful ban', async () => {
    confirmFn.mockResolvedValueOnce({
      userId: 'u1',
      scheduledPurgeAt: new Date(),
    });
    const res = await POST(makeReq({ token: 'raw' }));
    expect(res.status).toBe(200);
    expect(signOutAdmin).toHaveBeenCalledWith('u1', 'global');
  });

  it('403 when token resolves to a different user (ownership mismatch)', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    confirmFn.mockResolvedValueOnce({
      userId: 'u2', // different user!
      scheduledPurgeAt: new Date(),
    });
    const res = await POST(makeReq({ token: 'stolen' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('token_ownership_mismatch');
    // No ban was applied — mismatch rejected before the updateUserById call.
    expect(updateUserById).not.toHaveBeenCalled();
  });
});
