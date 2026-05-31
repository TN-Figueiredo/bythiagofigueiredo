import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { recordCronSuccess, recordCronFailure, getCronHealth } from '@/lib/cron-health'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockUpsert = vi.fn().mockResolvedValue({ error: null })
const mockSelect = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockSelect.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { consecutive_failures: 2 }, error: null }),
    }),
  })
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'cron_health') {
        return { upsert: mockUpsert, select: mockSelect }
      }
      return {}
    }),
  })
})

describe('recordCronSuccess', () => {
  it('upserts with success timestamp and resets failures', async () => {
    await recordCronSuccess('ab-rotate', 'critical')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cron_name: 'ab-rotate',
        consecutive_failures: 0,
        severity: 'critical',
      }),
      { onConflict: 'cron_name' },
    )
  })
})

describe('recordCronSuccess', () => {
  it('logs error when upsert fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockUpsert.mockResolvedValueOnce({ error: { message: 'db connection lost' } })

    await recordCronSuccess('ab-rotate', 'critical')

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to record success for ab-rotate'),
      expect.objectContaining({ message: 'db connection lost' }),
    )
    consoleSpy.mockRestore()
  })
})

describe('recordCronFailure', () => {
  it('increments consecutive_failures', async () => {
    await recordCronFailure('ab-rotate', 'token expired', 'critical')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cron_name: 'ab-rotate',
        last_error: 'token expired',
        consecutive_failures: 3,
        severity: 'critical',
      }),
      { onConflict: 'cron_name' },
    )
  })

  it('handles missing previous row (first failure ever)', async () => {
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }),
    })

    await recordCronFailure('new-cron', 'first error', 'info')

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cron_name: 'new-cron',
        last_error: 'first error',
        consecutive_failures: 1,
        severity: 'info',
      }),
      { onConflict: 'cron_name' },
    )
  })
})

describe('getCronHealth', () => {
  it('returns the health row when it exists', async () => {
    const healthRow = {
      cron_name: 'ab-rotate',
      consecutive_failures: 0,
      last_success_at: '2026-05-31T10:00:00Z',
      severity: 'critical',
    }
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: healthRow, error: null }),
      }),
    })

    const result = await getCronHealth('ab-rotate')
    expect(result).toEqual(healthRow)
  })

  it('returns null when no row exists', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
      }),
    })

    const result = await getCronHealth('nonexistent')
    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
