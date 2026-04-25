import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks — NO top-level variables referenced inside vi.mock factories ────
// vi.mock is hoisted to the top of the file by Vitest, so factory functions
// cannot close over const/let declared at module scope. Use vi.fn() inline
// and retrieve references with vi.mocked() after the imports.

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
    domainAdapter: { checkDeletionSafety: vi.fn() },
    accountDeletion: { request: vi.fn() },
  }),
}));

vi.mock('../../../lib/logger', () => ({
  getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

// ── Imports after mocks ────────────────────────────────────────────────────
import { POST } from '../../../src/app/api/lgpd/request-deletion/route';
import { requireUser, UnauthenticatedError } from '@tn-figueiredo/auth-nextjs/server';
import { createLgpdContainer } from '../../../src/lib/lgpd/container';
import { verifyRecentlyVerified } from '../../../src/lib/lgpd/verify-cookie';

// ── Helpers ───────────────────────────────────────────────────────────────

function req(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/lgpd/request-deletion', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({}),
  });
}

function setupContainer(opts: {
  canDelete?: boolean;
  blockers?: string[];
  safetyError?: Error;
  requestError?: Error;
  requestResult?: { requestId: string; expiresAt: Date };
} = {}) {
  const {
    canDelete = true,
    blockers = [],
    safetyError,
    requestError,
    requestResult = { requestId: 'req-1', expiresAt: new Date('2026-05-01T00:00:00Z') },
  } = opts;

  const checkDeletionSafety = safetyError
    ? vi.fn().mockRejectedValue(safetyError)
    : vi.fn().mockResolvedValue({ can_delete: canDelete, blockers });

  const requestFn = requestError
    ? vi.fn().mockRejectedValue(requestError)
    : vi.fn().mockResolvedValue(requestResult);

  vi.mocked(createLgpdContainer).mockReturnValue({
    domainAdapter: { checkDeletionSafety },
    accountDeletion: { request: requestFn },
  } as never);

  return { checkDeletionSafety, requestFn };
}

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupContainer();
  // Default: verify cookie passes
  vi.mocked(verifyRecentlyVerified).mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/lgpd/request-deletion', () => {
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

  it('409 when deletion is blocked by safety check', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    setupContainer({ canDelete: false, blockers: ['sole_master_admin'] });

    const res = await POST(req());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('deletion_blocked');
    expect(body.blockers).toContain('sole_master_admin');
  });

  it('409 includes details when present', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    vi.mocked(createLgpdContainer).mockReturnValue({
      domainAdapter: {
        checkDeletionSafety: vi.fn().mockResolvedValue({
          can_delete: false,
          blockers: ['sole_master_admin'],
          details: 'You are the only master admin',
        }),
      },
      accountDeletion: { request: vi.fn() },
    } as never);

    const res = await POST(req());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.details).toBe('You are the only master admin');
  });

  it('500 when safety check throws', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    setupContainer({ safetyError: new Error('db error') });

    const res = await POST(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('safety_check_failed');
  });

  it('202 happy path — returns requestId and expiresAt', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });

    const res = await POST(req());
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.requestId).toBe('req-1');
    expect(body.expiresAt).toBe('2026-05-01T00:00:00.000Z');
  });

  it('500 when accountDeletion.request throws', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    setupContainer({ requestError: new Error('insert failed') });

    const res = await POST(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('request_failed');
  });

  it('rethrows non-UnauthenticatedError from requireUser', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('unexpected'));

    await expect(POST(req())).rejects.toThrow('unexpected');
  });
});
