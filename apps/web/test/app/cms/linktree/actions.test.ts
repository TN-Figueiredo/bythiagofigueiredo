import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR', timezone: 'America/Sao_Paulo',
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'user-1' } }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

describe('saveLinktreeConfig', () => {
  let saveLinktreeConfig: typeof import('@/app/cms/(authed)/linktree/actions').saveLinktreeConfig
  let mockSupabase: { from: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.resetModules()
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase as any)
    const mod = await import('@/app/cms/(authed)/linktree/actions')
    saveLinktreeConfig = mod.saveLinktreeConfig
  })

  it('saves valid config and returns ok', async () => {
    const result = await saveLinktreeConfig({
      tagline_pt: 'Bem vindo',
      tagline_en: 'Welcome',
      blog_desc_pt: 'Blog desc PT',
      blog_desc_en: 'Blog desc EN',
      highlight: { active: false },
      shared_links: [],
    })
    expect(result).toEqual({ ok: true })
    expect(mockSupabase.from).toHaveBeenCalledWith('sites')
  })

  it('rejects invalid config', async () => {
    const result = await saveLinktreeConfig({
      tagline_pt: 123 as any,
    } as any)
    expect(result.ok).toBe(false)
  })
})

describe('loadLinktreeConfig', () => {
  let loadLinktreeConfig: typeof import('@/app/cms/(authed)/linktree/actions').loadLinktreeConfig

  beforeEach(async () => {
    vi.resetModules()
  })

  it('returns config when user has view permission', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'user-1' } } as any)

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                linktree_config: {
                  tagline_pt: 'Olá',
                  tagline_en: 'Hello',
                  blog_desc_pt: 'Blog',
                  blog_desc_en: 'Blog EN',
                  highlight: { active: false },
                  shared_links: [],
                },
              },
              error: null,
            }),
          }),
        }),
      }),
    }

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase as any)

    const mod = await import('@/app/cms/(authed)/linktree/actions')
    loadLinktreeConfig = mod.loadLinktreeConfig

    const result = await loadLinktreeConfig()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.config.tagline_pt).toBe('Olá')
      expect(result.config.tagline_en).toBe('Hello')
    }
  })

  it('returns error when permission denied', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'forbidden' } as any)

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({} as any)

    const mod = await import('@/app/cms/(authed)/linktree/actions')
    loadLinktreeConfig = mod.loadLinktreeConfig

    const result = await loadLinktreeConfig()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('forbidden')
    }
  })

  it('returns error when Supabase query fails', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'user-1' } } as any)

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB connection failed' },
            }),
          }),
        }),
      }),
    }

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase as any)

    const mod = await import('@/app/cms/(authed)/linktree/actions')
    loadLinktreeConfig = mod.loadLinktreeConfig

    const result = await loadLinktreeConfig()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Erro ao carregar')
    }
  })

  it('returns default config when linktree_config is null in DB', async () => {
    const { requireSiteScope } = await import('@tn-figueiredo/auth-nextjs/server')
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'user-1' } } as any)

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { linktree_config: null },
              error: null,
            }),
          }),
        }),
      }),
    }

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase as any)

    const mod = await import('@/app/cms/(authed)/linktree/actions')
    loadLinktreeConfig = mod.loadLinktreeConfig

    const result = await loadLinktreeConfig()
    expect(result.ok).toBe(true)
    if (result.ok) {
      // Default values from LinktreeConfigSchema
      expect(result.config.tagline_pt).toBe('')
      expect(result.config.tagline_en).toBe('')
      expect(result.config.blog_desc_pt).toBe('')
      expect(result.config.blog_desc_en).toBe('')
      expect(result.config.highlight.active).toBe(false)
      expect(result.config.shared_links).toEqual([])
    }
  })
})
