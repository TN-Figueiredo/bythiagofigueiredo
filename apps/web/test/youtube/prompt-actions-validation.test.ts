import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock all server-side dependencies before importing the action
// ---------------------------------------------------------------------------

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'test-site' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import the action under test after mocks are in place
// ---------------------------------------------------------------------------

import { logPromptCopy } from '@/app/cms/(authed)/youtube/_actions/youtube-prompt-actions'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('logPromptCopy validation', () => {
  it('returns ok: true for valid inputs', async () => {
    const r = await logPromptCopy('content-calendar', 3000, 2)
    expect(r.ok).toBe(true)
  })

  it('returns ok: true for channel-health preset', async () => {
    const r = await logPromptCopy('channel-health', 4500, 1)
    expect(r.ok).toBe(true)
  })

  it('returns ok: true for video-optimizer preset', async () => {
    const r = await logPromptCopy('video-optimizer', 3200, 0)
    expect(r.ok).toBe(true)
  })

  it('rejects unknown preset', async () => {
    const r = await logPromptCopy('invalid', 3000, 2)
    expect(r.ok).toBe(false)
  })

  it('rejects empty string preset', async () => {
    const r = await logPromptCopy('', 3000, 2)
    expect(r.ok).toBe(false)
  })

  it('rejects charCount below minimum (< 1)', async () => {
    const r = await logPromptCopy('content-calendar', 0, 2)
    expect(r.ok).toBe(false)
  })

  it('rejects charCount above maximum (> 15000)', async () => {
    const r = await logPromptCopy('content-calendar', 15001, 2)
    expect(r.ok).toBe(false)
  })

  it('accepts charCount at minimum boundary (1)', async () => {
    const r = await logPromptCopy('content-calendar', 1, 2)
    expect(r.ok).toBe(true)
  })

  it('accepts charCount at maximum boundary (15000)', async () => {
    const r = await logPromptCopy('content-calendar', 15000, 2)
    expect(r.ok).toBe(true)
  })

  it('rejects negative snapshotAgeHours', async () => {
    const r = await logPromptCopy('content-calendar', 100, -1)
    expect(r.ok).toBe(false)
  })

  it('accepts snapshotAgeHours of 0 (just synced)', async () => {
    const r = await logPromptCopy('content-calendar', 100, 0)
    expect(r.ok).toBe(true)
  })

  it('accepts snapshotAgeHours at maximum boundary (720)', async () => {
    const r = await logPromptCopy('content-calendar', 100, 720)
    expect(r.ok).toBe(true)
  })

  it('rejects snapshotAgeHours above maximum (> 720)', async () => {
    const r = await logPromptCopy('content-calendar', 100, 721)
    expect(r.ok).toBe(false)
  })

  it('rejects non-integer charCount', async () => {
    const r = await logPromptCopy('content-calendar', 1500.5, 2)
    expect(r.ok).toBe(false)
  })
})
