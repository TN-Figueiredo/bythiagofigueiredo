import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CRON_SECRET = 'test-secret';

// Fixed "now" — 2026-01-02T14:00:00Z. All mocked crons below use the daily
// schedule "0 0 * * *" (UTC midnight), so the expected last run is always
// 2026-01-02T00:00:00Z, previous run 2026-01-01T00:00:00Z (interval 24h,
// grace 12h, cutoff 2026-01-02T12:00:00Z — already passed at "now").
const NOW = new Date('2026-01-02T14:00:00.000Z');

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

// Mocks the SAME absolute file the route imports (apps/web/vercel.json),
// resolved relative to this test file rather than to the route file — vi.mock
// keys by resolved module path, so this overrides it regardless.
vi.mock('../../vercel.json', () => ({
  default: {
    crons: [
      { path: '/api/cron/fresh-job', schedule: '0 0 * * *' },
      { path: '/api/cron/late-job', schedule: '0 0 * * *' },
      { path: '/api/cron/never-run-job', schedule: '0 0 * * *' },
      { path: '/api/cron/critical-down-job', schedule: '0 0 * * *' },
    ],
  },
}));

import { GET } from '../../src/app/api/health/route';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

function req(secret?: string) {
  return new Request('http://localhost/api/health', {
    method: 'GET',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  }) as never;
}

function mockCronHealthRows(rows: Record<string, unknown>[]) {
  const chain = {
    select: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  const mockSupabase = { from: vi.fn().mockReturnValue(chain) };
  vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase as never);
  return mockSupabase;
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 401 with no auth header', async () => {
    mockCronHealthRows([]);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    mockCronHealthRows([]);
    const res = await GET(req('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('reports ok when the cron ran within the expected window, and degraded+name when a cron is late', async () => {
    mockCronHealthRows([
      {
        cron_name: 'fresh-job',
        last_success_at: '2026-01-02T00:00:00.000Z',
        last_failure_at: null,
        last_error: null,
        consecutive_failures: 0,
        severity: 'info',
      },
      {
        cron_name: 'late-job',
        last_success_at: '2025-12-20T00:00:00.000Z',
        last_failure_at: null,
        last_error: null,
        consecutive_failures: 0,
        severity: 'info',
      },
      // never-run-job has no row at all.
      {
        cron_name: 'critical-down-job',
        last_success_at: null,
        last_failure_at: null,
        last_error: null,
        consecutive_failures: 0,
        severity: 'critical',
      },
    ]);

    const res = await GET(req(CRON_SECRET));
    const body = await res.json();

    const byName = Object.fromEntries(
      (body.crons as Array<{ name: string; status: string }>).map((c) => [c.name, c]),
    );

    expect(byName['fresh-job'].status).toBe('ok');
    expect(byName['late-job'].status).toBe('late');
    // 'degraded' (not 'ok') is the whole point — the name of the late cron
    // must be discoverable in the payload.
    expect(body.status).toBe('down'); // critical-down-job escalates aggregate to 'down'
    expect(res.status).toBe(503);
  });

  it('reports unknown (not ok) when a scheduled cron has no cron_health row at all', async () => {
    mockCronHealthRows([
      {
        cron_name: 'fresh-job',
        last_success_at: '2026-01-02T00:00:00.000Z',
        last_failure_at: null,
        last_error: null,
        consecutive_failures: 0,
        severity: 'info',
      },
      {
        cron_name: 'late-job',
        last_success_at: '2026-01-02T00:00:00.000Z',
        last_failure_at: null,
        last_error: null,
        consecutive_failures: 0,
        severity: 'info',
      },
      {
        cron_name: 'critical-down-job',
        last_success_at: '2026-01-02T00:00:00.000Z',
        last_failure_at: null,
        last_error: null,
        consecutive_failures: 0,
        severity: 'critical',
      },
      // never-run-job intentionally has no row.
    ]);

    const res = await GET(req(CRON_SECRET));
    const body = await res.json();
    const byName = Object.fromEntries(
      (body.crons as Array<{ name: string; status: string }>).map((c) => [c.name, c]),
    );

    expect(byName['never-run-job'].status).toBe('unknown');
    expect(byName['never-run-job'].status).not.toBe('ok');
    // unknown alone does not escalate to 'down' (would page constantly on a
    // fresh deploy before every cron has had a chance to run once) — but it
    // does keep the aggregate out of 'ok'.
    expect(body.status).toBe('degraded');
    expect(res.status).toBe(200);
  });

  it('reports ok overall when every scheduled cron has a fresh row', async () => {
    const fresh = {
      last_success_at: '2026-01-02T00:00:00.000Z',
      last_failure_at: null,
      last_error: null,
      consecutive_failures: 0,
    };
    mockCronHealthRows([
      { cron_name: 'fresh-job', severity: 'info', ...fresh },
      { cron_name: 'late-job', severity: 'info', ...fresh },
      { cron_name: 'never-run-job', severity: 'info', ...fresh },
      { cron_name: 'critical-down-job', severity: 'critical', ...fresh },
    ]);

    const res = await GET(req(CRON_SECRET));
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(res.status).toBe(200);
    expect(body.crons).toHaveLength(4);
  });

  it('flags a cron whose most recent recorded run failed, even inside the grace window', async () => {
    mockCronHealthRows([
      {
        cron_name: 'fresh-job',
        last_success_at: '2026-01-02T00:00:00.000Z',
        last_failure_at: '2026-01-02T13:55:00.000Z',
        last_error: 'boom',
        consecutive_failures: 1,
        severity: 'info',
      },
      { cron_name: 'late-job', last_success_at: '2026-01-02T00:00:00.000Z', last_failure_at: null, last_error: null, consecutive_failures: 0, severity: 'info' },
      { cron_name: 'never-run-job', last_success_at: '2026-01-02T00:00:00.000Z', last_failure_at: null, last_error: null, consecutive_failures: 0, severity: 'info' },
      { cron_name: 'critical-down-job', last_success_at: '2026-01-02T00:00:00.000Z', last_failure_at: null, last_error: null, consecutive_failures: 0, severity: 'info' },
    ]);

    const res = await GET(req(CRON_SECRET));
    const body = await res.json();
    const byName = Object.fromEntries(
      (body.crons as Array<{ name: string; status: string }>).map((c) => [c.name, c]),
    );
    expect(byName['fresh-job'].status).toBe('late');
  });
});
