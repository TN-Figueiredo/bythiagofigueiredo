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
