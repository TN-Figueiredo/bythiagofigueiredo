// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { criarFakeSb } from './helpers/fake-sb-gravacao'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))
const decisao = vi.hoisted(() => ({ rodar: vi.fn() }))
vi.mock('@/lib/youtube/ab-gravacao/decisao-v2-step', async (orig) => {
  const real = await orig<typeof import('@/lib/youtube/ab-gravacao/decisao-v2-step')>()
  decisao.rodar.mockImplementation(real.rodarDecisaoV2)
  return { ...real, rodarDecisaoV2: decisao.rodar }
})
vi.mock('@/lib/youtube/ab-evaluate-phases', () => ({ encerrarComPrazo: vi.fn() }))

import { GET } from '@/app/api/cron/ab-retrato/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'

const pedido = (auth?: string) => new Request('http://localhost:3000/api/cron/ab-retrato', { headers: auth ? { authorization: auth } : {} })

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret')
  vi.clearAllMocks()
})
afterEach(() => { vi.unstubAllEnvs() })

describe('GET /api/cron/ab-retrato', () => {
  it('401 sem o segredo e sem tocar no banco', async () => {
    const res = await GET(pedido())
    expect(res.status).toBe(401)
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })

  it('401 com segredo errado', async () => {
    expect((await GET(pedido('Bearer outro'))).status).toBe(401)
  })

  it('zero teste: 200 e recordCronSuccess (o watchdog não a acusa morta)', async () => {
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(criarFakeSb({}).sb)
    const res = await GET(pedido('Bearer test-secret'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', retrato: { testes: 0, linhas: 0 }, decisao: { status: 'ok', avaliados: 0 } })
    expect(recordCronSuccess).toHaveBeenCalledWith('ab-retrato')
    expect(recordCronFailure).not.toHaveBeenCalled()
  })

  it('erro de leitura: uma única falha registrada (health_written evita o sucesso por cima)', async () => {
    const f = criarFakeSb({})
    f.erros.ab_tests = 'caiu'
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(f.sb)
    await GET(pedido('Bearer test-secret'))
    expect(recordCronFailure).toHaveBeenCalledTimes(1)
    expect(recordCronSuccess).not.toHaveBeenCalled()
  })

  it('a resposta HTTP não carrega as entradas (Maps/Sets) da decisão', async () => {
    const f = criarFakeSb({
      ab_tests: [{ id: 't1', site_id: 's1', status: 'active', test_type: 'thumbnail', regra_duracao: 'v1', paused_at: null, completed_at: null, original_title: null, started_at: new Date(Date.now() - 5 * 86_400_000).toISOString(), youtube_videos: { youtube_video_id: 'abcdefghijk', channel_id: 'ch1' } }],
      ab_test_cycles: [{ id: 'c1', test_id: 't1', variant_id: 'v-a', started_at: new Date(Date.now() - 5 * 86_400_000).toISOString(), ended_at: null, applied_metadata: null, cycle_number: 1 }],
    })
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(f.sb)
    const corpo = await (await GET(pedido('Bearer test-secret'))).json()
    expect(corpo.status).toBe('ok')
    expect(corpo).not.toHaveProperty('entradas')
    expect(corpo.retrato).not.toHaveProperty('entradas')
    expect(typeof corpo.retrato.duracao_ms).toBe('number')
    expect(typeof corpo.decisao.duracao_ms).toBe('number')
  })

  it('retrato com erro: a decisão não é chamada', async () => {
    const f = criarFakeSb({})
    f.erros.ab_tests = 'caiu'
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(f.sb)
    await GET(pedido('Bearer test-secret'))
    expect(decisao.rodar).not.toHaveBeenCalled()
  })

  it('zero teste v2: a decisão faz só as duas consultas de seleção (ativos e concluídos)', async () => {
    const f = criarFakeSb({})
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(f.sb)
    await GET(pedido('Bearer test-secret'))
    expect(f.lidas.filter((l) => l.de === 0 && l.tabela === 'ab_test_variants')).toHaveLength(0)
    expect(f.lidas.filter((l) => l.de === 0 && l.tabela === 'ab_tests')).toHaveLength(3) // 1 do retrato + 2 da seleção
    expect(decisao.rodar).toHaveBeenCalledTimes(1)
  })

  it('decisão com erro: recordCronFailure uma vez e recordCronSuccess não é chamado; ambos ok: um sucesso só', async () => {
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(criarFakeSb({}).sb)
    decisao.rodar.mockResolvedValueOnce({ status: 'error', error: 'decisao_v2: x', health_written: true })
    const res = await GET(pedido('Bearer test-secret'))
    const corpo = await res.json()
    expect(corpo.status).toBe('error')
    expect(recordCronSuccess).not.toHaveBeenCalled()
    vi.clearAllMocks()
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(criarFakeSb({}).sb)
    await GET(pedido('Bearer test-secret'))
    expect(recordCronSuccess).toHaveBeenCalledTimes(1)
    expect(recordCronFailure).not.toHaveBeenCalled()
  })
})
