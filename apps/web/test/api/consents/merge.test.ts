import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mergeFn = vi.fn();

vi.mock('@/lib/lgpd/container', () => ({
  createLgpdContainer: () => ({
    consent: {
      merge: mergeFn,
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
    set: vi.fn(),
  })),
}));

vi.mock('../../../lib/logger', () => ({
  getLogger: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })),
}));

import { POST } from '../../../src/app/api/consents/merge/route';
import {
  requireUser,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';

// Valid UUID v4
const VALID_ANON_ID = '550e8400-e29b-41d4-a716-446655440000';

function req(body: Record<string, unknown>) {
  return new Request('http://localhost/api/consents/merge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.local';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/consents/merge', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthenticatedError());
    const res = await POST(req({ anonymousId: VALID_ANON_ID }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthenticated');
  });

  it('200 with mergedCount on valid authenticated request', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
    mergeFn.mockResolvedValueOnce({ mergedCount: 3 });

    const res = await POST(req({ anonymousId: VALID_ANON_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mergedCount).toBe(3);
    expect(mergeFn).toHaveBeenCalledWith(VALID_ANON_ID, 'user-1');
  });

  it('200 with mergedCount=0 when no anonymous rows exist', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
    mergeFn.mockResolvedValueOnce({ mergedCount: 0 });

    const res = await POST(req({ anonymousId: VALID_ANON_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mergedCount).toBe(0);
  });

  it('400 when anonymousId is missing', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when anonymousId is not a valid UUID v4', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
    // v1 UUID (group 3 starts with 1)
    const res = await POST(req({ anonymousId: '550e8400-e29b-11d4-a716-446655440000' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when body is not valid JSON', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
    const badReq = new Request('http://localhost/api/consents/merge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it('500 when merge throws an unexpected error', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
    mergeFn.mockRejectedValueOnce(new Error('consent.merge: select failed: db_error'));

    const res = await POST(req({ anonymousId: VALID_ANON_ID }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('merge_failed');
  });

  it('re-throws non-UnauthenticatedError auth errors', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('unexpected_auth_error'));
    await expect(POST(req({ anonymousId: VALID_ANON_ID }))).rejects.toThrow('unexpected_auth_error');
  });
});
