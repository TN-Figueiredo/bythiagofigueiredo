import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

vi.mock('../../lib/brevo', () => ({
  createBrevoContact: vi.fn(),
}));

vi.mock('../../lib/email/service', () => ({
  getEmailService: vi.fn(),
}));

vi.mock('../../lib/email/sender', () => ({
  getEmailSender: vi.fn(),
}));

vi.mock('@tn-figueiredo/email', () => ({
  welcomeTemplate: { name: 'welcome', render: vi.fn() },
  ensureUnsubscribeToken: vi.fn(),
}));

import { POST } from '../../src/app/api/cron/sync-newsletter-pending/route';
import { getSupabaseServiceClient } from '../../lib/supabase/service';
import { createBrevoContact } from '../../lib/brevo';
import { getEmailService } from '../../lib/email/service';
import { getEmailSender } from '../../lib/email/sender';
import { ensureUnsubscribeToken } from '@tn-figueiredo/email';

// -----------------------------------------------------------------------
// Fake client builder
// -----------------------------------------------------------------------

function makePendingSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    site_id: 'site-1',
    email: 'user@example.com',
    consent_text_version: 'v1',
    sites: {
      brevo_newsletter_list_id: 42,
      default_locale: 'pt-BR',
      domains: ['example.com'],
      name: 'Example',
    },
    ...overrides,
  };
}

interface FakeClientOptions {
  pendingSubs?: unknown[];
  pendingError?: { message: string } | null;
  unsubSubs?: unknown[];
  lockAcquired?: boolean;
}

function fakeClient(opts: FakeClientOptions = {}) {
  const {
    pendingSubs = [],
    pendingError = null,
    unsubSubs = [],
    lockAcquired = true,
  } = opts;

  const cronInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const sentEmailsInsert = vi.fn().mockResolvedValue({ data: null, error: null });

  // Chainable result for update(...).eq(...) that also supports .is().select() + .like().
  const updateEq = vi.fn().mockImplementation(() => {
    const resolved = { data: [{ id: 'sub-1' }], error: null };
    const obj: Record<string, unknown> = {
      is: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue(resolved),
      }),
      like: vi.fn().mockResolvedValue(resolved),
      select: vi.fn().mockResolvedValue(resolved),
      then: (onFulfilled: (v: typeof resolved) => void) =>
        Promise.resolve(resolved).then(onFulfilled),
    };
    return obj;
  });
  const updateChain = { eq: updateEq };

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
      if (table === 'sent_emails') {
        // Support both the pre-check select-chain (welcome dedupe) and insert.
        const selectChain = {
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        return {
          insert: sentEmailsInsert,
          select: vi.fn().mockReturnValue(selectChain),
        };
      }
      if (table === 'newsletter_subscriptions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            const count = callCounts[table];
            if (count === 1) {
              return Promise.resolve({ data: pendingSubs, error: pendingError });
            }
            return Promise.resolve({ data: unsubSubs, error: null });
          }),
          update: vi.fn().mockReturnValue(updateChain),
        };
      }
      return {};
    }),
    _cronInsert: cronInsert,
    _sentEmailsInsert: sentEmailsInsert,
    _updateChain: updateChain,
  };

  return client;
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

const MOCK_SENDER = {
  email: 'noreply@example.com',
  name: 'Example',
  brandName: 'Example',
  primaryColor: '#0070f3',
};

beforeEach(() => {
  process.env.CRON_SECRET = 'topsecret';
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  vi.clearAllMocks();
  vi.mocked(getEmailSender).mockResolvedValue(MOCK_SENDER);
  vi.mocked(ensureUnsubscribeToken).mockResolvedValue('https://example.com/unsubscribe?token=abc');
  vi.mocked(getEmailService).mockReturnValue({
    sendTemplate: vi.fn().mockResolvedValue({ messageId: 'msg-123', provider: 'brevo' }),
    send: vi.fn(),
  });
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
    // No DB work attempted.
    expect(c._cronInsert).not.toHaveBeenCalled();
  });
});

