import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

import { POST } from '../../src/app/api/cron/purge-sent-emails/route';
import { getSupabaseServiceClient } from '../../lib/supabase/service';
import { setLogger, resetLogger } from '../../lib/logger';

type RpcResponse = { data: unknown; error: unknown };

interface FakeClientOptions {
  tryLock?: RpcResponse;
  purge?: RpcResponse;
}

function fakeClient(opts: FakeClientOptions = {}) {
  const cronInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const rpc = vi.fn((name: string) => {
    if (name === 'cron_try_lock') {
      return Promise.resolve(opts.tryLock ?? { data: true, error: null });
    }
    if (name === 'cron_unlock') {
      return Promise.resolve({ data: true, error: null });
    }
    if (name === 'purge_sent_emails') {
      if (opts.purge && (opts.purge.error || opts.purge.data !== undefined)) {
        return Promise.resolve(opts.purge);
      }
      return Promise.resolve({ data: 0, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
  return {
    rpc,
    from: vi.fn(() => ({ insert: cronInsert })),
    _cronInsert: cronInsert,
  };
}

beforeEach(() => {
  process.env.CRON_SECRET = 'topsecret';
  vi.clearAllMocks();
  setLogger({ warn: () => {}, error: () => {} });
});

afterEach(() => {
  vi.restoreAllMocks();
  resetLogger();
});

describe('POST /api/cron/purge-sent-emails', () => {
  it('401 without bearer', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeClient() as never);
    const req = new Request('http://x/api/cron/purge-sent-emails', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('401 with wrong bearer', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeClient() as never);
    const req = new Request('http://x/api/cron/purge-sent-emails', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    });
    expect((await POST(req)).status).toBe(401);
  });

  it('200 + ok with correct bearer, calls purge RPC, returns deleted_count', async () => {
    const c = fakeClient({ purge: { data: 42, error: null } });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);

    const req = new Request('http://x/api/cron/purge-sent-emails', {
      method: 'POST',
      headers: { authorization: 'Bearer topsecret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deleted_count).toBe(42);
    expect(c.rpc).toHaveBeenCalledWith('purge_sent_emails', { p_older_than_days: 90 });
    expect(c._cronInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'purge-sent-emails', status: 'ok', items_processed: 42 }),
    );
  });

  it('returns locked status when lock held', async () => {
    const c = fakeClient({ tryLock: { data: false, error: null } });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);

    const req = new Request('http://x/api/cron/purge-sent-emails', {
      method: 'POST',
      headers: { authorization: 'Bearer topsecret' },
    });
    const res = await POST(req);
    // withCronLock convention: lock contention → HTTP 200 with {status:'locked'}.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('locked');
    // Purge RPC MUST NOT have been called.
    expect(c.rpc).not.toHaveBeenCalledWith('purge_sent_emails', expect.anything());
  });

  it('500 when RPC returns an error', async () => {
    const c = fakeClient({ purge: { data: null, error: { message: 'boom' } } });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);

    const req = new Request('http://x/api/cron/purge-sent-emails', {
      method: 'POST',
      headers: { authorization: 'Bearer topsecret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('500 when RPC throws', async () => {
    const c = fakeClient();
    c.rpc = vi.fn((name: string) => {
      if (name === 'cron_try_lock') return Promise.resolve({ data: true, error: null });
      if (name === 'cron_unlock') return Promise.resolve({ data: true, error: null });
      if (name === 'purge_sent_emails') return Promise.reject(new Error('net down'));
      return Promise.resolve({ data: null, error: null });
    }) as never;
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);

    const req = new Request('http://x/api/cron/purge-sent-emails', {
      method: 'POST',
      headers: { authorization: 'Bearer topsecret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

describe('vercel.json crons', () => {
  it('schedules purge-sent-emails daily at 06:00 UTC', () => {
    const p = resolve(__dirname, '../../vercel.json');
    expect(existsSync(p)).toBe(true);
    const j = JSON.parse(readFileSync(p, 'utf8'));
    expect(j.crons).toContainEqual({
      path: '/api/cron/purge-sent-emails',
      schedule: '0 6 * * *',
    });
  });
});
