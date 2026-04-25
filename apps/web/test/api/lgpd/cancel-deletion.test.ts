import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// cancel-deletion is UNAUTHENTICATED — no auth mock needed.
// It depends on createLgpdContainer and getSupabaseServiceClient.

vi.mock('../../../src/lib/lgpd/container', () => ({
  createLgpdContainer: vi.fn(),
}));

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

vi.mock('../../../lib/logger', () => ({
  getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { POST } from '../../../src/app/api/lgpd/cancel-deletion/route';
import { createLgpdContainer } from '../../../src/lib/lgpd/container';
import { getSupabaseServiceClient } from '../../../lib/supabase/service';

function req(body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/lgpd/cancel-deletion', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function fakeServiceClient(updateError: unknown = null) {
  return {
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ error: updateError }),
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/lgpd/cancel-deletion', () => {
  it('400 when body is missing token', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when token is empty string', async () => {
    const res = await POST(req({ token: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when body is not JSON', async () => {
    const r = new Request('http://localhost/api/lgpd/cancel-deletion', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(r);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('200 happy path — cancel returns no userId (void)', async () => {
    const cancelMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createLgpdContainer).mockReturnValue({
      accountDeletion: { cancel: cancelMock },
    } as never);

    const res = await POST(req({ token: 'valid-token-abc' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(cancelMock).toHaveBeenCalledWith('valid-token-abc');
  });

  it('200 happy path — cancel returns userId, unbans via service client', async () => {
    const serviceClient = fakeServiceClient(null);
    vi.mocked(getSupabaseServiceClient).mockReturnValue(serviceClient as never);
    const cancelMock = vi.fn().mockResolvedValue({ userId: 'user-1' });
    vi.mocked(createLgpdContainer).mockReturnValue({
      accountDeletion: { cancel: cancelMock },
    } as never);

    const res = await POST(req({ token: 'valid-token-abc' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(serviceClient.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', {
      ban_duration: 'none',
    });
  });

  it('200 even when unban call returns an error (best-effort)', async () => {
    const serviceClient = fakeServiceClient({ message: 'auth error' });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(serviceClient as never);
    const cancelMock = vi.fn().mockResolvedValue({ userId: 'user-1' });
    vi.mocked(createLgpdContainer).mockReturnValue({
      accountDeletion: { cancel: cancelMock },
    } as never);

    const res = await POST(req({ token: 'valid-token-abc' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('200 even when unban throws (best-effort)', async () => {
    const serviceClient = {
      auth: {
        admin: {
          updateUserById: vi.fn().mockRejectedValue(new Error('network error')),
        },
      },
    };
    vi.mocked(getSupabaseServiceClient).mockReturnValue(serviceClient as never);
    const cancelMock = vi.fn().mockResolvedValue({ userId: 'user-1' });
    vi.mocked(createLgpdContainer).mockReturnValue({
      accountDeletion: { cancel: cancelMock },
    } as never);

    const res = await POST(req({ token: 'valid-token-abc' }));
    expect(res.status).toBe(200);
  });

  it('410 when cancel throws invalid_token error', async () => {
    const cancelMock = vi.fn().mockRejectedValue(new Error('invalid_token'));
    vi.mocked(createLgpdContainer).mockReturnValue({
      accountDeletion: { cancel: cancelMock },
    } as never);

    const res = await POST(req({ token: 'bad-token' }));
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe('token_invalid');
  });

  it('410 when cancel throws expired error', async () => {
    const cancelMock = vi.fn().mockRejectedValue(new Error('expired: token past TTL'));
    vi.mocked(createLgpdContainer).mockReturnValue({
      accountDeletion: { cancel: cancelMock },
    } as never);

    const res = await POST(req({ token: 'old-token' }));
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe('token_invalid');
  });

  it('410 when cancel throws not_in_grace error', async () => {
    const cancelMock = vi.fn().mockRejectedValue(new Error('not_in_grace'));
    vi.mocked(createLgpdContainer).mockReturnValue({
      accountDeletion: { cancel: cancelMock },
    } as never);

    const res = await POST(req({ token: 'grace-expired' }));
    expect(res.status).toBe(410);
  });

  it('500 when cancel throws generic error', async () => {
    const cancelMock = vi.fn().mockRejectedValue(new Error('database error'));
    vi.mocked(createLgpdContainer).mockReturnValue({
      accountDeletion: { cancel: cancelMock },
    } as never);

    const res = await POST(req({ token: 'valid-token' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('cancel_failed');
  });

  it('reads x-forwarded-for header for IP logging', async () => {
    const cancelMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createLgpdContainer).mockReturnValue({
      accountDeletion: { cancel: cancelMock },
    } as never);

    const res = await POST(
      req({ token: 'valid-token' }, { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }),
    );
    expect(res.status).toBe(200);
    // IP extraction is internal — just verify the route still succeeds
  });
});
