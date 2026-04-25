import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Unit tests for `lib/cms/auth-guards.ts` — `requireSiteAdminForRow`.
 *
 * Strategy: vi.doMock + vi.resetModules per-test so each case gets a fresh
 * module import with isolated mock state (mirrors the repositories test pattern
 * already in the codebase).
 */

describe('requireSiteAdminForRow', () => {
  beforeEach(() => vi.resetModules())

  it('throws "row_not_found" when the row does not exist', async () => {
    vi.doMock('@/lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () => makeBuilder({ data: null, error: null }),
      }),
    }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
      requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
    }))

    const { requireSiteAdminForRow } = await import('@/lib/cms/auth-guards')
    await expect(requireSiteAdminForRow('blog_posts', 'missing-id')).rejects.toThrow(
      'row_not_found',
    )
  })

  it('throws "row_lookup_failed: ..." when supabase returns an error', async () => {
    vi.doMock('@/lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () =>
          makeBuilder({
            data: null,
            error: { message: 'db boom' },
          }),
      }),
    }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
      requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
    }))

    const { requireSiteAdminForRow } = await import('@/lib/cms/auth-guards')
    await expect(requireSiteAdminForRow('campaigns', 'row-1')).rejects.toThrow(
      'row_lookup_failed: db boom',
    )
  })

  it('throws "unauthenticated" when requireSiteScope returns reason="unauthenticated"', async () => {
    vi.doMock('@/lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () => makeBuilder({ data: { site_id: 'site-1' }, error: null }),
      }),
    }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
      requireSiteScope: vi.fn().mockResolvedValue({
        ok: false,
        reason: 'unauthenticated',
      }),
    }))

    const { requireSiteAdminForRow } = await import('@/lib/cms/auth-guards')
    await expect(requireSiteAdminForRow('blog_posts', 'row-1')).rejects.toThrow(
      'unauthenticated',
    )
  })

  it('throws "forbidden" when requireSiteScope returns not-ok with any other reason', async () => {
    vi.doMock('@/lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () => makeBuilder({ data: { site_id: 'site-1' }, error: null }),
      }),
    }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
      requireSiteScope: vi.fn().mockResolvedValue({
        ok: false,
        reason: 'forbidden',
      }),
    }))

    const { requireSiteAdminForRow } = await import('@/lib/cms/auth-guards')
    await expect(requireSiteAdminForRow('blog_posts', 'row-1')).rejects.toThrow(
      'forbidden',
    )
  })

  it('returns { siteId } when row found and requireSiteScope returns ok', async () => {
    vi.doMock('@/lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () =>
          makeBuilder({ data: { site_id: 'site-abc' }, error: null }),
      }),
    }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
      requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
    }))

    const { requireSiteAdminForRow } = await import('@/lib/cms/auth-guards')
    const result = await requireSiteAdminForRow('campaigns', 'row-42')
    expect(result).toEqual({ siteId: 'site-abc' })
  })

  it('calls requireSiteScope with correct args (area=cms, mode=edit, siteId from row)', async () => {
    const requireSiteScopeMock = vi.fn().mockResolvedValue({ ok: true })

    vi.doMock('@/lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () =>
          makeBuilder({ data: { site_id: 'site-xyz' }, error: null }),
      }),
    }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
      requireSiteScope: requireSiteScopeMock,
    }))

    const { requireSiteAdminForRow } = await import('@/lib/cms/auth-guards')
    await requireSiteAdminForRow('blog_posts', 'row-1')

    expect(requireSiteScopeMock).toHaveBeenCalledOnce()
    expect(requireSiteScopeMock).toHaveBeenCalledWith({
      area: 'cms',
      siteId: 'site-xyz',
      mode: 'edit',
    })
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal Supabase query builder stub that returns a fixed `{data, error}` on
 * `.maybeSingle()`. Matches the builder shape used in repositories.test.ts.
 */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const passthrough = () => builder
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'lte', 'gte', 'not', 'is']) {
    builder[m] = passthrough
  }
  builder.maybeSingle = () => Promise.resolve(result)
  builder.single = () => Promise.resolve(result)
  return builder
}
