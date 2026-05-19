import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/social/actions/_shared', () => ({
  requireEditAccess: vi.fn().mockResolvedValue({ siteId: '11111111-1111-1111-1111-111111111111', userId: 'u1' }),
  revalidateSocialPaths: vi.fn(),
  SENTRY_TAG: { component: 'social-actions' },
}))
vi.mock('@/lib/social/workflows', () => ({
  publishSocialPost: vi.fn().mockResolvedValue(undefined),
}))
// StorySlidesSchema depends on CardCompositionSchema from @tn-figueiredo/links/qr
// No mock needed — the real Zod schema works without network.

const REAL_SITE_UUID = '11111111-1111-1111-1111-111111111111'
const REAL_OTHER_UUID = '22222222-2222-2222-2222-222222222222'
const REAL_POST_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireEditAccess, revalidateSocialPaths } from '@/lib/social/actions/_shared'
import { saveStoryDraft, publishStoryNow, scheduleStory } from '@/lib/social/actions/story-publish'
import { publishSocialPost } from '@/lib/social/workflows'

// ---------------------------------------------------------------------------
// Minimal valid slide that passes CardCompositionSchema / StorySlidesSchema
// ---------------------------------------------------------------------------

const VALID_SLIDE = {
  version: 1 as const,
  canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
  background: { type: 'solid' as const, color: '#000000' },
  elements: [] as [],
}

// ---------------------------------------------------------------------------
// Fluent upsert chain builder
// ---------------------------------------------------------------------------

function buildUpsertChain(data: unknown, error: { message: string } | null = null) {
  const chain: Record<string, unknown> = {}
  const fluent = ['select', 'upsert', 'insert', 'update', 'eq', 'order']
  for (const m of fluent) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve({ data, error }))
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  return chain
}

let mockFrom: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireEditAccess).mockResolvedValue({ siteId: REAL_SITE_UUID, userId: 'u1' })
  mockFrom = vi.fn()
  vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: mockFrom } as never)
})

// ---------------------------------------------------------------------------
// saveStoryDraft
// ---------------------------------------------------------------------------

describe('saveStoryDraft', () => {
  it('returns { ok: false } for invalid siteId (non-UUID)', async () => {
    const result = await saveStoryDraft('bad-id', REAL_POST_UUID, [VALID_SLIDE])
    expect(result).toEqual({ ok: false, error: 'Invalid site ID' })
    expect(requireEditAccess).not.toHaveBeenCalled()
  })

  it('returns { ok: false } for invalid postId (non-UUID)', async () => {
    const result = await saveStoryDraft(REAL_SITE_UUID, 'bad-post-id', [VALID_SLIDE])
    expect(result).toEqual({ ok: false, error: 'Invalid post ID' })
    expect(requireEditAccess).not.toHaveBeenCalled()
  })

  it('returns { ok: false } for empty slides array', async () => {
    const result = await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, [])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Invalid slides')
    }
  })

  it('returns { ok: false } for more than 10 slides', async () => {
    const tooMany = Array(11).fill(VALID_SLIDE)
    const result = await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, tooMany)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Invalid slides')
    }
  })

  it('returns forbidden when siteId does not match authorized site', async () => {
    const result = await saveStoryDraft(REAL_OTHER_UUID, REAL_POST_UUID, [VALID_SLIDE])
    expect(result).toEqual({ ok: false, error: 'forbidden' })
  })

  it('upserts with status=draft on success', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    mockFrom.mockReturnValue(chain)

    const result = await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE])

    expect(result).toEqual({ ok: true, data: { id: REAL_POST_UUID } })
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft', id: REAL_POST_UUID }),
      expect.anything(),
    )
  })

  it('stores caption in content.description', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    mockFrom.mockReturnValue(chain)

    await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], { caption: 'Hello world' })

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ content: { description: 'Hello world' } }),
      expect.anything(),
    )
  })

  it('defaults caption to empty string when not provided', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    mockFrom.mockReturnValue(chain)

    await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE])

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ content: { description: '' } }),
      expect.anything(),
    )
  })

  it('calls revalidateSocialPaths on success', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    mockFrom.mockReturnValue(chain)

    await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE])

    expect(revalidateSocialPaths).toHaveBeenCalledOnce()
  })

  it('returns { ok: false } when DB upsert fails', async () => {
    const chain = buildUpsertChain(null, { message: 'DB constraint violation' })
    mockFrom.mockReturnValue(chain)

    const result = await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE])

    expect(result).toEqual({ ok: false, error: 'DB constraint violation' })
  })

  it('accepts exactly 10 slides (boundary)', async () => {
    const tenSlides = Array(10).fill(VALID_SLIDE)
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    mockFrom.mockReturnValue(chain)

    const result = await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, tenSlides)

    expect(result.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// publishStoryNow
// ---------------------------------------------------------------------------

describe('publishStoryNow', () => {
  it('returns { ok: false } for invalid siteId', async () => {
    const result = await publishStoryNow('bad-id', REAL_POST_UUID, [VALID_SLIDE])
    expect(result).toEqual({ ok: false, error: 'Invalid site ID' })
  })

  it('returns { ok: false } for invalid postId', async () => {
    const result = await publishStoryNow(REAL_SITE_UUID, 'bad-post-id', [VALID_SLIDE])
    expect(result).toEqual({ ok: false, error: 'Invalid post ID' })
  })

  it('returns forbidden when siteId does not match authorized site', async () => {
    const result = await publishStoryNow(REAL_OTHER_UUID, REAL_POST_UUID, [VALID_SLIDE])
    expect(result).toEqual({ ok: false, error: 'forbidden' })
  })

  it('upserts with status=publishing', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID, template_id: null, idempotency_key: 'k1', created_at: '2026-05-01T00:00:00Z', user_timezone: 'America/Sao_Paulo' })
    mockFrom.mockReturnValue(chain)

    const result = await publishStoryNow(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE])

    expect(result).toEqual({ ok: true, data: { id: REAL_POST_UUID } })
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'publishing' }),
      expect.anything(),
    )
  })

  it('fires publishSocialPost workflow non-blocking', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID, template_id: null, idempotency_key: 'k1', created_at: '2026-05-01T00:00:00Z', user_timezone: 'UTC' })
    mockFrom.mockReturnValue(chain)

    await publishStoryNow(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE])

    expect(publishSocialPost).toHaveBeenCalledOnce()
    expect(publishSocialPost).toHaveBeenCalledWith(
      expect.objectContaining({
        id: REAL_POST_UUID,
        status: 'publishing',
        site_id: REAL_SITE_UUID,
      }),
    )
  })

  it('returns { ok: false } for empty slides', async () => {
    const result = await publishStoryNow(REAL_SITE_UUID, REAL_POST_UUID, [])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Invalid slides')
    }
  })

  it('returns { ok: false } when DB upsert fails', async () => {
    const chain = buildUpsertChain(null, { message: 'network error' })
    mockFrom.mockReturnValue(chain)

    const result = await publishStoryNow(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE])

    expect(result).toEqual({ ok: false, error: 'network error' })
  })
})

