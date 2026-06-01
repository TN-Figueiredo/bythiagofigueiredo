// apps/web/test/lib/social/settings-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

const SITE_ID = '00000000-0000-0000-0000-000000000001'
const OTHER_SITE_ID = '00000000-0000-0000-0000-000000000002'
const USER_ID = 'user-abc'

// Supabase mock state
const mockSiteSelect = vi.fn()
const mockSiteUpdate = vi.fn()

function buildSupabaseMock(
  siteData: Record<string, unknown> | null = null,
  siteError: { message: string } | null = null,
) {
  mockSiteSelect.mockResolvedValue({
    data: siteData,
    error: siteError,
  })
  mockSiteUpdate.mockResolvedValue({ error: null })

  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSiteSelect,
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: mockSiteUpdate,
      }),
    })),
  }
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => buildSupabaseMock()),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: SITE_ID,
    orgId: 'org-1',
    defaultLocale: 'pt-br',
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: USER_ID } }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setTag: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers to re-configure per-test
// ---------------------------------------------------------------------------
async function setSupabaseSiteData(data: Record<string, unknown> | null, err: { message: string } | null = null) {
  const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
  vi.mocked(getSupabaseServiceClient).mockReturnValue(buildSupabaseMock(data, err) as never)
}

async function setSiteContext(siteId: string) {
  const { getSiteContext } = await import('@/lib/cms/site-context')
  vi.mocked(getSiteContext).mockResolvedValue({ siteId, orgId: 'org-1', defaultLocale: 'pt-br' })
}

async function setAuth(ok: boolean) {
  const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
  if (ok) {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: USER_ID } } as never)
  } else {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'unauthenticated' } as never)
  }
}

// ---------------------------------------------------------------------------
// getSocialDefaults
// ---------------------------------------------------------------------------
describe('getSocialDefaults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns social_defaults from the site row', async () => {
    await setSupabaseSiteData({
      social_defaults: { 'blog:facebook': 'tmpl-uuid-1' },
    })
    const { getSocialDefaults } = await import('@/lib/social/actions/settings')

    const result = await getSocialDefaults(SITE_ID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual({ 'blog:facebook': 'tmpl-uuid-1' })
    }
  })

  it('returns empty object when social_defaults is null', async () => {
    await setSupabaseSiteData({ social_defaults: null })
    const { getSocialDefaults } = await import('@/lib/social/actions/settings')

    const result = await getSocialDefaults(SITE_ID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual({})
    }
  })

  it('returns error for invalid site ID (not a UUID)', async () => {
    const { getSocialDefaults } = await import('@/lib/social/actions/settings')

    const result = await getSocialDefaults('not-a-uuid')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/invalid site id/i)
    }
  })

  it('returns error when site is not found in DB', async () => {
    await setSupabaseSiteData(null, { message: 'no rows returned' })
    const { getSocialDefaults } = await import('@/lib/social/actions/settings')

    const result = await getSocialDefaults(SITE_ID)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Site not found')
    }
  })

  it('throws when requireEditAccess fails with unauthenticated', async () => {
    await setAuth(false)
    const { getSocialDefaults } = await import('@/lib/social/actions/settings')

    await expect(getSocialDefaults(SITE_ID)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// updateSocialDefaults
// ---------------------------------------------------------------------------
describe('updateSocialDefaults', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await setAuth(true)
    await setSiteContext(SITE_ID)
    await setSupabaseSiteData({ social_defaults: {} })
  })

  it('merges new entries into existing social_defaults', async () => {
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })
    const mockSingle = vi.fn().mockResolvedValue({
      data: { social_defaults: { 'newsletter:instagram': '11111111-1111-1111-1111-111111111111' } },
      error: null,
    })

    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
        update: mockUpdate,
      })),
    } as never)

    const { updateSocialDefaults } = await import('@/lib/social/actions/settings')

    const NEW_TMPL_UUID = '22222222-2222-2222-2222-222222222222'
    const result = await updateSocialDefaults(SITE_ID, {
      entries: [
        { contentType: 'blog', platform: 'facebook', templateId: NEW_TMPL_UUID },
      ],
    })

    expect(result.ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        social_defaults: expect.objectContaining({
          'newsletter:instagram': '11111111-1111-1111-1111-111111111111',
          'blog:facebook': NEW_TMPL_UUID,
        }),
      }),
    )
  })

  it('removes entry when templateId is null', async () => {
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })
    const mockSingle = vi.fn().mockResolvedValue({
      data: { social_defaults: { 'blog:facebook': 'to-delete', 'blog:bluesky': 'keep' } },
      error: null,
    })

    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
        update: mockUpdate,
      })),
    } as never)

    const { updateSocialDefaults } = await import('@/lib/social/actions/settings')

    const result = await updateSocialDefaults(SITE_ID, {
      entries: [{ contentType: 'blog', platform: 'facebook', templateId: null }],
    })

    expect(result.ok).toBe(true)
    const updatedDefaults = mockUpdate.mock.calls[0]![0] as { social_defaults: Record<string, unknown> }
    expect(updatedDefaults.social_defaults).not.toHaveProperty('blog:facebook')
    expect(updatedDefaults.social_defaults).toHaveProperty('blog:bluesky', 'keep')
  })

  it('returns forbidden when siteId does not match authorized siteId', async () => {
    await setSiteContext(OTHER_SITE_ID)
    const { updateSocialDefaults } = await import('@/lib/social/actions/settings')

    const result = await updateSocialDefaults(SITE_ID, {
      entries: [{ contentType: 'blog', platform: 'facebook', templateId: '33333333-3333-3333-3333-333333333333' }],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('forbidden')
    }
  })

  it('returns error for invalid site ID', async () => {
    const { updateSocialDefaults } = await import('@/lib/social/actions/settings')

    const result = await updateSocialDefaults('not-a-uuid', {
      entries: [],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/invalid site id/i)
    }
  })

  it('returns validation error for invalid input (bad content type)', async () => {
    const { updateSocialDefaults } = await import('@/lib/social/actions/settings')

    const result = await updateSocialDefaults(SITE_ID, {
      entries: [
        { contentType: 'podcast' as never, platform: 'facebook', templateId: 'x' },
      ],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// getQueueSlotConfig
// ---------------------------------------------------------------------------
describe('getQueueSlotConfig', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await setAuth(true)
    await setSiteContext(SITE_ID)
  })

  it('returns queue_slots from social_defaults', async () => {
    await setSupabaseSiteData({
      social_defaults: {
        queue_slots: { monday: [9, 14, 18], friday: [10] },
      },
    })
    const { getQueueSlotConfig } = await import('@/lib/social/actions/settings')

    const result = await getQueueSlotConfig(SITE_ID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual({ monday: [9, 14, 18], friday: [10] })
    }
  })

  it('returns empty object when queue_slots is not set', async () => {
    await setSupabaseSiteData({ social_defaults: { 'blog:facebook': 'tmpl' } })
    const { getQueueSlotConfig } = await import('@/lib/social/actions/settings')

    const result = await getQueueSlotConfig(SITE_ID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual({})
    }
  })

  it('returns error for invalid site ID', async () => {
    const { getQueueSlotConfig } = await import('@/lib/social/actions/settings')

    const result = await getQueueSlotConfig('bad-id')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/invalid site id/i)
    }
  })

  it('returns error when site is not found', async () => {
    await setSupabaseSiteData(null, { message: 'not found' })
    const { getQueueSlotConfig } = await import('@/lib/social/actions/settings')

    const result = await getQueueSlotConfig(SITE_ID)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Site not found')
    }
  })
})

