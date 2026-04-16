import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const advancePhase3 = vi.fn();
const sendReminders = vi.fn();
const deleteExpiredBlobs = vi.fn();

vi.mock('@/lib/lgpd/container', () => ({
  createLgpdContainer: () => ({
    cleanupSweep: {
      advancePhase3,
      sendReminders,
      deleteExpiredBlobs,
    },
  }),
}));

vi.mock('../../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

import { POST } from '../../../../src/app/api/cron/lgpd-cleanup-sweep/route';
import { getSupabaseServiceClient } from '../../../../lib/supabase/service';
import { setLogger, resetLogger } from '../../../../lib/logger';

function fakeClient() {
  const cronInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const rpc = vi.fn((name: string) => {
    if (name === 'cron_try_lock') {
      return Promise.resolve({ data: true, error: null });
    }
    if (name === 'cron_unlock') {
      return Promise.resolve({ data: true, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
  return {
    rpc,
    from: vi.fn(() => ({ insert: cronInsert })),
  };
}

beforeEach(() => {
  process.env.CRON_SECRET = 'topsecret';
  process.env.LGPD_CRON_SWEEP_ENABLED = 'true';
  setLogger({ warn: () => {}, error: () => {} });
  vi.clearAllMocks();
  advancePhase3.mockResolvedValue({ processed: 0 });
  sendReminders.mockResolvedValue({ sent: 0 });
  deleteExpiredBlobs.mockResolvedValue({ deleted: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
  resetLogger();
  delete process.env.LGPD_CRON_SWEEP_ENABLED;
});

describe('POST /api/cron/lgpd-cleanup-sweep', () => {
  it('401 without bearer', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeClient() as never);
    const req = new Request('http://x/api/cron/lgpd-cleanup-sweep', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('401 on wrong bearer', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeClient() as never);
    const req = new Request('http://x/api/cron/lgpd-cleanup-sweep', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('204 when feature flag is off', async () => {
    process.env.LGPD_CRON_SWEEP_ENABLED = 'false';
    vi.mocked(getSupabaseServiceClient).mockReturnValue(fakeClient() as never);
    const req = new Request('http://x/api/cron/lgpd-cleanup-sweep', {
      method: 'POST',
      headers: { authorization: 'Bearer topsecret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
    // none of the 3 jobs should have been invoked
    expect(advancePhase3).not.toHaveBeenCalled();
    expect(sendReminders).not.toHaveBeenCalled();
    expect(deleteExpiredBlobs).not.toHaveBeenCalled();
  });

  it('200 + aggregated counts on success; calls all 3 jobs', async () => {
    advancePhase3.mockResolvedValueOnce({ processed: 2 });
    sendReminders.mockResolvedValueOnce({ sent: 5 });
    deleteExpiredBlobs.mockResolvedValueOnce({ deleted: 1 });

    const c = fakeClient();
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);
    const req = new Request('http://x/api/cron/lgpd-cleanup-sweep', {
      method: 'POST',
      headers: { authorization: 'Bearer topsecret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.phase3_processed).toBe(2);
    expect(body.reminders_sent).toBe(5);
    expect(body.blobs_deleted).toBe(1);

    expect(advancePhase3).toHaveBeenCalledTimes(1);
    expect(sendReminders).toHaveBeenCalledTimes(1);
    expect(deleteExpiredBlobs).toHaveBeenCalledTimes(1);
  });

  it('returns locked status when lock contested', async () => {
    const c = fakeClient();
    c.rpc = vi.fn((name: string) => {
      if (name === 'cron_try_lock') {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    }) as never;
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);
    const req = new Request('http://x/api/cron/lgpd-cleanup-sweep', {
      method: 'POST',
      headers: { authorization: 'Bearer topsecret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('locked');
    expect(advancePhase3).not.toHaveBeenCalled();
  });

  it('partial failure — phase3 fails but the other 2 still run; returns 500', async () => {
    advancePhase3.mockRejectedValueOnce(new Error('phase3 boom'));
    sendReminders.mockResolvedValueOnce({ sent: 1 });
    deleteExpiredBlobs.mockResolvedValueOnce({ deleted: 2 });

    const c = fakeClient();
    vi.mocked(getSupabaseServiceClient).mockReturnValue(c as never);
    const req = new Request('http://x/api/cron/lgpd-cleanup-sweep', {
      method: 'POST',
      headers: { authorization: 'Bearer topsecret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);

    expect(sendReminders).toHaveBeenCalled();
    expect(deleteExpiredBlobs).toHaveBeenCalled();
  });
});
