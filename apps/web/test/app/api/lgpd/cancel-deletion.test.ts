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

vi.mock('../../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    auth: { admin: { updateUserById } },
  })),
}));

import { POST } from '../../../../src/app/api/lgpd/cancel-deletion/route';
import { getSupabaseServiceClient } from '../../../../lib/supabase/service';

function makeReq(body: unknown) {
  return new Request('http://x/api/lgpd/cancel-deletion', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  updateUserById.mockResolvedValue({ data: {}, error: null });
  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    auth: { admin: { updateUserById } },
  } as never);
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
});
