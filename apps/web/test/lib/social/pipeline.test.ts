// apps/web/test/lib/social/pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: mockRpc,
  }),
}))

import type { PipelineStep } from '@/lib/social/types'

describe('createInitialPipelineSteps', () => {
  it('returns 4 steps with first 2 completed and last 2 pending', async () => {
    const { createInitialPipelineSteps } = await import(
      '@/lib/social/pipeline'
    )
    const steps = createInitialPipelineSteps()

    expect(steps).toHaveLength(4)
    expect(steps[0]!.step).toBe('post_created')
    expect(steps[0]!.status).toBe('completed')
    expect(steps[0]!.at).toBeDefined()
    expect(steps[1]!.step).toBe('short_link')
    expect(steps[1]!.status).toBe('completed')
    expect(steps[1]!.at).toBeDefined()
    expect(steps[2]!.step).toBe('og_scrape')
    expect(steps[2]!.status).toBe('pending')
    expect(steps[3]!.step).toBe('deliver')
    expect(steps[3]!.status).toBe('pending')
  })
})

describe('updatePipelineStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ error: null })
  })

  it('calls supabase.rpc with correct arguments', async () => {
    const { updatePipelineStep } = await import(
      '@/lib/social/pipeline'
    )
    const supabase = { rpc: mockRpc } as never

    await updatePipelineStep(supabase, 'post-123', 'og_scrape', 'in_progress')

    expect(mockRpc).toHaveBeenCalledWith('update_pipeline_step', {
      p_post_id: 'post-123',
      p_step_name: 'og_scrape',
      p_patch: expect.objectContaining({
        step: 'og_scrape',
        status: 'in_progress',
        at: expect.any(String),
      }),
    })
  })

  it('merges optional data into the patch', async () => {
    const { updatePipelineStep } = await import(
      '@/lib/social/pipeline'
    )
    const supabase = { rpc: mockRpc } as never

    await updatePipelineStep(supabase, 'post-123', 'og_scrape', 'completed', {
      tags: 7,
      latency_ms: 1200,
    })

    expect(mockRpc).toHaveBeenCalledWith('update_pipeline_step', {
      p_post_id: 'post-123',
      p_step_name: 'og_scrape',
      p_patch: expect.objectContaining({
        step: 'og_scrape',
        status: 'completed',
        data: { tags: 7, latency_ms: 1200 },
      }),
    })
  })

  it('throws when rpc returns an error', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'not found' } })
    const { updatePipelineStep } = await import(
      '@/lib/social/pipeline'
    )
    const supabase = { rpc: mockRpc } as never

    await expect(
      updatePipelineStep(supabase, 'post-123', 'og_scrape', 'in_progress')
    ).rejects.toThrow('Failed to update pipeline_steps for post post-123')
  })
})

describe('getPipelineDuration', () => {
  it('returns duration in ms from first to last completed step', async () => {
    const { getPipelineDuration } = await import(
      '@/lib/social/pipeline'
    )
    const steps: PipelineStep[] = [
      { step: 'post_created', status: 'completed', at: '2026-01-01T00:00:00Z' },
      { step: 'short_link', status: 'completed', at: '2026-01-01T00:00:01Z' },
      { step: 'og_scrape', status: 'completed', at: '2026-01-01T00:01:00Z' },
      { step: 'deliver', status: 'completed', at: '2026-01-01T00:03:00Z' },
    ]
    // 3 minutes = 180_000 ms
    expect(getPipelineDuration(steps)).toBe(180_000)
  })

  it('returns 0 if fewer than 2 completed steps', async () => {
    const { getPipelineDuration } = await import(
      '@/lib/social/pipeline'
    )
    const steps: PipelineStep[] = [
      { step: 'post_created', status: 'completed', at: '2026-01-01T00:00:00Z' },
      { step: 'short_link', status: 'pending', at: '' },
      { step: 'og_scrape', status: 'pending', at: '' },
      { step: 'deliver', status: 'pending', at: '' },
    ]
    expect(getPipelineDuration(steps)).toBe(0)
  })
})

describe('isPipelineComplete', () => {
  it('returns true if all steps are completed or warning', async () => {
    const { isPipelineComplete } = await import(
      '@/lib/social/pipeline'
    )
    const steps: PipelineStep[] = [
      { step: 'post_created', status: 'completed', at: '2026-01-01T00:00:00Z' },
      { step: 'short_link', status: 'completed', at: '2026-01-01T00:00:01Z' },
      { step: 'og_scrape', status: 'warning', at: '2026-01-01T00:01:00Z' },
      { step: 'deliver', status: 'completed', at: '2026-01-01T00:03:00Z' },
    ]
    expect(isPipelineComplete(steps)).toBe(true)
  })

  it('returns false if any step is pending', async () => {
    const { isPipelineComplete } = await import(
      '@/lib/social/pipeline'
    )
    const steps: PipelineStep[] = [
      { step: 'post_created', status: 'completed', at: '2026-01-01T00:00:00Z' },
      { step: 'short_link', status: 'completed', at: '2026-01-01T00:00:01Z' },
      { step: 'og_scrape', status: 'pending', at: '' },
      { step: 'deliver', status: 'pending', at: '' },
    ]
    expect(isPipelineComplete(steps)).toBe(false)
  })

  it('returns false if any step is failed', async () => {
    const { isPipelineComplete } = await import(
      '@/lib/social/pipeline'
    )
    const steps: PipelineStep[] = [
      { step: 'post_created', status: 'completed', at: '2026-01-01T00:00:00Z' },
      { step: 'short_link', status: 'completed', at: '2026-01-01T00:00:01Z' },
      { step: 'og_scrape', status: 'failed', at: '2026-01-01T00:01:00Z' },
      { step: 'deliver', status: 'pending', at: '' },
    ]
    expect(isPipelineComplete(steps)).toBe(false)
  })

  it('returns false for an empty steps array', async () => {
    const { isPipelineComplete } = await import(
      '@/lib/social/pipeline'
    )
    expect(isPipelineComplete([])).toBe(false)
  })
})
