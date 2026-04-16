import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const downloadFn = vi.fn();

vi.mock('@/lib/lgpd/container', () => ({
  createLgpdContainer: () => ({
    dataExport: {
      download: downloadFn,
    },
  }),
}));

import { GET } from '../../../../src/app/api/lgpd/download-export/[token]/route';

function makeReq(token: string) {
  return new Request(
    `http://x/api/lgpd/download-export/${encodeURIComponent(token)}`,
    { method: 'GET' },
  );
}

function ctx(token: string) {
  return { params: Promise.resolve({ token }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/lgpd/download-export/[token]', () => {
  it('400 when token missing', async () => {
    const res = await GET(makeReq(''), ctx(''));
    expect(res.status).toBe(400);
  });

  it('302 redirect to signedUrl on success', async () => {
    downloadFn.mockResolvedValueOnce({
      signedUrl: 'https://storage.local/signed?sig=abc',
    });

    const res = await GET(makeReq('raw'), ctx('raw'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      'https://storage.local/signed?sig=abc',
    );
    // Don't let downstream CDN cache a short-TTL signed URL.
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('410 for invalid/expired token', async () => {
    downloadFn.mockRejectedValueOnce(new Error('invalid_token'));
    const res = await GET(makeReq('bad'), ctx('bad'));
    expect(res.status).toBe(410);
  });
});
