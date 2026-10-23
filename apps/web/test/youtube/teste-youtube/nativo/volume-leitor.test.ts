// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ rpc: () => ({ abortSignal: async () => ({ data: true, error: null }) }) }) }))
vi.mock('@/lib/youtube/observatorio/proprio/edicao', () => ({
  provarEdicaoComAviso: async (siteId: string) => ({ token: { siteId }, avisou: false }), edicaoValida: () => true,
}))

import { lerVolumes } from '@/lib/youtube/teste-youtube/nativo/volume-leitor'
import { leituraDoEditor } from '@/lib/youtube/observatorio/proprio/leitura-privada'

const cliente = (): { sb: SupabaseClient; rpc: ReturnType<typeof vi.fn> } => {
  const rpc = vi.fn(async () => ({ data: [{ video_id: 'v1', soma: '10', dias_cobertos: '5', publico: true }], error: null }))
  return { sb: { rpc } as unknown as SupabaseClient, rpc }
}

describe('lerVolumes: só com a prova de leitura', () => {
  it('objeto que imita o token NÃO chama a RPC e lança', async () => {
    const { sb, rpc } = cliente()
    await expect(lerVolumes(sb, { siteId: 's' } as never, ['v1'])).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('com o token verdadeiro, o site da RPC sai do token', async () => {
    const leitura = await leituraDoEditor('11111111-1111-4111-8111-111111111111')
    expect(leitura).not.toBeNull()
    const { sb, rpc } = cliente()
    const m = await lerVolumes(sb, leitura!, ['v1'])
    expect(rpc).toHaveBeenCalledWith('ab_lab_volume', { p_site: '11111111-1111-4111-8111-111111111111', p_videos: ['v1'] })
    expect(m.get('v1')).toEqual({ soma: 10, diasCobertos: 5, publico: true })
  })
})
