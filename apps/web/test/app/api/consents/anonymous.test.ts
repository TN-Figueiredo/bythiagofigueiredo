import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const recordAnonFn = vi.fn();

vi.mock('@/lib/lgpd/container', () => ({
  createLgpdContainer: () => ({
    consent: {
      recordAnonymous: recordAnonFn,
    },
  }),
}));

import { POST } from '../../../../src/app/api/consents/anonymous/route';

function makeReq(body: unknown) {
  return new Request('http://x/api/consents/anonymous', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_V4 = '11111111-1111-4111-8111-111111111111';
const VALID_SITE = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
  recordAnonFn.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/consents/anonymous', () => {
  it('400 when body invalid (missing category)', async () => {
    const res = await POST(
      makeReq({
        anonymousId: VALID_V4,
        granted: true,
        siteId: VALID_SITE,
      }),
    );
    expect(res.status).toBe(400);
  });

  it('400 when anonymousId is not a v4 UUID', async () => {
    const res = await POST(
      makeReq({
        anonymousId: 'not-a-uuid',
        category: 'analytics',
        granted: true,
        siteId: VALID_SITE,
      }),
    );
    expect(res.status).toBe(400);
    expect(recordAnonFn).not.toHaveBeenCalled();
  });

  it('400 when siteId is not a UUID', async () => {
    const res = await POST(
      makeReq({
        anonymousId: VALID_V4,
        category: 'analytics',
        granted: true,
        siteId: 'site-1',
      }),
    );
    expect(res.status).toBe(400);
    expect(recordAnonFn).not.toHaveBeenCalled();
  });

  it('201 on valid payload', async () => {
    const res = await POST(
      makeReq({
        anonymousId: VALID_V4,
        category: 'analytics',
        granted: false,
        siteId: VALID_SITE,
      }),
    );
    expect(res.status).toBe(201);
    expect(recordAnonFn).toHaveBeenCalledWith(
      VALID_V4,
      'analytics',
      false,
      VALID_SITE,
    );
  });

  it('500 on container failure', async () => {
    recordAnonFn.mockRejectedValueOnce(new Error('db boom'));
    const res = await POST(
      makeReq({
        anonymousId: VALID_V4,
        category: 'analytics',
        granted: true,
        siteId: VALID_SITE,
      }),
    );
    expect(res.status).toBe(500);
  });
});
