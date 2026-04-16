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
    set: () => {},
  })),
}));

import { POST } from '../../../../src/app/api/consents/merge/route';
import {
  requireUser,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';

function makeReq(body: unknown) {
  return new Request('http://x/api/consents/merge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_V4 = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://s.local';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/consents/merge', () => {
  it('401 unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthenticatedError());
    const res = await POST(makeReq({ anonymousId: VALID_V4 }));
    expect(res.status).toBe(401);
  });

  it('400 when anonymousId not v4 UUID', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'u1', email: 'a@b' });
    const res = await POST(makeReq({ anonymousId: 'nope' }));
    expect(res.status).toBe(400);
    expect(mergeFn).not.toHaveBeenCalled();
  });

  it('200 + mergedCount on success', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'u1', email: 'a@b' });
    mergeFn.mockResolvedValueOnce({ mergedCount: 3 });
    const res = await POST(makeReq({ anonymousId: VALID_V4 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mergedCount).toBe(3);
    expect(mergeFn).toHaveBeenCalledWith(VALID_V4, 'u1');
  });

  it('500 on container failure', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'u1', email: 'a@b' });
    mergeFn.mockRejectedValueOnce(new Error('boom'));
    const res = await POST(makeReq({ anonymousId: VALID_V4 }));
    expect(res.status).toBe(500);
  });
});
