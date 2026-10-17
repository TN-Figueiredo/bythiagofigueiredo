// @vitest-environment node
// Decisão 75, Phil I3: o mapa de diários lido SEM um canal é quebra de invariante, portanto falha (`leitura-falhou`), nunca negado/restrito.
import { describe, it, expect, vi } from 'vitest'
import { proprioWorld } from './proprio-fixture'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', async (orig) => ({
  ...(await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_proprio/dados')>()),
  acessoPrivado: async () => ({ leitura: { token: 'x' }, edita: true, negativa: null }),
  lerDiarioDosCanais: async () => new Map(),
}))

import { carregarExtrasProprio } from '@/app/cms/(authed)/youtube/competitors/_proprio/carregar-extras'

describe('carregarExtrasProprio com o mapa de diários sem um canal', () => {
  it('o canal ausente do mapa sai "leitura-falhou", nunca "sem-acesso"', async () => {
    const W = proprioWorld()
    const e = await carregarExtrasProprio(W.obs, '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a77', W.obs.NOW)
    expect(e).toBeDefined()
    for (const c of W.obs.ownChannels()) expect(e!.vpd.get(c.id)!.motivo).toBe('leitura-falhou')
  })
})
