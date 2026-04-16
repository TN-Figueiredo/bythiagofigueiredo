import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const exportRequestFn = vi.fn();

vi.mock('@/lib/lgpd/container', () => ({
  createLgpdContainer: () => ({
    dataExport: {
      request: exportRequestFn,
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

import { POST } from '../../../../src/app/api/lgpd/request-export/route';
import {
  requireUser,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';

function makeReq() {
  return new Request('http://x/api/lgpd/request-export', { method: 'POST' });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.local';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/lgpd/request-export', () => {
  it('401 unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthenticatedError());
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('200 + requestId + expiresAt on success', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    const expiresAt = new Date(Date.now() + 7 * 86_400_000);
    exportRequestFn.mockResolvedValueOnce({
      requestId: 'exp-123',
      signedUrl: 'https://s.local/x',
      expiresAt,
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestId).toBe('exp-123');
    expect(body.expiresAt).toBe(expiresAt.toISOString());
    // Raw signed URL MUST NOT leak in the HTTP response — it's emailed instead.
    expect(body.signedUrl).toBeUndefined();
  });

  it('429 when rate limited (container rejects with rate_limited)', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    exportRequestFn.mockRejectedValueOnce(new Error('rate_limited'));

    const res = await POST(makeReq());
    expect(res.status).toBe(429);
  });

  it('409 when user has pending deletion', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    exportRequestFn.mockRejectedValueOnce(new Error('pending_deletion'));

    const res = await POST(makeReq());
    expect(res.status).toBe(409);
  });

  it('500 on unknown error', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
    });
    exportRequestFn.mockRejectedValueOnce(new Error('boom'));

    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });
});
