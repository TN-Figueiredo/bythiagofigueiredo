import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/turnstile', () => ({ verifyTurnstileToken: vi.fn() }));
vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

import { POST } from '../../src/app/api/campaigns/[slug]/submit/route';
import { verifyTurnstileToken } from '../../lib/turnstile';
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
        id: 'c1', pdf_storage_path: 'pdfs/a.pdf', interest: 'creator',
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

  it('prefers x-vercel-forwarded-for over x-forwarded-for when both set', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);
    const s = fakeSupabase();
    vi.mocked(getSupabaseServiceClient).mockReturnValue(s as never);
    const r = new Request('http://localhost/api/campaigns/my-slug/submit', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '9.9.9.9',
        'x-vercel-forwarded-for': '5.6.7.8',
      },
      body: JSON.stringify({
        email: 'a@b.com', locale: 'pt-BR', consent_marketing: true,
        consent_text_version: 'v1', turnstile_token: 't',
      }),
    });
    await POST(r, { params: Promise.resolve({ slug: 'my-slug' }) });
    const insertCall = s.insert.mock.calls.find((c: unknown[]) =>
      typeof c[0] === 'object' && c[0] !== null && 'campaign_id' in (c[0] as object));
    expect((insertCall?.[0] as { ip?: string }).ip).toBe('5.6.7.8');
  });

  it('uses x-vercel-forwarded-for when it is the only ip header', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);
    const s = fakeSupabase();
    vi.mocked(getSupabaseServiceClient).mockReturnValue(s as never);
    const r = new Request('http://localhost/api/campaigns/my-slug/submit', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-vercel-forwarded-for': '5.6.7.8',
      },
      body: JSON.stringify({
        email: 'a@b.com', locale: 'pt-BR', consent_marketing: true,
        consent_text_version: 'v1', turnstile_token: 't',
      }),
    });
    await POST(r, { params: Promise.resolve({ slug: 'my-slug' }) });
    const insertCall = s.insert.mock.calls.find((c: unknown[]) =>
      typeof c[0] === 'object' && c[0] !== null && 'campaign_id' in (c[0] as object));
    expect((insertCall?.[0] as { ip?: string }).ip).toBe('5.6.7.8');
  });

  it('passes configured PDF TTL to createSignedUrl', async () => {
    process.env.CAMPAIGN_PDF_SIGNED_URL_TTL = '3600';
    vi.resetModules();
    vi.doMock('../../lib/turnstile', () => ({ verifyTurnstileToken: vi.fn().mockResolvedValue(true) }));
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://sig.example/pdf' }, error: null,
    });
    const storage = { from: vi.fn().mockReturnValue({ createSignedUrl }) };
    const chain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'c1', pdf_storage_path: 'pdfs/a.pdf', interest: 'creator',
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
      from: vi.fn(),
    };
    (chain.from as ReturnType<typeof vi.fn>).mockImplementation(() => chain);
    vi.doMock('../../lib/supabase/service', () => ({
      getSupabaseServiceClient: () => chain,
    }));
    const mod = await import('../../src/app/api/campaigns/[slug]/submit/route');
    const r = new Request('http://localhost/api/campaigns/my-slug/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'a@b.com', locale: 'pt-BR', consent_marketing: true,
        consent_text_version: 'v1', turnstile_token: 't',
      }),
    });
    await mod.POST(r, { params: Promise.resolve({ slug: 'my-slug' }) });
    expect(createSignedUrl).toHaveBeenCalledWith('pdfs/a.pdf', 3600);
    delete process.env.CAMPAIGN_PDF_SIGNED_URL_TTL;
    vi.doUnmock('../../lib/supabase/service');
    vi.doUnmock('../../lib/turnstile');
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
