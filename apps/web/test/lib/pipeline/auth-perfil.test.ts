// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const linha = vi.hoisted(() => ({ atual: { id: 'key-1', site_id: 'site-1', name: 'cowork-permanent', permissions: ['read'] } as { id: string; site_id: string; name: string | null; permissions: string[] | null }, updates: 0 }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ is: () => ({ single: async () => ({ data: linha.atual }) }) }) }),
      update: () => ({ eq: async () => { linha.updates++; return {} } }),
    }),
  }),
}))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockRejectedValue(new Error('sem sessão')) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))

import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'

const pedido = (chave: string) => ({ headers: new Headers({ 'X-Pipeline-Key': chave }) }) as never

beforeEach(() => { linha.updates = 0 })

describe('authenticatePipeline (E19)', () => {
  it('devolve o nome da chave em keyName', async () => {
    linha.atual = { id: 'key-1', site_id: 'site-1', name: 'cowork-permanent', permissions: ['read', 'write', 'admin'] }
    const r = await authenticatePipeline(pedido('k-nome'))
    expect(r.ok && r.auth.keyName).toBe('cowork-permanent')
  })
  it('chave só com observatorio_leitura: 403, antes de qualquer outra permissão', async () => {
    linha.atual = { id: 'key-2', site_id: 'site-1', name: 'irma', permissions: ['observatorio_leitura'] }
    expect(await authenticatePipeline(pedido('k-perfil'))).toEqual({ ok: false, status: 403, error: 'Forbidden' })
  })
  it('chave com observatorio_leitura E read (ou admin): 403 do mesmo jeito', async () => {
    linha.atual = { id: 'key-3', site_id: 'site-1', name: 'x', permissions: ['observatorio_leitura', 'read', 'admin'] }
    expect(await authenticatePipeline(pedido('k-misto'))).toEqual({ ok: false, status: 403, error: 'Forbidden' })
  })
  it('chave com intelligence continua autenticando (quem decide é o helper da rota)', async () => {
    linha.atual = { id: 'key-4', site_id: 'site-1', name: 'forja (fila)', permissions: ['intelligence'] }
    const r = await authenticatePipeline(pedido('k-fila'))
    expect(r.ok && r.auth.permissions).toEqual(['intelligence'])
  })
})

describe('authenticatePipeline (E19): o dado não existe', () => {
  it('chave sem nome: keyName nulo, a chave autentica', async () => {
    linha.atual = { id: 'key-5', site_id: 'site-1', name: null, permissions: ['read'] }
    const r = await authenticatePipeline(pedido('k-sem-nome'))
    expect(r.ok && r.auth.keyName).toBeNull()
  })
  it('permissions nulo: autentica com lista vazia (sem read), nunca com exceção nem com permissão inventada', async () => {
    linha.atual = { id: 'key-6', site_id: 'site-1', name: 'x', permissions: null }
    const r = await authenticatePipeline(pedido('k-nulo'))
    expect(r.ok && r.auth.permissions).toEqual([])
  })
})

describe('authenticatePipeline (E19): permissão por igualdade exata (M4)', () => {
  it('permissions undefined: autentica com lista vazia, sem read', async () => {
    linha.atual = { id: 'key-7', site_id: 'site-1', name: 'x', permissions: undefined as unknown as null }
    const r = await authenticatePipeline(pedido('k-undef'))
    expect(r.ok && r.auth.permissions).toEqual([])
    expect(r.ok && requirePermission(r.auth, 'read')).toBe(false)
  })
  it("' Read' e 'READ' não concedem leitura por semelhança (comparação exata)", async () => {
    linha.atual = { id: 'key-8', site_id: 'site-1', name: 'x', permissions: [' Read', 'READ'] }
    const r = await authenticatePipeline(pedido('k-caixa'))
    expect(r.ok && requirePermission(r.auth, 'read')).toBe(false)
  })
  it("' observatorio_leitura' (com espaço) não é o perfil: não bloqueia por semelhança", async () => {
    linha.atual = { id: 'key-9', site_id: 'site-1', name: 'x', permissions: [' observatorio_leitura'] }
    const r = await authenticatePipeline(pedido('k-espaco'))
    expect(r.ok).toBe(true)
  })
})
