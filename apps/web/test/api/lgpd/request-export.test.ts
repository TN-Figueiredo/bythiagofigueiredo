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

// Mock verifyRecentlyVerified so we can control its return value per test
vi.mock('../../../src/lib/lgpd/verify-cookie', () => ({
  verifyRecentlyVerified: vi.fn(),
  LGPD_VERIFY_COOKIE_NAME: 'lgpd_recently_verified',
}));

vi.mock('../../../src/lib/lgpd/container', () => ({
  createLgpdContainer: vi.fn().mockReturnValue({
    dataExport: { request: vi.fn() },
  }),
}));

vi.mock('../../../lib/logger', () => ({
  getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

// ── Imports after mocks ────────────────────────────────────────────────────
import { POST } from '../../../src/app/api/lgpd/request-export/route';
import { requireUser, UnauthenticatedError } from '@tn-figueiredo/auth-nextjs/server';
import { createLgpdContainer } from '../../../src/lib/lgpd/container';
import { verifyRecentlyVerified } from '../../../src/lib/lgpd/verify-cookie';

// ── Helpers ───────────────────────────────────────────────────────────────

function req(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/lgpd/request-export', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({}),
  });
}

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default: cookie passes, export succeeds
  vi.mocked(verifyRecentlyVerified).mockReturnValue(true);
  vi.mocked(createLgpdContainer).mockReturnValue({
    dataExport: {
      request: vi.fn().mockResolvedValue({
        requestId: 'export-1',
        expiresAt: new Date('2026-04-26T00:00:00Z'),
      }),
    },
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/lgpd/request-export', () => {
  it('401 when user is not authenticated', async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthenticatedError());

    const res = await POST(req());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthenticated');
  });

  it('403 when verify cookie check returns false', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    vi.mocked(verifyRecentlyVerified).mockReturnValue(false);

    const res = await POST(req());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('password_reauth_required');
  });

  it('200 happy path — returns requestId and expiresAt', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });

    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestId).toBe('export-1');
    expect(body.expiresAt).toBe('2026-04-26T00:00:00.000Z');
  });

  it('429 when export service throws rate_limited', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    vi.mocked(createLgpdContainer).mockReturnValue({
      dataExport: {
        request: vi.fn().mockRejectedValue(new Error('rate_limited: max 1 per 30d')),
      },
    } as never);

    const res = await POST(req());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('rate_limited');
  });

  it('429 when export service throws rate_limit (alternate phrasing)', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    vi.mocked(createLgpdContainer).mockReturnValue({
      dataExport: {
        request: vi.fn().mockRejectedValue(new Error('rate_limit exceeded')),
      },
    } as never);

    const res = await POST(req());
    expect(res.status).toBe(429);
  });

  it('409 when export service throws pending_deletion', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    vi.mocked(createLgpdContainer).mockReturnValue({
      dataExport: {
        request: vi.fn().mockRejectedValue(new Error('pending_deletion')),
      },
    } as never);

    const res = await POST(req());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('pending_deletion');
  });

  it('409 when export service throws deletion_in_progress', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    vi.mocked(createLgpdContainer).mockReturnValue({
      dataExport: {
        request: vi.fn().mockRejectedValue(new Error('deletion_in_progress')),
      },
    } as never);

    const res = await POST(req());
    expect(res.status).toBe(409);
  });

  it('500 when export service throws generic error', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    vi.mocked(createLgpdContainer).mockReturnValue({
      dataExport: {
        request: vi.fn().mockRejectedValue(new Error('unexpected db failure')),
      },
    } as never);

    const res = await POST(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('export_failed');
  });

  it('rethrows non-UnauthenticatedError from requireUser', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('unexpected auth error'));

    await expect(POST(req())).rejects.toThrow('unexpected auth error');
  });
});
