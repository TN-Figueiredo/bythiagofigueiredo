import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks — NO top-level variables referenced inside vi.mock factories ────

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { getUser: vi.fn() },
  }),
  requireUser: vi.fn(),
  UnauthenticatedError: class UnauthenticatedError extends Error {
    constructor() {
      super('User is not authenticated');
      this.name = 'UnauthenticatedError';
    }
  },
}));

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [],
      set: vi.fn(),
      get: () => undefined,
    }),
}));

vi.mock('../../../src/lib/lgpd/container', () => ({
  createLgpdContainer: vi.fn().mockReturnValue({
    accountDeletion: { confirm: vi.fn() },
  }),
}));

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn().mockReturnValue({
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
        // signOut not present by default — tests for the signOut path
        // override this via getSupabaseServiceClient mock.
      },
    },
    from: vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }),
}));

vi.mock('../../../lib/logger', () => ({
  getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

// ── Imports after mocks ────────────────────────────────────────────────────
import { POST } from '../../../src/app/api/lgpd/confirm-deletion/route';
import { requireUser, UnauthenticatedError } from '@tn-figueiredo/auth-nextjs/server';
import { createLgpdContainer } from '../../../src/lib/lgpd/container';
import { getSupabaseServiceClient } from '../../../lib/supabase/service';

// ── Helpers ───────────────────────────────────────────────────────────────

function req(body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/lgpd/confirm-deletion', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function setupContainer(opts: {
  userId?: string;
  confirmError?: Error;
} = {}) {
  const { userId = 'user-1', confirmError } = opts;

  const confirmFn = confirmError
    ? vi.fn().mockRejectedValue(confirmError)
    : vi.fn().mockResolvedValue({
        userId,
        scheduledPurgeAt: new Date('2026-05-04T00:00:00Z'),
        requestId: 'req-1',
      });

  vi.mocked(createLgpdContainer).mockReturnValue({
    accountDeletion: { confirm: confirmFn },
  } as never);

  return { confirmFn };
}

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupContainer();

  // Re-apply service client mock after clearAllMocks
  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
      },
    },
    from: vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/lgpd/confirm-deletion', () => {
  it('400 when body is missing token', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });

    const res = await POST(req({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when token is empty string', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });

    const res = await POST(req({ token: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when body is not JSON', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });

    const r = new Request('http://localhost/api/lgpd/confirm-deletion', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(r);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('401 when user is not authenticated', async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthenticatedError());

    const res = await POST(req({ token: 'abc123' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthenticated');
  });

  it('200 happy path — returns ok and scheduledPurgeAt', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });

    const res = await POST(req({ token: 'valid-token' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.scheduledPurgeAt).toBe('2026-05-04T00:00:00.000Z');
  });

  it('200 and calls ban on the userId returned by confirm', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });

    await POST(req({ token: 'valid-token' }));

    const sc = vi.mocked(getSupabaseServiceClient)();
    expect(sc.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', {
      ban_duration: '876000h',
    });
  });

  it('200 even when ban call returns an error (best-effort)', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      auth: {
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ error: { message: 'auth error' } }),
        },
      },
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    } as never);

    const res = await POST(req({ token: 'valid-token' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('200 even when ban call throws (best-effort)', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      auth: {
        admin: {
          updateUserById: vi.fn().mockRejectedValue(new Error('network timeout')),
        },
      },
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    } as never);

    const res = await POST(req({ token: 'valid-token' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('403 when token owner does not match authenticated user', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-2',
      email: 'attacker@example.com',
    });
    // confirm returns user-1, but auth is user-2
    setupContainer({ userId: 'user-1' });

    const res = await POST(req({ token: 'phished-token' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('token_ownership_mismatch');
  });

  it('410 when confirm throws invalid_token', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    setupContainer({ confirmError: new Error('invalid_token') });

    const res = await POST(req({ token: 'bad-token' }));
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe('token_invalid');
  });

  it('410 when confirm throws expired', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    setupContainer({ confirmError: new Error('expired') });

    const res = await POST(req({ token: 'old-token' }));
    expect(res.status).toBe(410);
  });

  it('410 when confirm throws already_consumed', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    setupContainer({ confirmError: new Error('already_consumed') });

    const res = await POST(req({ token: 'used-token' }));
    expect(res.status).toBe(410);
  });

  it('500 when confirm throws generic error', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    setupContainer({ confirmError: new Error('database unavailable') });

    const res = await POST(req({ token: 'valid-token' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('confirm_failed');
  });

  it('rethrows non-UnauthenticatedError from requireUser', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('unexpected'));

    await expect(POST(req({ token: 'valid-token' }))).rejects.toThrow('unexpected');
  });

  it('200 and calls signOut when admin.signOut is available', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });

    const signOutMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      auth: {
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ error: null }),
          signOut: signOutMock,
        } as unknown,
      },
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    } as never);

    const res = await POST(req({ token: 'valid-token' }));
    expect(res.status).toBe(200);
    expect(signOutMock).toHaveBeenCalledWith('user-1', 'global');
  });
});
