// @vitest-environment node
// T8 (P4a): duração máxima do ab-evaluate com o settleOnAir REAL e o YouTubeFalso (só `fetch`).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AGORA } from '../helpers/banco-ab'
import { montarEvaluate } from '../helpers/montar-saida-automatica'
import { dhashOf } from '@/lib/youtube/thumb-fingerprint'
import { H } from '../helpers/youtube-falso'

const { fanOut, ensureFreshToken } = vi.hoisted(() => ({ fanOut: vi.fn(), ensureFreshToken: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/supabase/service', async () => {
  const { servicoAtual } = await import('../helpers/banco-ab')
  return { getSupabaseServiceClient: () => servicoAtual.cliente }
})

import { phaseEvaluateActiveTests } from '@/lib/youtube/ab-evaluate-phases'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
  ensureFreshToken.mockResolvedValue({ accessToken: 'tok' })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('ab-evaluate: duração máxima por settleOnAir', () => {
  it('thumbnail no ar é a variante B: volta ao original, teste completed/inconclusive, ciclo com end_reason duracao_maxima', async () => {
    const { banco, yt } = montarEvaluate({ testType: 'thumbnail', expirou: true })
    banco.setTeste({ winner_variant_id: 'B' }) // vencedor sugerido por uma versão antiga: encerrar como inconclusivo o limpa (S-C8)
    const r = await phaseEvaluateActiveTests(banco.supabase)
    expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
    expect(banco.teste()).toMatchObject({ status: 'completed', completed_reason: 'inconclusive', winner_variant_id: null })
    expect(banco.teste().restore_status).toMatchObject({ thumbnail: { estado: 'ok', destino: 'original', escreveu: true } })
    expect(banco.cicloFechado(0)).toMatchObject({ end_reason: 'duracao_maxima' })
    expect(yt.escritas()).toEqual(['thumbnails.set'])
    expect(await dhashOf(yt.thumb)).toBe(H.A)
  })

  it('com o YouTube recusando (thumbnails.set 403): status completed, campo falhou, ciclo fechado e o cron fica vermelho', async () => {
    const { banco, yt } = montarEvaluate({ testType: 'thumbnail', expirou: true })
    yt.recusar('thumbnails.set', 403, 'forbidden')
    const r = await phaseEvaluateActiveTests(banco.supabase)
    expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 1 })
    expect(banco.teste().status).toBe('completed')
    expect(banco.teste().restore_status).toMatchObject({ thumbnail: { estado: 'falhou', erro: { status: 403, reason: 'forbidden', chamada: 'thumbnails.set' } } })
    expect(banco.cicloFechado(0)).toMatchObject({ end_reason: 'duracao_maxima' })
  })

  it('antes da duração máxima não pede saída: nenhuma chamada ao YouTube e o teste continua active', async () => {
    const { banco, yt } = montarEvaluate({ expirou: false })
    expect(await phaseEvaluateActiveTests(banco.supabase)).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
    expect(yt.chamadas).toEqual([])
    expect(banco.teste().status).toBe('active')
  })

  it('F-D3: com o relógio da rota quase no fim (menos de 40 s) o teste vencido não começa', async () => {
    const { banco, yt } = montarEvaluate({ testType: 'thumbnail', expirou: true })
    const r = await phaseEvaluateActiveTests(banco.supabase, Date.now() - 100_000)
    expect(r).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
    expect(banco.teste().status).toBe('active')
    expect(yt.chamadas).toEqual([])
  })
})
