// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const linha = vi.hoisted(() => ({ atual: { id: 'key-1', site_id: 'site-1', name: 'forja', permissions: ['archive_copy'] } as { id: string; site_id: string; name: string | null; permissions: string[] | null } }))
const modo = vi.hoisted(() => ({ atual: 'aviso' as 'aviso' | 'recusa' }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ is: () => ({ single: async () => ({ data: linha.atual }) }) }) }),
      update: () => ({ eq: async () => ({}) }),
    }),
  }),
}))
vi.mock('@/lib/pipeline/leitura-modo', async (orig) => {
  const m = await orig<typeof import('@/lib/pipeline/leitura-modo')>()
  return { ...m, modoLeitura: () => ({ ...m.modoLeitura(), modo: modo.atual }) }
})
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockRejectedValue(new Error('sem sessão')) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))

import { authenticatePipeline } from '@/lib/pipeline/auth'

let n = 0
const pedido = (pathname: string) => ({ headers: new Headers({ 'X-Pipeline-Key': `k-arq-${++n}` }), nextUrl: { pathname } }) as never

beforeEach(() => { modo.atual = 'aviso' })

describe('K2: chave só do arquivo não lê o resto do pipeline', () => {
  for (const m of ['aviso', 'recusa'] as const) {
    for (const p of ['archive_copy', 'archive_b2', 'archive_read']) {
      it(`${p} em GET /api/pipeline/items, modo ${m}: 403 "Forbidden"`, async () => {
        modo.atual = m
        linha.atual = { id: 'k', site_id: 'site-1', name: 'forja', permissions: [p] }
        expect(await authenticatePipeline(pedido('/api/pipeline/items'))).toEqual({ ok: false, status: 403, error: 'Forbidden' })
      })
    }
  }
  it('archive_copy em /api/pipeline/archive/plan: passa da autenticação', async () => {
    linha.atual = { id: 'k', site_id: 'site-1', name: 'forja', permissions: ['archive_copy'] }
    const r = await authenticatePipeline(pedido('/api/pipeline/archive/plan'))
    expect(r.ok && r.auth.permissions).toEqual(['archive_copy'])
  })
  it('prefixo parecido não vale: /api/pipeline/archive-x é recusado', async () => {
    linha.atual = { id: 'k', site_id: 'site-1', name: 'forja', permissions: ['archive_b2'] }
    expect(await authenticatePipeline(pedido('/api/pipeline/archive-x'))).toEqual({ ok: false, status: 403, error: 'Forbidden' })
  })
  it('{archive_copy, read} em GET /api/pipeline/items: segue a regra de hoje (não é "só arquivo")', async () => {
    linha.atual = { id: 'k', site_id: 'site-1', name: 'x', permissions: ['archive_copy', 'read'] }
    const r = await authenticatePipeline(pedido('/api/pipeline/items'))
    expect(r.ok).toBe(true)
  })
  it('o dado não existe: permissions vazia ou nula segue a regra de hoje (nunca "só arquivo")', async () => {
    for (const perms of [[], null]) {
      linha.atual = { id: 'k', site_id: 'site-1', name: 'x', permissions: perms }
      const r = await authenticatePipeline(pedido('/api/pipeline/items'))
      expect(r.ok && r.auth.permissions).toEqual([])
    }
  })
})
