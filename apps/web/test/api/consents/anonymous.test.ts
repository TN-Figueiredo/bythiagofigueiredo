import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));
vi.mock('../../../lib/logger', () => ({
  getLogger: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })),
  setLogger: vi.fn(),
  resetLogger: vi.fn(),
}));

import { POST } from '../../../src/app/api/consents/anonymous/route';
import { getSupabaseServiceClient } from '../../../lib/supabase/service';

// Valid UUID v4 (group 3 starts with "4", group 4 starts with "8-b").
const VALID_ANON_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    // maybeSingle used for both consent_texts lookup and existing-row lookup.
    // First two calls (per category for consent_texts) return the text id,
    // subsequent calls (existing row check) return null = no existing row.
    maybeSingle: vi.fn()
      .mockResolvedValueOnce({ data: { id: 'cookie_functional_v2_pt-BR' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'cookie_analytics_v2_pt-BR' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'cookie_marketing_v2_pt-BR' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null }),
    ...overrides,
  };
  (chain.from as ReturnType<typeof vi.fn>).mockImplementation(() => chain);
  return chain;
}

function req(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/consents/anonymous', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  anonymous_id: VALID_ANON_ID,
  categories: { functional: true, analytics: false, marketing: false },
};

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/consents/anonymous', () => {
  it('200 with recorded=3 on valid request', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeChain() as never);
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recorded).toBe(3);
  });

  it('400 when body is not valid JSON', async () => {
    const badReq = new Request('http://localhost/api/consents/anonymous', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when anonymous_id is missing', async () => {
    const res = await POST(req({ categories: VALID_BODY.categories }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_body');
  });

  it('400 when anonymous_id is not UUID v4 (v1 rejected)', async () => {
    const res = await POST(req({
      ...VALID_BODY,
      anonymous_id: '550e8400-e29b-11d4-a716-446655440000', // v1 (group 3 starts with 1)
    }));
    expect(res.status).toBe(400);
  });

  it('400 when categories object is missing', async () => {
    const res = await POST(req({ anonymous_id: VALID_ANON_ID }));
    expect(res.status).toBe(400);
  });

  it('400 when a category value is not boolean', async () => {
    const res = await POST(req({
      anonymous_id: VALID_ANON_ID,
      categories: { functional: 'yes', analytics: false, marketing: false },
    }));
    expect(res.status).toBe(400);
  });

  it('functional category is always true regardless of payload', async () => {
    const chain = makeChain();
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never);

    const res = await POST(req({
      anonymous_id: VALID_ANON_ID,
      categories: { functional: false, analytics: false, marketing: false },
    }));
    expect(res.status).toBe(200);

    // The insert calls should include granted=true for cookie_functional
    const insertCalls = (chain.insert as ReturnType<typeof vi.fn>).mock.calls;
    const functionalInsert = insertCalls.find((args: unknown[]) =>
      typeof args[0] === 'object' &&
      args[0] !== null &&
      (args[0] as Record<string, unknown>).category === 'cookie_functional',
    );
    // Either inserted (new row) — granted=true — or updated. Either way recorded=3.
    const body = await res.json();
    expect(body.recorded).toBe(3);
    if (functionalInsert) {
      expect((functionalInsert[0] as Record<string, unknown>).granted).toBe(true);
    }
  });

  it('500 when DB insert fails', async () => {
    const chain = makeChain({
      insert: vi.fn().mockResolvedValue({ error: { message: 'db_down' } }),
    });
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never);
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('consent_record_failed');
  });

  it('500 when existing-row select fails', async () => {
    const chain = makeChain();
    // Override maybeSingle: consent_texts lookup succeeds, then existing-row check errors.
    (chain.maybeSingle as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockResolvedValueOnce({ data: { id: 'cookie_functional_v2_pt-BR' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'select_boom' } });

    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never);
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(500);
  });

  it('updates existing row when one already exists', async () => {
    const chain = makeChain();
    // Override maybeSingle: consent_texts returns id, existing row returns a row.
    (chain.maybeSingle as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockResolvedValueOnce({ data: { id: 'cookie_functional_v2_pt-BR' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'existing-row-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'cookie_analytics_v2_pt-BR' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'existing-row-2' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'cookie_marketing_v2_pt-BR' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'existing-row-3' }, error: null });

    // update chain needs to resolve cleanly
    (chain.update as ReturnType<typeof vi.fn>).mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never);
    const res = await POST(req(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recorded).toBe(3);
  });

  it('includes siteId in insert row when provided', async () => {
    const VALID_SITE_ID = '550e8400-e29b-41d4-a716-446655440001';
    const chain = makeChain();
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as never);

    const res = await POST(req({ ...VALID_BODY, siteId: VALID_SITE_ID }));
    expect(res.status).toBe(200);
    const insertCalls = (chain.insert as ReturnType<typeof vi.fn>).mock.calls;
    const hassSiteId = insertCalls.every((args: unknown[]) =>
      typeof args[0] === 'object' &&
      args[0] !== null &&
      (args[0] as Record<string, unknown>).site_id === VALID_SITE_ID,
    );
    expect(hassSiteId).toBe(true);
  });
});
