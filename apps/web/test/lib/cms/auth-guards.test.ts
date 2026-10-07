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

describe('requireSiteAdminScope (degrau "administrar o site")', () => {
  beforeEach(() => vi.resetModules())

  async function run(session: {
    user?: { id: string } | null
    userErr?: { message: string } | null
    rpc?: () => Promise<{ data: unknown; error: unknown }>
    cookiesThrow?: boolean
    setThrows?: boolean
  }) {
    const rpc = vi.fn(session.rpc ?? (async () => ({ data: true, error: null })))
    const service = vi.fn()
    let setAll: ((list: Array<{ name: string; value: string; options?: unknown }>) => void) | undefined
    vi.doMock('next/headers', () => ({
      cookies: async () => {
        if (session.cookiesThrow) throw new Error('cookies indisponível')
        return {
          getAll: () => [],
          set: () => {
            if (session.setThrows) throw new Error('Cookies can only be modified in a Server Action')
          },
        }
      },
    }))
    // '@tn-figueiredo/auth-nextjs' e '.../server' resolvem para o MESMO arquivo: um mock só, com os dois exports.
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
      requireSiteScope: vi.fn(),
      createServerClient: (opts: { cookies: { setAll: typeof setAll } }) => {
        setAll = opts.cookies.setAll
        return {
          auth: {
            getUser: async () => ({
              data: { user: session.user === undefined ? { id: 'u-1' } : session.user },
              error: session.userErr ?? null,
            }),
          },
          rpc,
        }
      },
    }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: service }))
    const { requireSiteAdminScope } = await import('@/lib/cms/auth-guards')
    const result = await requireSiteAdminScope('site-1')
    return { result, rpc, service, setAll: () => setAll }
  }

  it('org_admin: pergunta can_admin_site_users pela SESSÃO e devolve o usuário', async () => {
    const { result, rpc, service } = await run({})
    expect(result).toEqual({ ok: true, user: { id: 'u-1' } })
    expect(rpc).toHaveBeenCalledWith('can_admin_site_users', { p_site_id: 'site-1' })
    expect(service).not.toHaveBeenCalled()
  })

  it('editora (a função responde false): negado', async () => {
    const { result } = await run({ rpc: async () => ({ data: false, error: null }) })
    expect(result).toEqual({ ok: false, reason: 'insufficient_access' })
  })

  it('falha FECHADO: erro da RPC, resposta nula, resposta "truthy" que não é true, exceção', async () => {
    const denied = { ok: false, reason: 'insufficient_access' }
    expect((await run({ rpc: async () => ({ data: null, error: { message: 'boom' } }) })).result).toEqual(denied)
    // erro E data=true ao mesmo tempo: o erro manda
    expect((await run({ rpc: async () => ({ data: true, error: { message: 'boom' } }) })).result).toEqual(denied)
    expect((await run({ rpc: async () => ({ data: null, error: null }) })).result).toEqual(denied)
    expect((await run({ rpc: async () => ({ data: 'true', error: null }) })).result).toEqual(denied)
    expect((await run({ rpc: async () => ({ data: 1, error: null }) })).result).toEqual(denied)
    expect((await run({ rpc: async () => { throw new Error('rede caiu') } })).result).toEqual(denied)
    expect((await run({ cookiesThrow: true })).result).toEqual(denied)
  })

  it('sem usuário na sessão: unauthenticated, e nem pergunta ao banco', async () => {
    const a = await run({ user: null })
    expect(a.result).toEqual({ ok: false, reason: 'unauthenticated' })
    expect(a.rpc).not.toHaveBeenCalled()
    const b = await run({ userErr: { message: 'jwt expired' } })
    expect(b.result).toEqual({ ok: false, reason: 'unauthenticated' })
    expect(b.rpc).not.toHaveBeenCalled()
  })

  it('renovar o cookie durante o render (Next proíbe gravar) NÃO vira "negado" para o dono', async () => {
    const { result, setAll } = await run({ setThrows: true })
    expect(() => setAll()?.([{ name: 'sb', value: 'x' }])).not.toThrow()
    expect(result).toEqual({ ok: true, user: { id: 'u-1' } })
  })

  it('frase de recusa em português', async () => {
    const { siteAdminOnlyMessage } = await import('@/lib/cms/auth-guards')
    expect(siteAdminOnlyMessage('disparar a newsletter')).toBe('Só quem administra o site pode disparar a newsletter.')
  })
})
