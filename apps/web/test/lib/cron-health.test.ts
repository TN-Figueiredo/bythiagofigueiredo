import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
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
})
