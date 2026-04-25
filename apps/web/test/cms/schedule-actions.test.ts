import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

let mockSelectData: unknown[] | null = [{ id: 'item-1' }]
let mockSelectError: { message: string } | null = null
let mockUpdateError: { message: string } | null = null

const mockChainSelect = vi.fn()

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.in = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.select = mockChainSelect.mockReturnValue({
    then: (resolve: (v: unknown) => void) =>
      resolve({ data: mockSelectData, error: mockSelectError }),
  })
  chain.update = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ error: mockUpdateError })
  return chain
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => makeChain()),
  })),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: 'site-1',
    orgId: 'org-1',
    defaultLocale: 'pt-BR',
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi
    .fn()
    .mockResolvedValue({ ok: true, user: { id: 'u1' } }),
}))

describe('scheduleItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectData = [{ id: 'item-1' }]
    mockSelectError = null
    mockUpdateError = null
  })

  it('validates table param as enum', async () => {
    const { scheduleItem } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await scheduleItem({
      id: '00000000-0000-0000-0000-000000000001',
      table: 'users',
      slotDate: '2026-05-01',
    })
    expect(result.ok).toBe(false)
  })

  it('validates id as uuid', async () => {
    const { scheduleItem } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await scheduleItem({
      id: 'not-a-uuid',
      table: 'blog_posts',
      slotDate: '2026-05-01',
    })
    expect(result.ok).toBe(false)
  })

  it('validates slotDate format', async () => {
    const { scheduleItem } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await scheduleItem({
      id: '00000000-0000-0000-0000-000000000001',
      table: 'blog_posts',
      slotDate: 'invalid-date',
    })
    expect(result.ok).toBe(false)
  })

  it('returns ok on valid input for blog_posts', async () => {
    const { scheduleItem } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await scheduleItem({
      id: '00000000-0000-0000-0000-000000000001',
      table: 'blog_posts',
      slotDate: '2026-05-01',
    })
    expect(result.ok).toBe(true)
  })

  it('returns ok on valid input for newsletter_editions', async () => {
    const { scheduleItem } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await scheduleItem({
      id: '00000000-0000-0000-0000-000000000001',
      table: 'newsletter_editions',
      slotDate: '2026-05-01',
    })
    expect(result.ok).toBe(true)
  })

  it('returns error when CAS precondition fails (empty result)', async () => {
    mockSelectData = []
    const { scheduleItem } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await scheduleItem({
      id: '00000000-0000-0000-0000-000000000001',
      table: 'blog_posts',
      slotDate: '2026-05-01',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('precondition')
    }
  })
})

describe('unslotItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectData = [{ id: 'item-1' }]
    mockSelectError = null
    mockUpdateError = null
  })

  it('validates table param as enum', async () => {
    const { unslotItem } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await unslotItem({
      id: '00000000-0000-0000-0000-000000000001',
      table: 'hackers',
    })
    expect(result.ok).toBe(false)
  })

  it('validates id as uuid', async () => {
    const { unslotItem } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await unslotItem({
      id: 'bad',
      table: 'blog_posts',
    })
    expect(result.ok).toBe(false)
  })

  it('returns ok on valid input', async () => {
    const { unslotItem } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await unslotItem({
      id: '00000000-0000-0000-0000-000000000001',
      table: 'blog_posts',
    })
    expect(result.ok).toBe(true)
  })

  it('returns error when CAS precondition fails', async () => {
    mockSelectData = []
    const { unslotItem } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await unslotItem({
      id: '00000000-0000-0000-0000-000000000001',
      table: 'newsletter_editions',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('precondition')
    }
  })
})

describe('publishNow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectData = [{ id: 'item-1' }]
    mockSelectError = null
    mockUpdateError = null
  })

  it('validates table param', async () => {
    const { publishNow } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await publishNow({
      id: '00000000-0000-0000-0000-000000000001',
      table: 'invalid',
    })
    expect(result.ok).toBe(false)
  })

  it('returns ok on valid input', async () => {
    const { publishNow } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await publishNow({
      id: '00000000-0000-0000-0000-000000000001',
      table: 'blog_posts',
    })
    expect(result.ok).toBe(true)
  })

  it('returns error when CAS precondition fails', async () => {
    mockSelectData = []
    const { publishNow } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await publishNow({
      id: '00000000-0000-0000-0000-000000000001',
      table: 'newsletter_editions',
    })
    expect(result.ok).toBe(false)
  })
})

describe('reorderBacklog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectData = [{ id: 'item-1' }]
    mockSelectError = null
    mockUpdateError = null
  })

  it('validates table param', async () => {
    const { reorderBacklog } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await reorderBacklog({
      table: 'invalid',
      orderedIds: ['00000000-0000-0000-0000-000000000001'],
    })
    expect(result.ok).toBe(false)
  })

  it('validates orderedIds are uuids', async () => {
    const { reorderBacklog } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await reorderBacklog({
      table: 'blog_posts',
      orderedIds: ['not-a-uuid'],
    })
    expect(result.ok).toBe(false)
  })

  it('requires at least one id', async () => {
    const { reorderBacklog } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await reorderBacklog({
      table: 'blog_posts',
      orderedIds: [],
    })
    expect(result.ok).toBe(false)
  })

  it('returns ok on valid input', async () => {
    const { reorderBacklog } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    const result = await reorderBacklog({
      table: 'blog_posts',
      orderedIds: [
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
      ],
    })
    expect(result.ok).toBe(true)
  })
})

describe('RBAC enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectData = [{ id: 'item-1' }]
    mockSelectError = null
    mockUpdateError = null
  })

  it('throws forbidden when requireSiteScope denies access', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { scheduleItem } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    await expect(
      scheduleItem({
        id: '00000000-0000-0000-0000-000000000001',
        table: 'blog_posts',
        slotDate: '2026-05-01',
      }),
    ).rejects.toThrow('forbidden')
  })

  it('throws unauthenticated when no session', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'unauthenticated',
    })
    const { publishNow } = await import(
      '@/app/cms/(authed)/schedule/actions'
    )
    await expect(
      publishNow({
        id: '00000000-0000-0000-0000-000000000001',
        table: 'blog_posts',
      }),
    ).rejects.toThrow('unauthenticated')
  })
})
