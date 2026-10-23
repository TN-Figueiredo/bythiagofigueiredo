// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { criarSupabaseMemoria } from '../../../helpers/supabase-memoria'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))

import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { lerRetratoDoEditor, lerRetratoDiario } from '@/lib/youtube/observatorio/proprio/ler-retrato-ficha'

const S = '11111111-1111-4111-8111-111111111111'
const V = '22222222-2222-4222-8222-222222222222'
const dados = () => criarSupabaseMemoria({ yt_own_video_meta_daily: [{ site_id: S, video_id: V, ab_variant_id: null, day_pt: '2026-10-01', title_at_capture: 'Retrato' }] }).sb

describe('lerRetratoDoEditor: a guarda é real', () => {
  it('sem a prova de edição: nada é lido (null), mesmo com dado', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'insufficient_access' } as never)
    expect(await lerRetratoDoEditor(dados(), { siteId: S, videoId: V, coluna: 'title_at_capture' })).toBeNull()
  })
  it('quem edita lê', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'u' } } as never)
    expect(await lerRetratoDoEditor(dados(), { siteId: S, videoId: V, coluna: 'title_at_capture' })).toBe('Retrato')
  })
  it('token forjado ou ausente: null', async () => {
    // @ts-expect-error literal não é um LeituraPrivadaDoSite
    expect(await lerRetratoDiario(dados(), { leitura: { siteId: S }, videoId: V, coluna: 'title_at_capture' })).toBeNull()
    expect(await lerRetratoDiario(dados(), { leitura: null, videoId: V, coluna: 'title_at_capture' })).toBeNull()
  })
})
