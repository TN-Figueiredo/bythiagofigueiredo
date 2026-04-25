import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CRON_SECRET = 'test-secret';
process.env.CRON_SECRET = CRON_SECRET;

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

// Mock the LGPD container so we don't need adapter wiring in unit tests.
vi.mock('../../../src/lib/lgpd/container', () => ({
  createLgpdContainer: vi.fn(),
}));

import { POST } from '../../../src/app/api/cron/lgpd-cleanup-sweep/route';
import { getSupabaseServiceClient } from '../../../lib/supabase/service';
import { createLgpdContainer } from '../../../src/lib/lgpd/container';
import { setLogger, resetLogger } from '../../../lib/logger';

function fakeSupabase() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ insert });
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === 'cron_try_lock') return Promise.resolve({ data: true, error: null });
    if (name === 'cron_unlock') return Promise.resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  });
  return { rpc, from };
}

function fakeContainer(overrides: Partial<{
  advancePhase3: () => Promise<{ processed: number }>;
  sendReminders: () => Promise<{ sent: number }>;
  deleteExpiredBlobs: () => Promise<{ deleted: number }>;
}> = {}) {
  return {
    cleanupSweep: {
      advancePhase3: vi.fn().mockResolvedValue({ processed: 2 }),
      sendReminders: vi.fn().mockResolvedValue({ sent: 1 }),
      deleteExpiredBlobs: vi.fn().mockResolvedValue({ deleted: 3 }),
      ...overrides,
    },
  };
}

function req(secret?: string) {
  return new Request('http://localhost/api/cron/lgpd-cleanup-sweep', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LGPD_CRON_SWEEP_ENABLED = 'true';
  setLogger({ warn: () => {}, error: () => {} });
});
afterEach(() => {
  vi.restoreAllMocks();
  resetLogger();
  delete process.env.LGPD_CRON_SWEEP_ENABLED;
});

describe('POST /api/cron/lgpd-cleanup-sweep', () => {
  it('returns 401 with no auth header', async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  it('returns 401 with wrong secret', async () => {
    const res = await POST(req('bad'));
    expect(res.status).toBe(401);
  });

  it('returns 204 when feature flag is disabled', async () => {
    process.env.LGPD_CRON_SWEEP_ENABLED = 'false';
    const res = await POST(req(CRON_SECRET));
    expect(res.status).toBe(204);
  });

  it('returns 200 with all counts on success', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeSupabase() as never);
    vi.mocked(createLgpdContainer).mockReturnValue(fakeContainer() as never);

    const res = await POST(req(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.phase3_processed).toBe(2);
    expect(body.reminders_sent).toBe(1);
    expect(body.blobs_deleted).toBe(3);
  });

  it('returns 500 when any sub-job throws', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeSupabase() as never);
    vi.mocked(createLgpdContainer).mockReturnValue(
      fakeContainer({
        advancePhase3: vi.fn().mockRejectedValue(new Error('phase3 failure')),
      }) as never,
    );

    const res = await POST(req(CRON_SECRET));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.err_code).toBe('partial_failure');
    expect(body.errors_count).toBeGreaterThan(0);
  });

  it('continues with remaining jobs even when phase3 fails', async () => {
    const sendReminders = vi.fn().mockResolvedValue({ sent: 5 });
    const deleteExpiredBlobs = vi.fn().mockResolvedValue({ deleted: 2 });

    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeSupabase() as never);
    vi.mocked(createLgpdContainer).mockReturnValue(
      fakeContainer({
        advancePhase3: vi.fn().mockRejectedValue(new Error('transient error')),
        sendReminders,
        deleteExpiredBlobs,
      }) as never,
    );

    const res = await POST(req(CRON_SECRET));
    expect(res.status).toBe(500);
    // Despite phase3 failure, reminders and blobs still ran
    expect(sendReminders).toHaveBeenCalled();
    expect(deleteExpiredBlobs).toHaveBeenCalled();
    const body = await res.json();
    expect(body.reminders_sent).toBe(5);
    expect(body.blobs_deleted).toBe(2);
  });
});
