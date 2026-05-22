import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/server', () => ({ after: vi.fn((task: unknown) => { if (task instanceof Promise) task.catch(() => {}) }) }))
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

// Slide with text + image background — extractSlideMetadata should return title + coverImageUrl
const RICH_SLIDE = {
  version: 1 as const,
  canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
  background: {
    type: 'image' as const,
    url: 'https://blob.vercel-storage.com/cover.jpg',
    fallbackColor: '#0a0a0a',
    blur: 40,
  },
  elements: [
    { id: 'img-1', type: 'image' as const, src: 'https://blob.vercel-storage.com/cover.jpg', x: 0, y: 0, width: 1080, height: 810, objectFit: 'cover' as const, borderRadius: 0, borderColor: '#000000', borderWidth: 0, maintainAspectRatio: true },
    { id: 'txt-1', type: 'text' as const, content: 'Corondelet Travel Guide', x: 80, y: 910, width: 920, height: 400, fontSize: 64, fontWeight: 700, lineHeight: 1.2, letterSpacing: '0em', align: 'left' as const, color: '#ffffff', fontFamily: 'Inter', backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4, uppercase: false },
    { id: 'txt-2', type: 'text' as const, content: 'bythiagofigueiredo.com', x: 80, y: 1600, width: 920, height: 60, fontSize: 24, fontWeight: 400, lineHeight: 1.2, letterSpacing: '0em', align: 'left' as const, color: '#ffffff', fontFamily: 'Inter', backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4, uppercase: false },
  ],
}

// ---------------------------------------------------------------------------
// Fluent upsert chain builder
// ---------------------------------------------------------------------------

function buildUpsertChain(data: unknown, error: { message: string } | null = null) {
  const chain: Record<string, unknown> = {}
  const fluent = ['select', 'upsert', 'insert', 'update', 'eq', 'order', 'is', 'in', 'not', 'limit', 'lt', 'lte', 'gte']
  for (const m of fluent) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve({ data, error }))
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data, error }))
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  return chain
}

