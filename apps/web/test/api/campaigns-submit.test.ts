import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/turnstile', () => ({ verifyTurnstileToken: vi.fn() }));
vi.mock('../../lib/brevo', () => ({ createBrevoContact: vi.fn() }));
vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

import { POST } from '../../src/app/api/campaigns/[slug]/submit/route';
import { verifyTurnstileToken } from '../../lib/turnstile';
import { createBrevoContact } from '../../lib/brevo';
import { getSupabaseServiceClient } from '../../lib/supabase/service';
import { setLogger, resetLogger } from '../../lib/logger';

function fakeSupabase(overrides: Record<string, unknown> = {}) {
  const storage = {
    from: vi.fn().mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://sig.example/pdf' }, error: null,
      }),
    }),
  };
  const chain = {
    from: vi.fn(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: 'c1', brevo_list_id: 42, pdf_storage_path: 'pdfs/a.pdf', interest: 'creator',
        campaign_translations: [{
          success_headline: 'OK', success_headline_duplicate: 'Again',
          success_subheadline: 'Sub', success_subheadline_duplicate: 'SubDup',
          check_mail_text: 'Check', download_button_label: 'Download',
        }],
      }, error: null,
    }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'sub1' }, error: null }),
    storage,
    ...overrides,
  };
  chain.from.mockImplementation(() => chain);
  return chain;
}

function req(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/campaigns/my-slug/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9', ...headers },
    body: JSON.stringify(body),
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

describe('POST /api/campaigns/[slug]/submit', () => {
  it('400 when Turnstile invalid', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(false);
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeSupabase() as never);
    const res = await POST(req({
      email: 'a@b.com', locale: 'pt-BR', consent_marketing: true,
      consent_text_version: 'v1', turnstile_token: 'bad',
    }), { params: Promise.resolve({ slug: 'my-slug' }) });
    expect(res.status).toBe(400);
  });

  it('400 when consent=false', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeSupabase() as never);
    const res = await POST(req({
      email: 'a@b.com', locale: 'pt-BR', consent_marketing: false,
      consent_text_version: 'v1', turnstile_token: 't',
    }), { params: Promise.resolve({ slug: 'my-slug' }) });
    expect(res.status).toBe(400);
  });

  it('200 with pdfUrl on valid submit', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);
    vi.mocked(createBrevoContact).mockResolvedValue({ id: 99 });
    const s = fakeSupabase();
    vi.mocked(getSupabaseServiceClient).mockReturnValue(s as never);

    const res = await POST(req({
      email: 'a@b.com', name: 'Thiago', locale: 'pt-BR',
      consent_marketing: true, consent_text_version: 'v1', turnstile_token: 't',
    }), { params: Promise.resolve({ slug: 'my-slug' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.duplicate).toBe(false);
    expect(body.pdfUrl).toBe('https://sig.example/pdf');
    expect(body.successCopy.headline).toBe('OK');
  });

  it('200 duplicate=true when email collision', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);
    const s = fakeSupabase();
    // simulate unique_violation on insert
    s.single.mockResolvedValueOnce({ data: null, error: { code: '23505' } });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(s as never);

    const res = await POST(req({
      email: 'a@b.com', locale: 'pt-BR', consent_marketing: true,
      consent_text_version: 'v1', turnstile_token: 't',
    }), { params: Promise.resolve({ slug: 'my-slug' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duplicate).toBe(true);
    expect(body.successCopy.headline).toBe('Again');
  });

  it('200 with status=failed in DB when Brevo fails', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);
    vi.mocked(createBrevoContact).mockRejectedValue(new Error('brevo 500'));
    const s = fakeSupabase();
    vi.mocked(getSupabaseServiceClient).mockReturnValue(s as never);

    const res = await POST(req({
      email: 'a@b.com', locale: 'pt-BR', consent_marketing: true,
      consent_text_version: 'v1', turnstile_token: 't',
    }), { params: Promise.resolve({ slug: 'my-slug' }) });

    expect(res.status).toBe(200);
    // verify update call was made with brevo_sync_status='failed'
    const updateCalls = s.update.mock.calls;
    expect(updateCalls.some((c: unknown[]) =>
      JSON.stringify(c[0]).includes('"brevo_sync_status":"failed"'))).toBe(true);
  });

  it('404 when campaign not found', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);
    const s = fakeSupabase();
    s.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(s as never);

    const res = await POST(req({
      email: 'a@b.com', locale: 'pt-BR', consent_marketing: true,
      consent_text_version: 'v1', turnstile_token: 't',
    }), { params: Promise.resolve({ slug: 'missing' }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('campaign_not_found');
  });
});
