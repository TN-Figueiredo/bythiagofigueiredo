import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// A rota só orquestra: o comportamento de cada fase está em test/youtube/ab-evaluate-phases.test.ts.
const fases = vi.hoisted(() => ({
  evaluate: vi.fn(),
  playoffs: vi.fn(),
}))

vi.mock('@/lib/youtube/ab-evaluate-phases', () => ({
  phaseEvaluateActiveTests: fases.evaluate,
  phaseAutoStartPlayoffs: fases.playoffs,
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))
vi.mock('@/lib/youtube/ab-escalation', () => ({ checkAndEscalate: vi.fn() }))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ runLongevityChecks: vi.fn().mockResolvedValue(0) }))

import { GET } from '@/app/api/cron/ab-evaluate/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'

function pedidoAutenticado(secret = 'test-secret') {
  return new NextRequest(new URL('http://localhost:3000/api/cron/ab-evaluate'), {
    headers: { authorization: `Bearer ${secret}` },
  })
}

function clienteVazio() {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'limit', 'eq']) chain[m] = () => chain
  chain.single = () => Promise.resolve({ data: null, error: null })
  chain.then = (r: (v: unknown) => void) => r({ data: [], error: null })
  return { from: () => chain }
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret')
  vi.clearAllMocks()
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(clienteVazio())
  fases.evaluate.mockResolvedValue({ evaluated: 2, resolved: 1, errors: 0 })
  fases.playoffs.mockResolvedValue({ processed: 3, errors: 0 })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/cron/ab-evaluate', () => {
  it('returns 401 without auth header', async () => {
    const res = await GET(new NextRequest(new URL('http://localhost:3000/api/cron/ab-evaluate')))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('a resposta não tem mais applies_retried nem playoffs_created', async () => {
    const corpo = await (await GET(pedidoAutenticado())).json()
    expect(Object.keys(corpo).sort()).toEqual(['errors', 'evaluated', 'longevity_checked', 'playoffs_started', 'resolved', 'status'])
  })

  it('resolved é só o da avaliação e playoffs_started vem da fase de playoffs', async () => {
    const corpo = await (await GET(pedidoAutenticado())).json()
    expect(corpo).toMatchObject({ status: 'ok', evaluated: 2, resolved: 1, errors: 0, playoffs_started: 3 })
  })

  it('recordCronFailure quando as fases somam erro; recordCronSuccess quando zero', async () => {
    fases.evaluate.mockResolvedValueOnce({ evaluated: 1, resolved: 1, errors: 1 })
    await GET(pedidoAutenticado())
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    fases.evaluate.mockResolvedValueOnce({ evaluated: 1, resolved: 1, errors: 0 })
    await GET(pedidoAutenticado())
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
  })

  it('erro da fase de playoffs também soma no total', async () => {
    fases.playoffs.mockResolvedValueOnce({ processed: 0, errors: 2 })
    const corpo = await (await GET(pedidoAutenticado())).json()
    expect(corpo.errors).toBe(2)
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
  })
})