// Chain where maybeSingle returns null (no existing post) but single returns data (insert succeeded)
function buildInsertPathChain(insertedData: unknown) {
  const chain: Record<string, unknown> = {}
  const fluent = ['select', 'upsert', 'insert', 'update', 'eq', 'order', 'is', 'in', 'not', 'limit', 'lt', 'lte', 'gte']
  for (const m of fluent) {
    chain[m] = vi.fn(() => chain)
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  chain.single = vi.fn(() => Promise.resolve({ data: insertedData, error: null }))
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  return chain
}

const REAL_CONN_UUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

let mockFrom: ReturnType<typeof vi.fn>

function buildDeliveryChain() {
  const chain = buildUpsertChain(null)
  chain.single = vi.fn(() => Promise.resolve({ data: { id: REAL_CONN_UUID }, error: null }))
  return chain
}

function setupMockFrom(postsChain: ReturnType<typeof buildUpsertChain>) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'social_posts') return postsChain
    if (table === 'social_deliveries' || table === 'social_connections') return buildDeliveryChain()
    return postsChain
  })
}

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
    expect(result).toEqual({ ok: false, error: 'ID do site inválido' })
    expect(requireEditAccess).not.toHaveBeenCalled()
  })

  it('returns { ok: false } for invalid postId (non-UUID)', async () => {
    const result = await saveStoryDraft(REAL_SITE_UUID, 'bad-post-id', [VALID_SLIDE])
    expect(result).toEqual({ ok: false, error: 'ID do post inválido' })
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
    expect(result).toEqual({ ok: false, error: 'Sem permissão' })
  })

  it('updates with status=draft and status guard on success', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    mockFrom.mockReturnValue(chain)

    const result = await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE])

    expect(result).toEqual({ ok: true, data: { id: REAL_POST_UUID } })
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft' }),
    )
    expect(chain.not).toHaveBeenCalledWith('status', 'in', '("publishing","completed")')
  })

  it('stores caption in content.description', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    mockFrom.mockReturnValue(chain)

    await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], { caption: 'Hello world' })

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ content: { description: 'Hello world' } }),
    )
  })

  it('defaults caption to empty string when not provided', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    mockFrom.mockReturnValue(chain)

    await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE])

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ content: { description: '' } }),
    )
  })

  it('extracts title and media_urls from slide metadata (root cause regression)', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    mockFrom.mockReturnValue(chain)

    await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, [RICH_SLIDE])

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Corondelet Travel Guide',
          media_urls: ['https://blob.vercel-storage.com/cover.jpg'],
        }),
      }),
    )
  })

  it('calls revalidateSocialPaths on success', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    mockFrom.mockReturnValue(chain)

    await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE])

    expect(revalidateSocialPaths).toHaveBeenCalledOnce()
  })

  it('returns { ok: false } when DB update fails', async () => {
    const chain = buildUpsertChain(null, { message: 'DB constraint violation' })
    mockFrom.mockReturnValue(chain)

    const result = await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE])

    expect(result).toEqual({ ok: false, error: 'DB constraint violation' })
  })

  it('extracts metadata into INSERT when post is new (insert-path regression)', async () => {
    const chain = buildInsertPathChain({ id: REAL_POST_UUID })
    mockFrom.mockReturnValue(chain)

    const result = await saveStoryDraft(REAL_SITE_UUID, REAL_POST_UUID, [RICH_SLIDE])

    expect(result).toEqual({ ok: true, data: { id: REAL_POST_UUID } })
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Corondelet Travel Guide',
          media_urls: ['https://blob.vercel-storage.com/cover.jpg'],
        }),
      }),
    )
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
    expect(result).toEqual({ ok: false, error: 'ID do site inválido' })
  })

  it('returns { ok: false } for invalid postId', async () => {
    const result = await publishStoryNow(REAL_SITE_UUID, 'bad-post-id', [VALID_SLIDE])
    expect(result).toEqual({ ok: false, error: 'ID do post inválido' })
  })

  it('returns forbidden when siteId does not match authorized site', async () => {
    const result = await publishStoryNow(REAL_OTHER_UUID, REAL_POST_UUID, [VALID_SLIDE])
    expect(result).toEqual({ ok: false, error: 'Sem permissão' })
  })

  it('atomically updates with status=publishing and status guard', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID, template_id: null, idempotency_key: 'k1', created_at: '2026-05-01T00:00:00Z', user_timezone: 'America/Sao_Paulo' })
    setupMockFrom(chain)

    const result = await publishStoryNow(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE])

    expect(result).toEqual({ ok: true, data: { id: REAL_POST_UUID } })
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'publishing' }),
    )
    expect(chain.not).toHaveBeenCalledWith('status', 'in', '("publishing","completed")')
  })

  it('fires publishSocialPost workflow non-blocking', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID, template_id: null, idempotency_key: 'k1', created_at: '2026-05-01T00:00:00Z', user_timezone: 'UTC' })
    setupMockFrom(chain)

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

  it('populates content.title and content.media_urls from slide metadata (root cause regression)', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID, template_id: null, idempotency_key: 'k1', created_at: '2026-05-01T00:00:00Z', user_timezone: 'UTC' })
    setupMockFrom(chain)

    await publishStoryNow(REAL_SITE_UUID, REAL_POST_UUID, [RICH_SLIDE])

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Corondelet Travel Guide',
          media_urls: ['https://blob.vercel-storage.com/cover.jpg'],
        }),
      }),
    )
  })

  it('populates metadata into INSERT when post is new (insert-path regression)', async () => {
    const insertChain = buildInsertPathChain({
      id: REAL_POST_UUID,
      template_id: null,
      idempotency_key: 'k1',
      created_at: '2026-05-01T00:00:00Z',
      user_timezone: 'UTC',
    })
    setupMockFrom(insertChain)

    const result = await publishStoryNow(REAL_SITE_UUID, REAL_POST_UUID, [RICH_SLIDE])

    expect(result).toEqual({ ok: true, data: { id: REAL_POST_UUID } })
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Corondelet Travel Guide',
          media_urls: ['https://blob.vercel-storage.com/cover.jpg'],
        }),
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

  it('returns { ok: false } when DB update fails', async () => {
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
    expect(result).toEqual({ ok: false, error: 'ID do site inválido' })
  })

  it('returns { ok: false } for invalid postId', async () => {
    const result = await scheduleStory(REAL_SITE_UUID, 'bad-post-id', [VALID_SLIDE], FUTURE_DATE)
    expect(result).toEqual({ ok: false, error: 'ID do post inválido' })
  })

  it('returns { ok: false } for invalid date string (NaN)', async () => {
    const result = await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], 'not-a-date')
    expect(result).toEqual({ ok: false, error: 'Data/hora de agendamento inválida.' })
  })

  it('returns { ok: false } when scheduled date is in the past', async () => {
    const pastDate = new Date(Date.now() - 60 * 1000).toISOString() // 1 minute ago
    const result = await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], pastDate)
    expect(result).toEqual({ ok: false, error: 'O horário agendado deve ser no futuro.' })
  })

  it('returns { ok: false } when scheduled date is right now (not future)', async () => {
    // A date in the past by the time validation runs
    const now = new Date(Date.now() - 1).toISOString()
    const result = await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], now)
    expect(result.ok).toBe(false)
  })

  it('returns forbidden when siteId does not match authorized site', async () => {
    const result = await scheduleStory(REAL_OTHER_UUID, REAL_POST_UUID, [VALID_SLIDE], FUTURE_DATE)
    expect(result).toEqual({ ok: false, error: 'Sem permissão' })
  })

  it('updates with status=scheduled, correct scheduled_at, and status guard', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    setupMockFrom(chain)

    const result = await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], FUTURE_DATE)

    expect(result).toEqual({ ok: true, data: { id: REAL_POST_UUID } })
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'scheduled',
        scheduled_at: new Date(FUTURE_DATE).toISOString(),
      }),
    )
    expect(chain.not).toHaveBeenCalledWith('status', 'in', '("publishing","completed")')
  })

  it('extracts title and media_urls from slide metadata (root cause regression)', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    setupMockFrom(chain)

    await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [RICH_SLIDE], FUTURE_DATE)

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Corondelet Travel Guide',
          media_urls: ['https://blob.vercel-storage.com/cover.jpg'],
        }),
      }),
    )
  })

  it('populates metadata into INSERT when post is new (insert-path regression)', async () => {
    const insertChain = buildInsertPathChain({ id: REAL_POST_UUID })
    setupMockFrom(insertChain)

    const result = await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [RICH_SLIDE], FUTURE_DATE)

    expect(result).toEqual({ ok: true, data: { id: REAL_POST_UUID } })
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Corondelet Travel Guide',
          media_urls: ['https://blob.vercel-storage.com/cover.jpg'],
        }),
      }),
    )
  })

  it('returns { ok: false } for empty slides', async () => {
    const result = await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [], FUTURE_DATE)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Invalid slides')
    }
  })

  it('returns { ok: false } when DB update fails', async () => {
    const chain = buildUpsertChain(null, { message: 'update failed' })
    mockFrom.mockReturnValue(chain)

    const result = await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], FUTURE_DATE)

    expect(result).toEqual({ ok: false, error: 'update failed' })
  })

  it('calls revalidateSocialPaths on success', async () => {
    const chain = buildUpsertChain({ id: REAL_POST_UUID })
    setupMockFrom(chain)

    await scheduleStory(REAL_SITE_UUID, REAL_POST_UUID, [VALID_SLIDE], FUTURE_DATE)

    expect(revalidateSocialPaths).toHaveBeenCalledOnce()
  })
})
