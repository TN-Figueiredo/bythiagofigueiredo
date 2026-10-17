// @vitest-environment node
// phaseProcessQueue (P4a T10, 32 n): início que falha adia a fila em 1 dia (data NUNCA nula) e avisa uma vez por dia.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { AGORA, criarBanco } from '../helpers/banco-ab'

const { fanOut, iniciar } = vi.hoisted(() => ({ fanOut: vi.fn(), iniciar: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: iniciar }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { throw new Error('serviço real não é para testes') } }))

import { phaseProcessQueue } from '@/lib/youtube/ab-rotate-phases'

const DIA = 86_400_000
function fila(venceHaMs = 60_000) {
  const banco = criarBanco({ status: 'queued', semCiclos: true })
  banco.setTeste({ queue_start_after: new Date(AGORA.getTime() - venceHaMs).toISOString() })
  return banco
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
})
afterEach(() => vi.useRealTimers())

describe('phaseProcessQueue', () => {
  it('start ok: conta em started, sem aviso', async () => {
    const banco = fila()
    iniciar.mockImplementation(async () => { banco.setTeste({ status: 'active' }); return { ok: true } })
    expect(await phaseProcessQueue(banco.supabase)).toBe(1)
    expect(iniciar).toHaveBeenCalledWith('teste-1', 'site-1')
    expect(fanOut).not.toHaveBeenCalled()
  })
  it('fila (Y-D5): start falhou -> queued com queue_start_after = agora + 1 dia (NÃO nulo) e um aviso; started não conta', async () => {
    const banco = fila()
    iniciar.mockResolvedValue({ ok: false, error: 'YouTube token expired' })
    expect(await phaseProcessQueue(banco.supabase)).toBe(0)
    expect(banco.teste()).toMatchObject({ status: 'queued', queue_start_after: new Date(AGORA.getTime() + DIA).toISOString() })
    expect(fanOut).toHaveBeenCalledTimes(1)
    expect(fanOut.mock.calls[0]![0]).toMatchObject({ type: 'youtube.ab_queue_start_failed', siteId: 'site-1' })
    expect(fanOut.mock.calls[0]![0].message).toContain('YouTube token expired')
  })
  it('fila (Y-D5): no dia seguinte (relógio falso) o teste é pego de novo e inicia', async () => {
    const banco = fila()
    iniciar.mockResolvedValueOnce({ ok: false, error: 'x' })
    await phaseProcessQueue(banco.supabase)
    expect(await phaseProcessQueue(banco.supabase)).toBe(0) // ainda não venceu
    expect(iniciar).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date(AGORA.getTime() + DIA + 1000))
    iniciar.mockImplementation(async () => { banco.setTeste({ status: 'active' }); return { ok: true } })
    expect(await phaseProcessQueue(banco.supabase)).toBe(1)
    expect(iniciar).toHaveBeenCalledTimes(2)
  })
  it('start lança: Sentry com context queue-start, volta a queued com data nova NÃO nula e avisa', async () => {
    const banco = fila()
    const erro = new Error('boom')
    iniciar.mockRejectedValue(erro)
    expect(await phaseProcessQueue(banco.supabase)).toBe(0)
    expect(Sentry.captureException).toHaveBeenCalledWith(erro, expect.objectContaining({ extra: { testId: 'teste-1', context: 'queue-start' } }))
    expect(banco.teste()).toMatchObject({ status: 'queued', queue_start_after: new Date(AGORA.getTime() + DIA).toISOString() })
    expect(fanOut).toHaveBeenCalledTimes(1)
  })
  it('um aviso por dia: a segunda falha dentro da janela não avisa de novo', async () => {
    const banco = fila()
    iniciar.mockResolvedValue({ ok: false, error: 'x' })
    await phaseProcessQueue(banco.supabase)
    vi.setSystemTime(new Date(AGORA.getTime() + DIA + 1000))
    await phaseProcessQueue(banco.supabase)
    expect(iniciar).toHaveBeenCalledTimes(2)
    expect(fanOut).toHaveBeenCalledTimes(1) // a janela do ops_alert_claim ainda não abriu (o banco falso não envelhece a chave)
  })
  it('a nova data parte do maior entre o valor lido e agora: lido no passado -> agora + 1 dia', async () => {
    const banco = fila(5 * DIA)
    iniciar.mockResolvedValue({ ok: false, error: 'x' })
    await phaseProcessQueue(banco.supabase)
    expect(banco.teste().queue_start_after).toBe(new Date(AGORA.getTime() + DIA).toISOString())
  })
  it('o adiamento só vale se o teste ainda está em draft (outro processo o iniciou: não volta para a fila)', async () => {
    const banco = fila()
    iniciar.mockImplementation(async () => { banco.setTeste({ status: 'active' }); return { ok: false, error: 'Teste já iniciado por outro processo' } })
    await phaseProcessQueue(banco.supabase)
    expect(banco.teste().status).toBe('active')
  })
  it('a falha no aviso não derruba a fila nem perde o adiamento', async () => {
    const banco = fila()
    iniciar.mockResolvedValue({ ok: false, error: 'x' })
    fanOut.mockRejectedValue(new Error('ntfy fora'))
    expect(await phaseProcessQueue(banco.supabase)).toBe(0)
    expect(banco.teste().status).toBe('queued')
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
