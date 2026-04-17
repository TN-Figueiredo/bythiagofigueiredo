import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type QueryResult<T> = Promise<{ data: T; error: { message: string } | null }>;

interface FakeChain {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

const consentsInsertFn = vi.fn();
const consentsUpdateFn = vi.fn();
const consentsSelectMaybeSingle = vi.fn();
const consentTextsSelectMaybeSingle = vi.fn();

function makeConsentsChain(): FakeChain {
  const chain: FakeChain = {
    select: vi.fn(() => chain),
    insert: vi.fn((row: unknown) => {
      consentsInsertFn(row);
      return Promise.resolve({ error: null });
    }),
    update: vi.fn((patch: unknown) => {
      consentsUpdateFn(patch);
      return { eq: vi.fn(() => Promise.resolve({ error: null })) } as unknown as FakeChain;
    }),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => consentsSelectMaybeSingle()),
  };
  return chain;
}

function makeConsentTextsChain(): FakeChain {
  const chain: FakeChain = {
    select: vi.fn(() => chain),
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => consentTextsSelectMaybeSingle()),
  };
  return chain;
}

// Route imports '../../../../../lib/supabase/service' relative to its own
// location (apps/web/src/app/api/consents/anonymous/route.ts); from this test
// file the same file lives at '../../../../lib/supabase/service'.
vi.mock('../../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'consents') return makeConsentsChain();
      if (table === 'consent_texts') return makeConsentTextsChain();
      return makeConsentsChain();
    },
  }),
}));

import { POST } from '../../../../src/app/api/consents/anonymous/route';

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://x/api/consents/anonymous', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const VALID_V4 = '11111111-1111-4111-8111-111111111111';
const VALID_SITE = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
  consentsSelectMaybeSingle.mockResolvedValue({ data: null, error: null });
  consentTextsSelectMaybeSingle.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/consents/anonymous', () => {
  it('400 when body invalid (missing categories)', async () => {
    const res = await POST(
      makeReq({
        anonymous_id: VALID_V4,
      }),
    );
    expect(res.status).toBe(400);
  });

  it('400 when anonymous_id is not a v4 UUID', async () => {
    const res = await POST(
      makeReq({
        anonymous_id: 'not-a-uuid',
        categories: { functional: true, analytics: false, marketing: false },
      }),
    );
    expect(res.status).toBe(400);
    expect(consentsInsertFn).not.toHaveBeenCalled();
  });

  it('400 when siteId is not a UUID', async () => {
    const res = await POST(
      makeReq({
        anonymous_id: VALID_V4,
        categories: { functional: true, analytics: true, marketing: false },
        siteId: 'site-1',
      }),
    );
    expect(res.status).toBe(400);
    expect(consentsInsertFn).not.toHaveBeenCalled();
  });

  it('200 + recorded:3 on valid payload, inserts 3 categories', async () => {
    const res = await POST(
      makeReq(
        {
          anonymous_id: VALID_V4,
          categories: { functional: true, analytics: true, marketing: false },
          version: 1,
          siteId: VALID_SITE,
        },
        { 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'user-agent': 'TestUA/1.0' },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recorded).toBe(3);
    expect(consentsInsertFn).toHaveBeenCalledTimes(3);
    const firstCall = consentsInsertFn.mock.calls[0]![0] as Record<string, unknown>;
    expect(firstCall.anonymous_id).toBe(VALID_V4);
    expect(firstCall.category).toBe('cookie_functional');
    expect(firstCall.granted).toBe(true);
    expect(firstCall.ip).toBe('1.2.3.4');
    expect(firstCall.user_agent).toBe('TestUA/1.0');
    expect(firstCall.site_id).toBe(VALID_SITE);
  });

  it('functional is always granted=true even if false passed', async () => {
    await POST(
      makeReq({
        anonymous_id: VALID_V4,
        // If a malicious client passes functional:false, we must force it true.
        categories: { functional: false as unknown as true, analytics: false, marketing: false },
      }),
    );
    const funcCall = consentsInsertFn.mock.calls.find(
      (c) => (c[0] as { category: string }).category === 'cookie_functional',
    );
    expect(funcCall).toBeDefined();
    expect((funcCall![0] as { granted: boolean }).granted).toBe(true);
  });

  it('500 when DB insert fails', async () => {
    consentsInsertFn.mockImplementationOnce(() => {
      throw new Error('unused');
    });
    // The route catches exceptions and maps to 500 — easier repro: mock select error.
    consentsSelectMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'db boom' },
    });
    const res = await POST(
      makeReq({
        anonymous_id: VALID_V4,
        categories: { functional: true, analytics: true, marketing: true },
      }),
    );
    expect(res.status).toBe(500);
  });
});
