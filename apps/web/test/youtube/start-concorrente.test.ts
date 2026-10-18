// @vitest-environment node
// P4a-I10: dois inícios do mesmo rascunho (cron + dono). Só um reivindica; o original é lido DEPOIS da reivindicação.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { YouTubeFalso } from '../helpers/youtube-falso'
import { AGORA, BLOB, IMG, SITE, criarBanco } from '../helpers/banco-ab'

const { ensureFreshToken, canal, put } = vi.hoisted(() => ({ ensureFreshToken: vi.fn(), canal: vi.fn(), put: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put }))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/channel-account')>()),
  channelAccountIdForVideo: canal,
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { throw new Error('serviço real não é para testes') } }))

import { startAbTestInternal } from '@/lib/youtube/ab-start'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  ensureFreshToken.mockResolvedValue({ accessToken: 'tok' })
  canal.mockResolvedValue('UCpt')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('start concorrente', () => {
  it('P4a-I10: dois inícios do mesmo rascunho, leitor devolve O e depois B -> original_title = O, uma escrita no YouTube, um ciclo 0, o segundo ok:false "já iniciado"', async () => {
    const banco = criarBanco({
      status: 'draft', semCiclos: true, testType: 'title',
      ajustar: (v) => { v[0]!.sort_order = 1; v[1]!.sort_order = 0 }, // a B abre o ciclo 0: há o que escrever
    })
    const yt = new YouTubeFalso({ titulo: 'O', thumb: IMG.A, blobs: { [BLOB('A')]: IMG.A, [BLOB('B')]: IMG.B } })
    yt.lerTitulos(['O', 'B'])
    vi.stubGlobal('fetch', yt.fetch)
    const portas = { supabase: banco.supabase }
    const [a, b] = await Promise.all([startAbTestInternal('teste-1', SITE, portas), startAbTestInternal('teste-1', SITE, portas)])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    expect([a, b].find((x) => !x.ok)!.error).toMatch(/já iniciado/)
    expect(banco.teste().original_title).toBe('O')
    expect(yt.escritas()).toHaveLength(1)
    expect(banco.ciclos()).toHaveLength(1)
    expect(banco.teste()).toMatchObject({ status: 'active', restore_seq: 1 })
  })
  it('o perdedor não lê o YouTube nem mexe no original: só o vencedor relê', async () => {
    const banco = criarBanco({ status: 'draft', semCiclos: true, testType: 'title' })
    const yt = new YouTubeFalso({ titulo: 'O', thumb: IMG.A })
    vi.stubGlobal('fetch', yt.fetch)
    const portas = { supabase: banco.supabase }
    await Promise.all([startAbTestInternal('teste-1', SITE, portas), startAbTestInternal('teste-1', SITE, portas)])
    expect(yt.chamadas.filter((c) => c === 'videos.list')).toHaveLength(1)
  })
})
