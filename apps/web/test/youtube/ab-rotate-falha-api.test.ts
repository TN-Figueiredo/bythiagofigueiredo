// @vitest-environment node
// T8 (P4a): falha de API na rotação do cron. O applyVariantToYouTube é o REAL e fala com o YouTubeFalso por `fetch`;
// o settleOnAir é falso (o contrato dele está em ab-settle.test.ts): aqui se prova o PEDIDO e a contagem no banco.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { AGORA } from '../helpers/banco-ab'
import { montarRotacao } from '../helpers/montar-saida-automatica'
import { YouTubeApiError } from '@/lib/youtube/youtube-api-error'

const { fanOut, preflight, canal } = vi.hoisted(() => ({ fanOut: vi.fn(), preflight: vi.fn(), canal: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: preflight }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/channel-account')>()),
  channelAccountIdForVideo: canal,
}))
vi.mock('@/lib/supabase/service', async () => {
  const { servicoAtual } = await import('../helpers/banco-ab')
  return { getSupabaseServiceClient: () => servicoAtual.cliente }
})
vi.mock('@/lib/youtube/ab-settle', async (orig) => {
  const { settleOnAirFalso } = await import('../helpers/montar-saida-automatica')
  return { ...(await orig<typeof import('@/lib/youtube/ab-settle')>()), settleOnAir: settleOnAirFalso }
})

import { phaseRotateActiveTests } from '@/lib/youtube/ab-rotate-phases'

const forbidden = () => new YouTubeApiError(403, 'forbidden', 'thumbnails.set')

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
  preflight.mockResolvedValue({ ok: true, accessToken: 'tok' })
  canal.mockResolvedValue('UC1')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('rotação do cron: falha de API (T8)', () => {
  it('403 forbidden com consecutive_failures 2: pede settleOnAir(original, falha_api) 1x com o 3 e o siteId', async () => {
    const { banco, settle } = montarRotacao({ consecutiveFailures: 2, erroApi: forbidden() })
    const r = await phaseRotateActiveTests(banco.supabase)
    expect(r).toMatchObject({ processed: 0, errors: 1 })
    expect(settle).toHaveBeenCalledTimes(1)
    expect(settle).toHaveBeenCalledWith(banco.testId, expect.objectContaining({
      siteId: banco.siteId, destino: { tipo: 'original' }, motivo: 'falha_api', consecutiveFailures: 3,
      statusNote: expect.stringContaining('sem permissão'),
    }))
  })

  it('F-D1/Y-D10: o contador usa o restore_seq REIVINDICADO: 1 e 2 gravados no banco em dois dias, a terceira pausa', async () => {
    const { banco, settle, avancarDia } = montarRotacao({ consecutiveFailures: 0, erroApi: forbidden() })
    await phaseRotateActiveTests(banco.supabase)
    expect((banco.teste().config as { consecutive_failures: number }).consecutive_failures).toBe(1)
    expect(banco.teste()).toMatchObject({ status: 'active', status_note: expect.stringContaining('1/3') })
    avancarDia()
    await phaseRotateActiveTests(banco.supabase)
    expect((banco.teste().config as { consecutive_failures: number }).consecutive_failures).toBe(2)
    expect(settle).not.toHaveBeenCalled()
    avancarDia()
    await phaseRotateActiveTests(banco.supabase)
    expect(settle).toHaveBeenCalledTimes(1)
  })

  it('401 abaixo de três: conta, nota "token expirado" e não pede saída', async () => {
    const { banco, settle } = montarRotacao({ consecutiveFailures: 0, erroApi: new YouTubeApiError(401, 'authError', 'thumbnails.set') })
    await phaseRotateActiveTests(banco.supabase)
    expect(banco.teste().status_note).toMatch(/token expirado/)
    expect(settle).not.toHaveBeenCalled()
  })

  it('F-D1: o seq mudou entre a reivindicação e a falha (update afeta 0 linhas): Sentry "falha não contada" e nada gravado', async () => {
    const { banco, yt } = montarRotacao({ consecutiveFailures: 0, erroApi: forbidden() })
    yt.antesDeEscrever(() => { banco.setTeste({ restore_seq: 9 }) }) // outro escritor reivindica depois da releitura
    await phaseRotateActiveTests(banco.supabase)
    expect(Sentry.captureMessage).toHaveBeenCalledWith('ab-rotate: falha não contada', expect.anything())
    expect((banco.teste().config as { consecutive_failures?: number }).consecutive_failures ?? 0).toBe(0)
  })

  it('quotaExceeded não conta para as três: consecutive_failures continua 2 NO BANCO, active, nota da cota, sem saída', async () => {
    const { banco, settle } = montarRotacao({ consecutiveFailures: 2, erroApi: new YouTubeApiError(403, 'quotaExceeded', 'thumbnails.set') })
    await phaseRotateActiveTests(banco.supabase)
    expect(banco.teste()).toMatchObject({ status: 'active', status_note: expect.stringMatching(/cota do YouTube esgotada hoje/) })
    expect((banco.teste().config as { consecutive_failures: number }).consecutive_failures).toBe(2)
    expect(settle).not.toHaveBeenCalled()
  })

  it.each([
    ['erro de banco que cita 401 (não é YouTubeApiError)', new Error('relation failed 401')],
    ['403 do Blob (chamada blob)', new YouTubeApiError(403, 'blob_403', 'blob')],
  ])('%s não conta', async (_nome, erro) => {
    const { banco, settle } = montarRotacao({ consecutiveFailures: 1, erroApi: erro })
    const r = await phaseRotateActiveTests(banco.supabase)
    expect(r.errors).toBe(1)
    expect((banco.teste().config as { consecutive_failures: number }).consecutive_failures).toBe(1)
    expect(settle).not.toHaveBeenCalled()
  })

  it('o pedido de saída que lança não derruba o laço: vai ao Sentry e a rotação devolve o resultado', async () => {
    const { banco, settle } = montarRotacao({ consecutiveFailures: 2, erroApi: forbidden() })
    settle.mockRejectedValueOnce(new Error('settle caiu'))
    await expect(phaseRotateActiveTests(banco.supabase)).resolves.toMatchObject({ errors: 1 })
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: 'settle caiu' }), expect.anything())
  })
})
