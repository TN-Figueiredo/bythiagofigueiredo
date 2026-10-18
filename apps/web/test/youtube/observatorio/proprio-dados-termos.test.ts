// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { leituraDe } from './leitura-teste'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import * as Sentry from '@sentry/nextjs'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as dim from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { lerTermosESites } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados-termos'

vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/proprio/ler-dimensoes', async orig => ({ ...(await orig<typeof dim>()), lerDetalheDaOrigem: vi.fn() }))

const S = 'site-a', C = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10', ATE = '2026-09-30'
let leitura: LeituraPrivadaDoSite, leituraB: LeituraPrivadaDoSite
beforeAll(async () => { leitura = await leituraDe(S); leituraB = await leituraDe('site-b') })
const detalhe = (p: { de: string; ate: string; ytIds: string[] }) => ({ acesso: 'ok', dado: { canalId: C, de: p.de, ate: p.ate, descartados: 0, conjunto: { conjunto: 'detalhe', estado: { tipo: 'coletado' }, videos: p.ytIds.map(ytId => ({ ytId, dias: [] })) } } })
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireSiteScope).mockImplementation((async () => ({ ok: true, user: { id: 'u1' } })) as never)
  vi.mocked(getSupabaseServiceClient).mockReturnValue({} as never)
  vi.mocked(dim.lerDetalheDaOrigem).mockImplementation((async (_s: unknown, p: never) => detalhe(p)) as never)
})
const pedido = (extra: Partial<Parameters<typeof lerTermosESites>[0]> = {}) => ({ canalId: C, ytIds: ['v00'], de: addDays(ATE, -6), ate: ATE, agora: Date.parse(ATE + 'T18:00:00Z'), prova: leitura, ...extra })

describe('lerTermosESites', () => {
  it('quem edita: lê', async () => {
    expect(await lerTermosESites(pedido())).toMatchObject({ acesso: 'ok', dado: { conjunto: { conjunto: 'detalhe' } } })
    expect(dim.lerDetalheDaOrigem).toHaveBeenCalledTimes(1)
  })
  it('sem a prova de leitura: negado, sem cliente de serviço e sem consulta', async () => {
    expect(await lerTermosESites(pedido({ prova: null }))).toEqual({ acesso: 'negado' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(dim.lerDetalheDaOrigem).not.toHaveBeenCalled()
  })
  it('quem não edita (leitura sim, edição não): negado, sem cliente de serviço e sem consulta', async () => {
    vi.mocked(requireSiteScope).mockImplementation((async () => ({ ok: false })) as never)
    expect(await lerTermosESites(pedido())).toEqual({ acesso: 'negado' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(dim.lerDetalheDaOrigem).not.toHaveBeenCalled()
  })
  it('a guarda de edição lança (guarda caída, decisão 75): erro, nunca negado/cadeado; nada escapa', async () => {
    vi.mocked(requireSiteScope).mockImplementation((async () => { throw new Error('guarda caiu') }) as never)
    expect(await lerTermosESites(pedido())).toEqual({ acesso: 'erro' })
    expect(dim.lerDetalheDaOrigem).not.toHaveBeenCalled()
  })
  it('a guarda é chamada com o site do token, nunca com outro', async () => {
    await lerTermosESites(pedido({ prova: leituraB }))
    const ultima = vi.mocked(requireSiteScope).mock.calls.at(-1)![0] as unknown as { siteId: string; mode: string }
    expect(ultima).toMatchObject({ siteId: 'site-b', mode: 'edit' })
  })
  it('prova de leitura do site B e edição só do site A: negado, zero consultas e o cliente de serviço não é criado', async () => {
    vi.mocked(requireSiteScope).mockImplementation((async (a: { siteId: string }) => ({ ok: a.siteId === S })) as never)
    expect(await lerTermosESites(pedido({ prova: leituraB }))).toEqual({ acesso: 'negado' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(dim.lerDetalheDaOrigem).not.toHaveBeenCalled()
  })
  it('período de 300 dias: três trechos; falha de um trecho: erro com um aviso', async () => {
    expect(await lerTermosESites(pedido({ de: addDays(ATE, -299) }))).toMatchObject({ acesso: 'ok' })
    expect(dim.lerDetalheDaOrigem).toHaveBeenCalledTimes(3)
    vi.mocked(dim.lerDetalheDaOrigem).mockRejectedValue(new Error('x'))
    expect(await lerTermosESites(pedido())).toEqual({ acesso: 'erro' })
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
})