// ---------------------------------------------------------------------------
// saveQueueSlotConfig
// ---------------------------------------------------------------------------
describe('saveQueueSlotConfig', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await setAuth(true)
    await setSiteContext(SITE_ID)
  })

  it('saves queue slots into social_defaults, preserving existing keys', async () => {
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })
    const mockSingle = vi.fn().mockResolvedValue({
      data: { social_defaults: { 'blog:facebook': 'existing-tmpl' } },
      error: null,
    })

    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
        update: mockUpdate,
      })),
    } as never)

    const { saveQueueSlotConfig } = await import('@/lib/social/actions/settings')

    const result = await saveQueueSlotConfig(SITE_ID, {
      monday: [9, 14],
      friday: [10, 16],
    })

    expect(result.ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        social_defaults: expect.objectContaining({
          'blog:facebook': 'existing-tmpl',
          queue_slots: { monday: [9, 14], friday: [10, 16] },
        }),
      }),
    )
  })

  it('returns forbidden when siteId does not match authorized siteId', async () => {
    await setSiteContext(OTHER_SITE_ID)
    const { saveQueueSlotConfig } = await import('@/lib/social/actions/settings')

    const result = await saveQueueSlotConfig(SITE_ID, { monday: [9] })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('forbidden')
    }
  })

  it('returns error for invalid site ID', async () => {
    const { saveQueueSlotConfig } = await import('@/lib/social/actions/settings')

    const result = await saveQueueSlotConfig('not-uuid', { monday: [9] })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/invalid site id/i)
    }
  })

  it('returns validation error for hours out of range (0-23)', async () => {
    const { saveQueueSlotConfig } = await import('@/lib/social/actions/settings')

    const result = await saveQueueSlotConfig(SITE_ID, { monday: [25] })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBeTruthy()
    }
  })

  it('returns validation error for invalid day key', async () => {
    const { saveQueueSlotConfig } = await import('@/lib/social/actions/settings')

    const result = await saveQueueSlotConfig(SITE_ID, { holiday: [9] })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBeTruthy()
    }
  })
})
