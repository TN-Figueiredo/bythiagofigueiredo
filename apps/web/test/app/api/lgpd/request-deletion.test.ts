import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const requestFn = vi.fn();

vi.mock('@/lib/lgpd/container', () => ({
  createLgpdContainer: () => ({
    accountDeletion: {
      request: requestFn,
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

import { POST } from '../../../../src/app/api/lgpd/request-deletion/route';
import {
  requireUser,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';

function makeReq() {
  return new Request('http://x/api/lgpd/request-deletion', { method: 'POST' });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.local';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  vi.clearAllMocks();
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
});