// ---------------------------------------------------------------------------
// scheduleStory
// ---------------------------------------------------------------------------

describe('scheduleStory', () => {
  const FUTURE_DATE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  it('returns { ok: false } for invalid siteId', async () => {
    const result = await scheduleStory('bad-id', REAL_POST_UUID, [VALID_SLIDE], FUTURE_DATE)
    expect(result).toEqual({ ok: false, error: 'Invalid site ID' })
  })

  it('returns { ok: false } for invalid postId', async () => {
    const result = await scheduleStory(REAL_SITE_UUID, 'bad-post-id', [VALID_SLIDE], FUTURE_DATE)
    expect(result).toEqual({ ok: false, error: 'Invalid post ID' })
  })

  it('returns { ok: false } for invalid date string (NaN)', async () => {
    const result = await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], 'not-a-date')
    expect(result).toEqual({ ok: false, error: 'Invalid scheduled date/time. Use ISO 8601 format.' })
  })

  it('returns { ok: false } when scheduled date is in the past', async () => {
    const pastDate = new Date(Date.now() - 60 * 1000).toISOString() // 1 minute ago
    const result = await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], pastDate)
    expect(result).toEqual({ ok: false, error: 'Scheduled time must be in the future.' })
  })

  it('returns { ok: false } when scheduled date is right now (not future)', async () => {
    // A date in the past by the time validation runs
    const now = new Date(Date.now() - 1).toISOString()
    const result = await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], now)
    expect(result.ok).toBe(false)
  })

  it('returns forbidden when siteId does not match authorized site', async () => {
    const result = await scheduleStory(REAL_OTHER_UUID, REAL_POST_UUID, [VALID_SLIDE], FUTURE_DATE)
    expect(result).toEqual({ ok: false, error: 'forbidden' })
  })

  it('upserts with status=scheduled and correct scheduled_at', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    mockFrom.mockReturnValue(chain)

    const result = await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], FUTURE_DATE)

    expect(result).toEqual({ ok: true, data: { id: REAL_POST_UUID } })
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'scheduled',
        scheduled_at: new Date(FUTURE_DATE).toISOString(),
      }),
      expect.anything(),
    )
  })

  it('returns { ok: false } for empty slides', async () => {
    const result = await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [], FUTURE_DATE)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Invalid slides')
    }
  })

  it('returns { ok: false } when DB upsert fails', async () => {
    const chain = buildUpsertChain(null, { message: 'upsert failed' })
    mockFrom.mockReturnValue(chain)

    const result = await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], FUTURE_DATE)

    expect(result).toEqual({ ok: false, error: 'upsert failed' })
  })

  it('calls revalidateSocialPaths on success', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    mockFrom.mockReturnValue(chain)

    await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], FUTURE_DATE)

    expect(revalidateSocialPaths).toHaveBeenCalledOnce()
  })
})
