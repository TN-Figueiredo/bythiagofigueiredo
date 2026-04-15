import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBrevoContact } from '../../lib/brevo';

const OLD_ENV = process.env;

beforeEach(() => {
  process.env = { ...OLD_ENV, BREVO_API_KEY: 'test-key' };
});
afterEach(() => {
  process.env = OLD_ENV;
  vi.restoreAllMocks();
});

describe('createBrevoContact', () => {
  it('POSTs to /v3/contacts with api-key header and correct body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 201, json: async () => ({ id: 123 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const r = await createBrevoContact({
      email: 'x@y.com', name: 'Thiago', listId: 7, attributes: { SOURCE: 'test' },
    });

    expect(r).toEqual({ id: 123 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/contacts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'api-key': 'test-key',
          'content-type': 'application/json',
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      email: 'x@y.com',
      listIds: [7],
      attributes: { FIRSTNAME: 'Thiago', SOURCE: 'test' },
      updateEnabled: true,
    });
  });

  it('throws on non-ok 5xx response after retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 500, text: async () => 'server err',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createBrevoContact({ email: 'x@y.com', listId: 1 }))
      .rejects.toThrow(/brevo 500/);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('throws immediately on 4xx without retrying (AbortError)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 400, text: async () => 'bad request',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createBrevoContact({ email: 'x@y.com', listId: 1 }))
      .rejects.toThrow(/brevo 400/);
    expect(fetchMock.mock.calls.length).toBe(1);
  });

  it('retries transient 5xx and succeeds on the 3rd attempt', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, text: async () => 'bad gw' })
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'busy' })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: 7 }) });
    vi.stubGlobal('fetch', fetchMock);

    const r = await createBrevoContact({ email: 'x@y.com', listId: 1 });
    expect(r).toEqual({ id: 7 });
    expect(fetchMock.mock.calls.length).toBe(3);
  });

  it('returns contact object for 204 no-content (updateEnabled existing)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 204, json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const r = await createBrevoContact({ email: 'x@y.com', listId: 1 });
    expect(r).toEqual({});
  });
});
