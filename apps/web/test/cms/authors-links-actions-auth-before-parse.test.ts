// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// GHSA-mrhx-c7xc-m3w5 (resto): authors/links. Autorização ANTES do zod, arrays com teto, erro limitado a 5 issues.
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/newsletter/cache-invalidation', () => ({ revalidateAuthor: vi.fn(), revalidateAbout: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => {
    throw new Error('service client must not be reached')
  }),
}))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR' }),
}))
const { requireSiteScope } = vi.hoisted(() => ({ requireSiteScope: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ createServerClient: vi.fn(), requireSiteScope }))

import * as authors from '@/app/cms/(authed)/authors/actions'
import * as links from '@/app/cms/(authed)/links/actions'

type Fn = (...a: unknown[]) => Promise<unknown>
const bad = { destination_url: 12345, tags: 'x' }

const CASES: Array<[string, Fn, unknown[]]> = [
  ['authors.createAuthor', authors.createAuthor as unknown as Fn, [{ display_name: '' }]],
  ['authors.updateAuthor', authors.updateAuthor as unknown as Fn, ['id', { display_name: 7 }]],
  ['links.createLink', links.createLink as unknown as Fn, [bad]],
  ['links.updateLink', links.updateLink as unknown as Fn, ['id', bad]],
  ['links.saveAlertRule', links.saveAlertRule as unknown as Fn, [bad]],
  ['links.getLinks', links.getLinks as unknown as Fn, ['site-1', { page: 'x' }]],
]

describe('authors/links: auth antes do parse', () => {
  beforeEach(() => requireSiteScope.mockReset())

  for (const [name, fn, args] of CASES) {
    it(`${name} sem sessão rejeita com 'unauthenticated' em vez de validar o corpo`, async () => {
      requireSiteScope.mockResolvedValue({ ok: false, reason: 'unauthenticated' })
      await expect(fn(...args)).rejects.toThrow('unauthenticated')
    })
  }

  it('batchUpdateLinks: tags gigante com sessão vira UM erro curto (teto do array)', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const tags = new Array(1_000_000).fill(1)
    const t0 = Date.now()
    const r = (await links.batchUpdateLinks('site-1', { tags } as never, { active: true })) as { ok: boolean; error: string }
    expect(r.ok).toBe(false)
    expect(r.error.split(', ').length).toBeLessThanOrEqual(5)
    expect(Date.now() - t0).toBeLessThan(2000)
  })

  it('createAuthor: social_links com chaves demais é recusado, mensagem limitada a 5 issues', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const social_links = Object.fromEntries(Array.from({ length: 100_000 }, (_, i) => [`k${i}`, 'nao-e-url']))
    const r = (await authors.createAuthor({ display_name: 'A', social_links })) as { ok: boolean; error: string }
    expect(r.ok).toBe(false)
    expect(r.error).toContain('at most 20 keys')
  })

  it('reorderAuthors: lista acima do teto é recusada antes de tocar no banco', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const r = (await authors.reorderAuthors(new Array(500).fill('id'))) as { ok: boolean; error: string }
    expect(r.ok).toBe(false)
    expect(r.error).toContain('at most 200')
  })

  it('updateAuthorAbout: muitos links de CTA recusados com erro fixo', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const links30 = new Array(30).fill({ type: 'internal', key: 'k', label: 'l' })
    const r = (await authors.updateAuthorAbout('a', 'pt-BR', { aboutCtaLinks: { kicker: 'k', signature: 's', links: links30 } })) as { ok: boolean; error?: string }
    expect(r).toEqual({ ok: false, error: 'validation_failed' })
  })
})
