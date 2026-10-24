// @vitest-environment node
// Envio B (M-3 do Yannis): a rota GET /competitors/observed pelo caminho HTTP real (auth, envelope, flag off).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const linha = vi.hoisted(() => ({ atual: { id: 'key-1', site_id: 'site-1', name: 'cowork', permissions: ['read'] } as { id: string; site_id: string; name: string | null; permissions: string[] | null } }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ is: () => ({ single: async () => ({ data: linha.atual }) }) }) }),
      update: () => ({ eq: async () => ({}) }),
    }),
  }),
}))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockRejectedValue(new Error('sem sessão')) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))
vi.mock('@/lib/pipeline/leitura-registro', () => ({ registrarLeitura: vi.fn(async () => undefined) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { GET } from '@/app/api/pipeline/youtube/competitors/observed/route'

const pedido = (chave?: string) => new NextRequest('http://localhost/api/pipeline/youtube/competitors/observed', { headers: chave ? { 'X-Pipeline-Key': chave } : {} })

beforeEach(() => { delete process.env.OBS_TROCAS_CONCORRENTE })
afterEach(() => { delete process.env.OBS_TROCAS_CONCORRENTE })

describe('GET /competitors/observed', () => {
  it('sem chave: 401', async () => {
    expect((await GET(pedido())).status).toBe(401)
  })
  it('chave sem read: 403', async () => {
    linha.atual = { id: 'key-2', site_id: 'site-1', name: 'fila', permissions: ['intelligence'] }
    expect((await GET(pedido('k-obs-sem-read'))).status).toBe(403)
  })
  it('chave read e flag apagada: 200 com a resposta desligada', async () => {
    linha.atual = { id: 'key-3', site_id: 'site-1', name: 'cowork', permissions: ['read'] }
    const r = await GET(pedido('k-obs-read'))
    expect(r.status).toBe(200)
    const body = await r.json() as { data: unknown }
    expect(body.data).toEqual({ ligada: false, motivo: 'flag_off', resumo: 'Leitura de concorrentes desligada' })
  })
})
