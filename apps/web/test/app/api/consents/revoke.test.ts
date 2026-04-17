import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mutable response the fake supabase chain's terminal .select() resolves to.
let terminalResponse: {
  data: Array<{ id: string }> | null;
  error: { message: string } | null;
} = { data: [{ id: 'c1' }], error: null };

const updateSpy = vi.fn();

function makeConsentsChain() {
  const chain: Record<string, unknown> = {};
  chain.update = vi.fn((patch: unknown) => {
    updateSpy(patch);
    return chain;
  });
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.select = vi.fn(() => Promise.resolve(terminalResponse));
  return chain;
}

vi.mock('../../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => makeConsentsChain(),
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

import { POST } from '../../../../src/app/api/consents/revoke/route';
import {
  requireUser,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';

function makeReq(body: unknown) {
  return new Request('http://x/api/consents/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://s.local';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  vi.clearAllMocks();
  terminalResponse = { data: [{ id: 'c1' }], error: null };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/consents/revoke', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthenticatedError());
    const res = await POST(makeReq({ category: 'cookie_analytics' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthenticated');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('400 when body invalid (missing category)', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'u1', email: 'a@b' });
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('400 when category not in allowed enum', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'u1', email: 'a@b' });
    const res = await POST(makeReq({ category: 'random_thing' }));
    expect(res.status).toBe(400);
  });

  it('404 when no active consent matches', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'u1', email: 'a@b' });
    terminalResponse = { data: [], error: null };
    const res = await POST(makeReq({ category: 'cookie_marketing' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });

  it('200 { revoked: true } on happy path, writes withdrawn_at', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'u1', email: 'a@b' });
    const res = await POST(makeReq({ category: 'cookie_analytics' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revoked).toBe(true);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const patch = updateSpy.mock.calls[0]![0] as { withdrawn_at: string };
    expect(typeof patch.withdrawn_at).toBe('string');
    expect(new Date(patch.withdrawn_at).toString()).not.toBe('Invalid Date');
  });

  it('500 when update errors', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'u1', email: 'a@b' });
    terminalResponse = { data: null, error: { message: 'boom' } };
    const res = await POST(makeReq({ category: 'cookie_analytics' }));
    expect(res.status).toBe(500);
  });
});