describe('POST /api/cron/sync-newsletter-pending — no pending subs', () => {
  it('200 with empty response when no pending subs', async () => {
    const c = fakeClient({ pendingSubs: [], unsubSubs: [] });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);
    vi.mocked(createBrevoContact).mockResolvedValue({ id: 99 });

    const res = await POST(makeReq('Bearer topsecret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(0);
    expect(body.unsubscribed).toBe(0);
    expect(body.errors).toBe(0);

    expect(c._cronInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'sync-newsletter-pending', status: 'ok', items_processed: 0 }),
    );
  });
});

describe('POST /api/cron/sync-newsletter-pending — happy path', () => {
  it('200: syncs 1 pending sub, sends welcome email, updates brevo_contact_id', async () => {
    const sub = makePendingSub();
    const c = fakeClient({ pendingSubs: [sub] });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);
    vi.mocked(createBrevoContact).mockResolvedValue({ id: 42 });

    const res = await POST(makeReq('Bearer topsecret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(1);
    expect(body.errors).toBe(0);

    expect(createBrevoContact).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com', listId: 42 }),
    );

    // update().eq('id', ...) called for sentinel-reserve + final brevo_contact_id write.
    expect(c._updateChain.eq).toHaveBeenCalledWith('id', 'sub-1');

    // H8: status is 'sent', not 'queued'.
    expect(c._sentEmailsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: 'site-1',
        template_name: 'welcome',
        to_email: 'user@example.com',
        provider: 'brevo',
        status: 'sent',
      }),
    );

    expect(c._cronInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'sync-newsletter-pending', status: 'ok', items_processed: 1 }),
    );
  });
});

describe('POST /api/cron/sync-newsletter-pending — Brevo failure', () => {
  it('records error, returns errors count', async () => {
    const sub = makePendingSub();
    const c = fakeClient({ pendingSubs: [sub] });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);
    vi.mocked(createBrevoContact).mockRejectedValue(new Error('brevo 503: upstream error'));

    const res = await POST(makeReq('Bearer topsecret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(0);
    expect(body.errors).toBeGreaterThan(0);

    expect(c._cronInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'sync-newsletter-pending', status: 'error' }),
    );
  });
});

describe('POST /api/cron/sync-newsletter-pending — unsubscribe sync', () => {
  it('clears brevo_contact_id for unsubscribed subs', async () => {
    const unsubSub = { id: 'sub-2', brevo_contact_id: 'brevo-ext-99' };
    const c = fakeClient({ pendingSubs: [], unsubSubs: [unsubSub] });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);

    const res = await POST(makeReq('Bearer topsecret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unsubscribed).toBe(1);
    expect(body.synced).toBe(0);

    expect(c._updateChain.eq).toHaveBeenCalledWith('id', 'sub-2');

    expect(c._cronInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'sync-newsletter-pending', status: 'ok', items_processed: 1 }),
    );
  });
});

describe('POST /api/cron/sync-newsletter-pending — skip sub with no list id', () => {
  it('skips sub when site has no brevo_newsletter_list_id', async () => {
    const sub = makePendingSub({
      sites: {
        brevo_newsletter_list_id: null,
        default_locale: 'pt-BR',
        domains: ['example.com'],
        name: 'Example',
      },
    });
    const c = fakeClient({ pendingSubs: [sub] });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);

    const res = await POST(makeReq('Bearer topsecret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(0);
    expect(body.errors).toBe(0);
    expect(createBrevoContact).not.toHaveBeenCalled();
  });
});

describe('vercel.json crons', () => {
  it('schedules publish-scheduled every 5 minutes', () => {
    const p = resolve(__dirname, '../../vercel.json');
    expect(existsSync(p)).toBe(true);
    const j = JSON.parse(readFileSync(p, 'utf8'));
    expect(j.crons).toContainEqual(
      { path: '/api/cron/publish-scheduled', schedule: '*/5 * * * *' },
    );
  });

  it('schedules sync-newsletter-pending every minute', () => {
    const p = resolve(__dirname, '../../vercel.json');
    const j = JSON.parse(readFileSync(p, 'utf8'));
    expect(j.crons).toContainEqual(
      { path: '/api/cron/sync-newsletter-pending', schedule: '* * * * *' },
    );
  });
});
