/**
 * Tests for src/lib/logger.ts#withCronLock — the SECOND withCronLock
 * implementation (in-memory per-process lock, used by 6 routes including
 * ab-draft-cleanup, instagram-token-refresh, social-metrics, instagram-sync,
 * social-publish, social-auto-draft), as distinct from apps/web/lib/logger.ts
 * (advisory-lock version covering ~25 routes, see test/lib/logger.test.ts).
 *
 * Critico 1a / Menor 6 (docs/superpowers/plans/2026-09-02-falhas-silenciosas.md):
 * this implementation had the SAME "wrapper overwrites a route-recorded
 * failure" defect as the other withCronLock, and its errorMessageFromResult
 * helper had drifted from the other file's (this one already checked
 * err_code; the other only checked `error` until this fix unified them).
 * These tests would fail if the health_written mechanism regressed here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/lib/cron-health', () => ({
  recordCronSuccess: vi.fn().mockResolvedValue(undefined),
  recordCronFailure: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { withCronLock, newRunId } from '../../src/lib/logger'
import { recordCronSuccess, recordCronFailure } from '../../src/lib/cron-health'

function makeSupabase() {
  return {} as unknown as Parameters<typeof withCronLock>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('newRunId', () => {
  it('returns a UUID string', () => {
    expect(typeof newRunId()).toBe('string')
    expect(newRunId()).not.toBe(newRunId())
  })
})

describe('withCronLock (in-memory lock)', () => {
  it('writes recordCronSuccess by default when fn returns status ok', async () => {
    const res = await withCronLock(makeSupabase(), 'lock:a', 'run-1', 'job-a', async () => ({
      status: 'ok' as const,
      processed: 3,
    }))
    expect(res.status).toBe(200)
    expect(recordCronSuccess).toHaveBeenCalledWith('job-a')
    expect(recordCronFailure).not.toHaveBeenCalled()
  })

  it('writes recordCronFailure by default when fn returns status error, using err_code fallback', async () => {
    await withCronLock(makeSupabase(), 'lock:b', 'run-2', 'job-b', async () => ({
      status: 'error' as const,
      err_code: 'boom_code',
    }))
    // errorMessageFromResult checks `error` first, then `err_code` — this
    // exercises the err_code fallback (Menor 6 unification).
    expect(recordCronFailure).toHaveBeenCalledWith('job-b', 'boom_code')
  })

  it('does NOT call recordCronSuccess when fn already recorded health and set health_written:true', async () => {
    await withCronLock(makeSupabase(), 'lock:c', 'run-3', 'job-c', async () => {
      await recordCronFailure('job-c-submode', 'already recorded')
      return { status: 'ok' as const, health_written: true }
    })

    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(recordCronFailure).toHaveBeenCalledWith('job-c-submode', 'already recorded')
    // The regression this guards against: without health_written respected,
    // the wrapper would call recordCronSuccess('job-c') right here.
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('strips health_written from the JSON response body', async () => {
    const res = await withCronLock(makeSupabase(), 'lock:d', 'run-4', 'job-d', async () => {
      await recordCronSuccess('job-d')
      return { status: 'ok' as const, ok: true, health_written: true }
    })
    const body = await res.json()
    expect(body).not.toHaveProperty('health_written')
    expect(body.ok).toBe(true)
  })

  it('does not record health at all when skipped:true (guard bailed before real work)', async () => {
    await withCronLock(makeSupabase(), 'lock:e', 'run-5', 'job-e', async () => ({
      status: 'ok' as const,
      skipped: true,
      reason: 'non_production_environment',
    }))
    expect(recordCronSuccess).not.toHaveBeenCalled()
    expect(recordCronFailure).not.toHaveBeenCalled()
  })

  it('rejects a second concurrent call for the same lock key with 409', async () => {
    let releaseFirst!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const first = withCronLock(makeSupabase(), 'lock:concurrent', 'run-6', 'job-f', async () => {
      await gate
      return { status: 'ok' as const }
    })
    // Give the first call a tick to register the lock before the second fires.
    await new Promise((r) => setTimeout(r, 0))
    const second = await withCronLock(makeSupabase(), 'lock:concurrent', 'run-7', 'job-f', async () => ({
      status: 'ok' as const,
    }))
    expect(second.status).toBe(409)
    releaseFirst()
    await first
  })
})
