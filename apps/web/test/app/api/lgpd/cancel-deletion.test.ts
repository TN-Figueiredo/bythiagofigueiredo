import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const cancelFn = vi.fn();
const updateUserById = vi.fn();

vi.mock('@/lib/lgpd/container', () => ({
  createLgpdContainer: () => ({
    accountDeletion: {
      cancel: cancelFn,
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
    auth: { admin: { updateUserById } },
  })),
}));

import { POST } from '../../../../src/app/api/lgpd/cancel-deletion/route';
import { getSupabaseServiceClient } from '../../../../lib/supabase/service';
import {
  requireUser,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';

function makeReq(body: unknown) {
  return new Request('http://x/api/lgpd/cancel-deletion', {
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
  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    auth: { admin: { updateUserById } },
  } as never);
  vi.mocked(requireUser).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/lgpd/cancel-deletion', () => {
  it('400 on missing token', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('200 on success + calls container.cancel (which calls the RPC internally)', async () => {
    cancelFn.mockResolvedValueOnce({ userId: 'u1' });
    const res = await POST(makeReq({ token: 'raw' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(cancelFn).toHaveBeenCalledWith('raw');
    // Unban so the user can log back in.
    expect(updateUserById).toHaveBeenCalledWith('u1', { ban_duration: 'none' });
  });

  it('410 on invalid_token', async () => {
    cancelFn.mockRejectedValueOnce(new Error('invalid_token'));
    const res = await POST(makeReq({ token: 'bad' }));
    expect(res.status).toBe(410);
  });

  it('handles container.cancel returning void (legacy shape)', async () => {
    cancelFn.mockResolvedValueOnce(undefined);
    const res = await POST(makeReq({ token: 'raw' }));
    // Without userId we cannot unban — still return 200 so the UX doesn't
    // confuse the user; the cron sweep will reconcile.
    expect(res.status).toBe(200);
  });

  // Fix 13 (Sprint 5a): auth gate + token-ownership check.
  it('401 when unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthenticatedError());
    const res = await POST(makeReq({ token: 'raw' }));
    expect(res.status).toBe(401);
    expect(cancelFn).not.toHaveBeenCalled();
  });

  it('403 when token resolves to a different user (ownership mismatch)', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    cancelFn.mockResolvedValueOnce({ userId: 'u2' });
    const res = await POST(makeReq({ token: 'stolen' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('token_ownership_mismatch');
    // Ban was NOT lifted.
    expect(updateUserById).not.toHaveBeenCalled();
  });
});
