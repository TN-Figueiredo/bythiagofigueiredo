import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const confirmFn = vi.fn();
const updateUserById = vi.fn();

vi.mock('@/lib/lgpd/container', () => ({
  createLgpdContainer: () => ({
    accountDeletion: {
      confirm: confirmFn,
    },
  }),
}));

vi.mock('../../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    auth: { admin: { updateUserById } },
  })),
}));

import { POST } from '../../../../src/app/api/lgpd/confirm-deletion/route';
import { getSupabaseServiceClient } from '../../../../lib/supabase/service';

function makeReq(body: unknown) {
  return new Request('http://x/api/lgpd/confirm-deletion', {
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
});
