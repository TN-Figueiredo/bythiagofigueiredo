import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logCron, newRunId, withCronLock } from '../../lib/logger';

describe('logCron', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('emits a single-line JSON object on console.log for ok status', () => {
    logCron({ job: 'test-job', run_id: 'r1', status: 'ok', duration_ms: 42 });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).not.toHaveBeenCalled();

    const arg = logSpy.mock.calls[0]?.[0] as string;
    expect(typeof arg).toBe('string');
    expect(arg).not.toContain('\n');
    const parsed = JSON.parse(arg) as Record<string, unknown>;
    expect(parsed.job).toBe('test-job');
    expect(parsed.run_id).toBe('r1');
    expect(parsed.status).toBe('ok');
    expect(parsed.duration_ms).toBe(42);
    expect(typeof parsed.timestamp).toBe('string');
    expect(() => new Date(parsed.timestamp as string).toISOString()).not.toThrow();
  });

  it('emits via console.error for error status and preserves custom fields', () => {
    logCron({
      job: 'test-job',
      run_id: 'r2',
      status: 'error',
      err_code: 'brevo_down',
      site_id: 'site-uuid',
      errors_count: 3,
    });

    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    const parsed = JSON.parse(errSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed.status).toBe('error');
    expect(parsed.err_code).toBe('brevo_down');
    expect(parsed.site_id).toBe('site-uuid');
    expect(parsed.errors_count).toBe(3);
  });

  it('uses console.log (not error) for locked status', () => {
    logCron({ job: 'test-job', run_id: 'r3', status: 'locked' });
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).not.toHaveBeenCalled();
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed.status).toBe('locked');
  });

  it('uses console.log for skipped status', () => {
    logCron({ job: 'test-job', status: 'skipped' });
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).not.toHaveBeenCalled();
  });
});

describe('newRunId', () => {
  it('returns a UUID v4 string', () => {
    const id = newRunId();
    expect(typeof id).toBe('string');
    // RFC 4122 UUID v4 — 8-4-4-4-12 hex with version nibble = 4 and variant nibble in [8,9,a,b].
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('returns distinct values across calls', () => {
    const ids = new Set([newRunId(), newRunId(), newRunId(), newRunId()]);
    expect(ids.size).toBe(4);
  });
});

describe('withCronLock', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  function makeSupabase(lockResult: { data: boolean | null; error: unknown }) {
    const calls: Array<{ fn: string; args: unknown }> = [];
    const rpc = vi.fn(async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      if (fn === 'cron_try_lock') return lockResult;
      if (fn === 'cron_unlock') return { data: null, error: null };
      return { data: null, error: null };
    });
    return { rpc, calls } as unknown as {
      rpc: ReturnType<typeof vi.fn>;
      calls: Array<{ fn: string; args: unknown }>;
    };
  }

  it('returns 200 {status:locked} when lock is contended and logs locked', async () => {
    const sb = makeSupabase({ data: false, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await withCronLock(sb as any, 'cron:test', 'run-1', 'test-job', async () => ({
      status: 'ok' as const,
    }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('locked');

    // Logged the locked event.
    const line = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.status).toBe('locked');
    expect(parsed.run_id).toBe('run-1');

    // fn never ran => only cron_try_lock (no unlock because we early-returned).
    expect((sb.rpc as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual([
      'cron_try_lock',
    ]);
  });

  it('returns 200 with payload and logs ok on success, releases lock', async () => {
    const sb = makeSupabase({ data: true, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await withCronLock(sb as any, 'cron:test', 'run-2', 'test-job', async () => ({
      status: 'ok' as const,
      processed: 5,
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ processed: 5 });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed.status).toBe('ok');
    expect(parsed.processed).toBe(5);
    expect(typeof parsed.duration_ms).toBe('number');

    expect((sb.rpc as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual([
      'cron_try_lock',
      'cron_unlock',
    ]);
  });

  it('returns 500 and logs error when fn returns error status', async () => {
    const sb = makeSupabase({ data: true, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await withCronLock(sb as any, 'cron:test', 'run-3', 'test-job', async () => ({
      status: 'error' as const,
      err_code: 'boom',
    }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ err_code: 'boom' });
    const parsed = JSON.parse(errSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed.status).toBe('error');
    expect(parsed.err_code).toBe('boom');
  });

  it('returns 500 and logs error when fn throws, still releases lock', async () => {
    const sb = makeSupabase({ data: true, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await withCronLock(sb as any, 'cron:test', 'run-4', 'test-job', async () => {
      throw new Error('kaboom');
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'cron_failed' });
    const parsed = JSON.parse(errSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed.status).toBe('error');
    expect(parsed.err_code).toBe('unhandled');
    expect(parsed.error).toBe('kaboom');

    expect((sb.rpc as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual([
      'cron_try_lock',
      'cron_unlock',
    ]);
  });

  it('fails open (runs fn) when cron_try_lock RPC errors', async () => {
    const sb = makeSupabase({ data: null, error: { message: 'rpc missing' } });
    const fn = vi.fn(async () => ({ status: 'ok' as const, processed: 1 }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await withCronLock(sb as any, 'cron:test', 'run-5', 'test-job', fn);
    expect(fn).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
