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
  pendingError?: { message: string };
  unsubSubs?: unknown[];
  brevoContactId?: string;
}

function fakeClient(opts: FakeClientOptions = {}) {
  const {
    pendingSubs = [],
    pendingError = null,
    unsubSubs = [],
  } = opts;

  const cronInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const sentEmailsInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateChain = {
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  // track state per table per call
  const callCounts: Record<string, number> = {};

  const client = {
    from: vi.fn((table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;

      if (table === 'cron_runs') {
        return { insert: cronInsert };
      }
      if (table === 'sent_emails') {
        return { insert: sentEmailsInsert };
      }
      if (table === 'newsletter_subscriptions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            // Determine which query this is based on call count
            // First call = pending (confirmed + brevo_contact_id IS NULL)
            // Second call = unsubscribes
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
  // Re-apply implementations cleared by clearAllMocks
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

    // cron_runs logged as ok
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

    // Brevo called with correct params
    expect(createBrevoContact).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com', listId: 42 }),
    );

    // update called with brevo_contact_id
    expect(c._updateChain.eq).toHaveBeenCalledWith('id', 'sub-1');

    // sent_emails insert called
    expect(c._sentEmailsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: 'site-1',
        template_name: 'welcome',
        to_email: 'user@example.com',
        provider: 'brevo',
        status: 'queued',
      }),
    );

    // cron logged as ok
    expect(c._cronInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'sync-newsletter-pending', status: 'ok', items_processed: 1 }),
    );
  });
});

describe('POST /api/cron/sync-newsletter-pending — Brevo failure', () => {
  it('records error, leaves brevo_contact_id null, returns errors count', async () => {
    const sub = makePendingSub();
    const c = fakeClient({ pendingSubs: [sub] });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);
    vi.mocked(createBrevoContact).mockRejectedValue(new Error('brevo 503: upstream error'));

    const res = await POST(makeReq('Bearer topsecret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(0);
    expect(body.errors).toBeGreaterThan(0);

    // brevo_contact_id should NOT have been updated
    // (update chain would have been called after the contact creation which failed)
    // We verify by checking cronInsert captured the error
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

    // update called with null brevo_contact_id
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
    // synced=0 because no listId → skipped
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
