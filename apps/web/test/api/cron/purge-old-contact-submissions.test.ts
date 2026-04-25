import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CRON_SECRET = 'test-secret';
process.env.CRON_SECRET = CRON_SECRET;

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

import { POST } from '../../../src/app/api/cron/purge-old-contact-submissions/route';
import { getSupabaseServiceClient } from '../../../lib/supabase/service';
import { setLogger, resetLogger } from '../../../lib/logger';

function fakeClient(rpcResult: { data: unknown; error: unknown } = { data: 3, error: null }) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ insert });
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === 'cron_try_lock') return Promise.resolve({ data: true, error: null });
    if (name === 'cron_unlock') return Promise.resolve({ data: null, error: null });
    return Promise.resolve(rpcResult);
  });
  return { rpc, from };
}

function req(secret?: string) {
  return new Request('http://localhost/api/cron/purge-old-contact-submissions', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setLogger({ warn: () => {}, error: () => {} });
});
afterEach(() => {
  vi.restoreAllMocks();
  resetLogger();
});

describe('POST /api/cron/purge-old-contact-submissions', () => {
  it('returns 401 with no auth header', async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  it('returns 401 with wrong secret', async () => {
    const res = await POST(req('wrong'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with anonymized count on success', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeClient({ data: 4, error: null }) as never);
    const res = await POST(req(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.anonymized).toBe(4);
  });

  it('returns 200 with anonymized=0 when rpc returns null', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeClient({ data: null, error: null }) as never);
    const res = await POST(req(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.anonymized).toBe(0);
  });

  it('returns 500 when rpc returns error', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      fakeClient({ data: null, error: { message: 'constraint violation' } }) as never,
    );
    const res = await POST(req(CRON_SECRET));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.err_code).toBe('rpc_failed');
  });
});
