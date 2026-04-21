import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

const sendMock = vi.fn().mockResolvedValue({ messageId: 'msg_w1', provider: 'resend' });

vi.mock('../../lib/email/service', () => ({
  getEmailService: () => ({ send: sendMock }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import { POST } from '../../src/app/api/cron/sync-newsletter-pending/route';
import { getSupabaseServiceClient } from '../../lib/supabase/service';

// -----------------------------------------------------------------------
// Fake client builder
// -----------------------------------------------------------------------

interface FakeClientOptions {
  pendingSubs?: unknown[];
  pendingError?: { message: string } | null;
  lockAcquired?: boolean;
}

function fakeClient(opts: FakeClientOptions = {}) {
  const {
    pendingSubs = [],
    pendingError = null,
    lockAcquired = true,
  } = opts;

  const cronInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  const callCounts: Record<string, number> = {};

  const client = {
    rpc: vi.fn().mockImplementation((fn: string) => {
      if (fn === 'cron_try_lock') return Promise.resolve({ data: lockAcquired, error: null });
      if (fn === 'cron_unlock') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    }),
    from: vi.fn((table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;

      if (table === 'cron_runs') {
        return { insert: cronInsert };
      }
      if (table === 'newsletter_subscriptions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            return Promise.resolve({ data: pendingSubs, error: pendingError });
          }),
          update: updateMock,
        };
      }
      return {};
    }),
    _cronInsert: cronInsert,
    _updateMock: updateMock,
  };

  return client;
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

beforeEach(() => {
  process.env.CRON_SECRET = 'topsecret';
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  vi.clearAllMocks();
  sendMock.mockResolvedValue({ messageId: 'msg_w1', provider: 'resend' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeReq(auth?: string) {
  return new Request('http://x/api/cron/sync-newsletter-pending', {
    method: 'POST',
    headers: auth ? { authorization: auth } : {},
  });
}

describe('POST /api/cron/sync-newsletter-pending — auth', () => {
  it('401 without authorization header', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeClient() as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  it('401 with wrong bearer token', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeClient() as never);
    const res = await POST(makeReq('Bearer wrong'));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/cron/sync-newsletter-pending — locking', () => {
  it('returns {status:locked} when advisory lock is held', async () => {
    const c = fakeClient({ lockAcquired: false });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);
    const res = await POST(makeReq('Bearer topsecret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('locked');
    expect(c._cronInsert).not.toHaveBeenCalled();
  });
});

describe('POST /api/cron/sync-newsletter-pending — no pending subs', () => {
  it('200 with empty response when no pending subs', async () => {
    const c = fakeClient({ pendingSubs: [] });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);

    const res = await POST(makeReq('Bearer topsecret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(0);

    expect(c._cronInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'sync-newsletter-pending', status: 'ok', items_processed: 0 }),
    );
  });
});

describe('POST /api/cron/sync-newsletter-pending — happy path', () => {
  it('sends welcome email and sets welcome_sent=true', async () => {
    const sub = {
      id: 'sub-1',
      site_id: 'site-1',
      email: 'user@example.com',
      consent_text_version: 'v1',
    };
    const c = fakeClient({ pendingSubs: [sub] });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);

    const res = await POST(makeReq('Bearer topsecret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(1);

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'user@example.com',
      subject: expect.stringContaining('Welcome'),
    }));

    // Verify update({ welcome_sent: true }) was called
    expect(c._updateMock).toHaveBeenCalledWith({ welcome_sent: true });

    expect(c._cronInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'sync-newsletter-pending', status: 'ok', items_processed: 1 }),
    );
  });
});

describe('POST /api/cron/sync-newsletter-pending — email failure', () => {
  it('records error when email send fails', async () => {
    const sub = {
      id: 'sub-1',
      site_id: 'site-1',
      email: 'user@example.com',
      consent_text_version: 'v1',
    };
    const c = fakeClient({ pendingSubs: [sub] });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);
    sendMock.mockRejectedValueOnce(new Error('resend 500: upstream error'));

    const res = await POST(makeReq('Bearer topsecret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.errors_count).toBeGreaterThan(0);

    expect(c._cronInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'sync-newsletter-pending', status: 'error' }),
    );
  });
});
