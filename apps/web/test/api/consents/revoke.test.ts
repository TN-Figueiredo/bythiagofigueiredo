import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
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

import { POST } from '../../../src/app/api/consents/revoke/route';
import {
  requireUser,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';
import { getSupabaseServiceClient } from '../../../lib/supabase/service';

function makeUpdateChain(resolvedData: { data: Array<{ id: string }> | null; error: { message: string } | null }) {
  // The route builds: admin.from(...).update(...).eq(...).eq(...).is(...) then
  // branches to .is('site_id', null) or .eq('site_id', id) and finally calls
  // .select('id'). We model a single fluent chain where every method returns
  // `chain` so any call ordering works, and `select` returns the resolved data.
  const chain: Record<string, unknown> = {
    update: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    select: vi.fn().mockResolvedValue(resolvedData),
    from: vi.fn(),
  };
  (chain.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.update as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.eq as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.is as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

function req(body: Record<string, unknown>) {
  return new Request('http://localhost/api/consents/revoke', {
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

describe('POST /api/consents/revoke', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthenticatedError());
    const res = await POST(req({ category: 'cookie_analytics' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthenticated');
  });

  it('200 { revoked: true } on success', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
    const chain = makeUpdateChain({ data: [{ id: 'consent-1' }], error: null });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never);

    const res = await POST(req({ category: 'cookie_analytics' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revoked).toBe(true);
  });

  it('404 when no active consent row found', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
    const chain = makeUpdateChain({ data: [], error: null });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never);

    const res = await POST(req({ category: 'cookie_marketing' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });

  it('404 when data is null', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
    const chain = makeUpdateChain({ data: null, error: null });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never);

    const res = await POST(req({ category: 'newsletter' }));
    expect(res.status).toBe(404);
  });

  it('400 when category is missing', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when category is not one of the allowed enum values', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
    const res = await POST(req({ category: 'unknown_category' }));
    expect(res.status).toBe(400);
  });

  it('400 when body is not valid JSON', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
    const badReq = new Request('http://localhost/api/consents/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it('500 when DB update returns an error', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
    const chain = makeUpdateChain({ data: null, error: { message: 'db_down' } });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never);

    const res = await POST(req({ category: 'privacy_policy' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('revoke_failed');
  });

  it('accepts all valid category enum values', async () => {
    const categories = [
      'cookie_functional',
      'cookie_analytics',
      'cookie_marketing',
      'newsletter',
      'privacy_policy',
      'terms_of_service',
    ];
    for (const category of categories) {
      vi.mocked(requireUser).mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com' });
      const chain = makeUpdateChain({ data: [{ id: 'consent-1' }], error: null });
      vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never);

      const res = await POST(req({ category }));
      expect(res.status).toBe(200);
    }
  });

  it('re-throws non-UnauthenticatedError auth errors', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('session_error'));
    await expect(POST(req({ category: 'cookie_analytics' }))).rejects.toThrow('session_error');
  });
});
