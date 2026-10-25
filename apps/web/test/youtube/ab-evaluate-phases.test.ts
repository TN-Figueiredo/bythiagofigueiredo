import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockChannelAccountId } = vi.hoisted(() => ({ mockChannelAccountId: vi.fn() }))
vi.mock('@/lib/youtube/channel-account', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/channel-account')>()),
  channelAccountIdForVideo: mockChannelAccountId,
}))

// ─── Module mocks (must be before imports) ──────────────────────────────────
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-statistics', () => ({ calculateBayesianConfidence: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({ setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }), fetchVariantImageBuffer: vi.fn() }))
vi.mock('@/lib/youtube/ab-metadata', () => ({ updateVideoMetadata: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({
  preflightTokenCheck: vi.fn(() => ({ ok: true, accessToken: 'token-retry' })),
}))
vi.mock('@/lib/youtube/notification-service', () => ({
  buildNotification: vi.fn(() => ({
    type: 'ab_test_completed', priority: 3, title: 'Test', message: 'Done',
    dedup_key: 'k', video_id: null, action_href: null,
  })),
}))
vi.mock('@/lib/youtube/analytics-sync', () => ({ getIsoWeek: vi.fn(() => '2026-W22') }))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ autoImportWinner: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
// T8: a duração máxima é um PEDIDO a settleOnAir (o contrato dele está em ab-settle.test.ts; o caminho real, em ab-evaluate-duracao-maxima.test.ts).
vi.mock('@/lib/youtube/ab-settle', async (orig) => {
  const { settleOnAirFalso } = await import('../helpers/montar-saida-automatica')
  return { ...(await orig<typeof import('@/lib/youtube/ab-settle')>()), settleOnAir: settleOnAirFalso }
})
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn().mockResolvedValue(1) }))

import { phaseEvaluateActiveTests } from '@/lib/youtube/ab-evaluate-phases'
import * as Sentry from '@sentry/nextjs'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { fetchVariantImageBuffer, setThumbnail } from '@/lib/youtube/ab-youtube'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { settleOnAirFalso as settle } from '../helpers/montar-saida-automatica'

// ─── Cliente falso POR TABELA ───────────────────────────────────────────────

const DIA = 24 * 3_600_000
const BLOB = 'https://abc.public.blob.vercel-storage.com/original.jpg'
const FORA_DO_BLOB = 'https://i.ytimg.com/vi/x/maxresdefault.jpg'

type Ciclo = Record<string, unknown>

function ciclosComVencedorClaro(): Ciclo[] {
  return Array.from({ length: 16 }, (_, i) => ({
    id: `c${i}`, variant_id: i % 2 === 0 ? 'v1' : 'v2', cycle_number: i,
    backfill_status: 'confirmed', impressions: 2000, clicks: i % 2 === 0 ? 100 : 130,
    ended_at: new Date().toISOString(),
  }))
}

function cicloVazio(): Ciclo {
  return { id: 'c0', variant_id: 'v1', cycle_number: 0, backfill_status: 'pending', impressions: 0, clicks: 0, ended_at: null }
}

interface OpcoesTeste {
  id?: string
  tipo?: string
  diasNoAr?: number
  maxDuracao?: number
  ciclos?: Ciclo[]
  originalNoBlob?: boolean
  startedAt?: null
  criadoHaDias?: number
  comVencedorSugerido?: boolean
  carenciaAte?: 'futuro' | 'passado'
  consecutiveConfidentEvals?: number
  regraDuracao?: 'v1' | 'v2'
}

function testeAtivo(o: OpcoesTeste = {}) {
  const dias = o.startedAt === null ? (o.criadoHaDias ?? 0) : (o.diasNoAr ?? 8)
  const iso = new Date(Date.now() - dias * DIA).toISOString()
  return {
    id: o.id ?? 'test-1',
    site_id: 'site-1',
    youtube_video_id: 'vid-1',
    name: 'Test AB',
    status: 'active',
    test_type: o.tipo ?? 'title',
    started_at: o.startedAt === null ? null : iso,
    created_at: iso,
    original_title: 'Original Title',
    original_thumbnail_url: o.originalNoBlob ? BLOB : FORA_DO_BLOB,
    consecutive_confident_evals: o.consecutiveConfidentEvals ?? 0,
    regra_duracao: o.regraDuracao ?? 'v1',
    grace_expires_at: o.carenciaAte === 'futuro' ? new Date(Date.now() + DIA).toISOString()
      : o.carenciaAte === 'passado' ? new Date(Date.now() - 3_600_000).toISOString() : null,
    winner_variant_id: o.comVencedorSugerido ? 'v2' : null,
    confidence_at_completion: null as number | null,
    config: {
      confidence_threshold: 0.95, burn_in_days: 0, auto_apply_winner: true,
      max_duration_days: o.maxDuracao ?? 14, stability_threshold: 3,
    },
    variants: [
      { id: 'v1', label: 'original', is_original: true, sort_order: 0, blob_url: 'https://blob/a.jpg', title_text: null, metadata: {} },
      { id: 'v2', label: 'variant_b', is_original: false, sort_order: 1, blob_url: 'https://blob/b.jpg', title_text: 'New Title', metadata: {} },
    ],
    cycles: o.ciclos ?? [],
  }
}

type TesteFalso = ReturnType<typeof testeAtivo>
interface Escrita { table: string; data: Record<string, unknown>; filtros: Record<string, unknown> }
interface OpcoesCliente {
  falhaAoGravar?: string | { tabela: string; idDoTeste: string }
  statusNaReleitura?: string
  updateCasaZeroLinha?: boolean
  falhaAoLer?: boolean
}

function clienteCom(tests: TesteFalso[], opts: OpcoesCliente = {}) {
  const writes: Escrita[] = []
  const listaOuErro = opts.falhaAoLer
    ? { data: null, error: { message: 'boom' } }
    : { data: tests, error: null }

  const falha = (tabela: string, filtros: Record<string, unknown>) => {
    const f = opts.falhaAoGravar
    if (!f) return false
    if (typeof f === 'string') return f === tabela
    return f.tabela === tabela && f.idDoTeste === (filtros.id ?? filtros.test_id)
  }

  const updateChain = (table: string, data: Record<string, unknown>) => {
    const w: Escrita = { table, data, filtros: {} }
    const resultado = () => (falha(table, w.filtros)
      ? { data: null, error: { message: 'falha de gravação' } }
      : { data: null, error: null })
    const chain: Record<string, unknown> = {}
    chain.eq = (c: string, v: unknown) => { w.filtros[c] = v; return chain }
    chain.is = (c: string, v: unknown) => { w.filtros[c] = v; return chain }
    chain.select = () => {
      const r = resultado()
      return Promise.resolve(r.error ? r : { data: opts.updateCasaZeroLinha ? [] : [{ id: w.filtros.id }], error: null })
    }
    chain.then = (res: (v: unknown) => void, rej?: (e: unknown) => void) => Promise.resolve(resultado()).then(res, rej)
    // a escrita só conta quando o update é efetivamente aguardado/encadeado
    writes.push(w)
    return chain
  }

  const from = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      return {
        select: () => ({
          eq: (col: string, val: unknown) => {
            if (col === 'status' && val === 'active') return Promise.resolve(listaOuErro)
            const lido = { data: { status: opts.statusNaReleitura ?? 'active' }, error: null }
            return { maybeSingle: () => Promise.resolve(lido), single: () => Promise.resolve(lido) }
          },
        }),
        update: (data: Record<string, unknown>) => updateChain(table, data),
      }
    }
    if (table === 'ab_test_cycles') {
      return {
        select: () => ({
          eq: (_c: string, id: unknown) => {
            const t = tests.find(x => x.id === id)
            return Promise.resolve({ data: null, count: t ? t.cycles.length : 0, error: null })
          },
          // T8: leitura paginada da rede v2 (sem ciclos neste fake; o cenário da rede está em ab-evaluate-rede-v2.test.ts)
          in: () => ({ order: () => ({ range: () => Promise.resolve({ data: [], error: null }) }) }),
        }),
        update: (data: Record<string, unknown>) => updateChain(table, data),
      }
    }
    if (table === 'youtube_videos') {
      return {
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: { youtube_video_id: 'YT_123', channel_id: 'ch-1' }, error: null }) }),
        }),
      }
    }
    if (table === 'ab_test_variants') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { id: 'v2', label: 'variant_b', blob_url: 'https://blob/b.jpg', title_text: 'New Title' }, error: null,
            }),
          }),
        }),
      }
    }
    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
  })

  const client = { from, rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) } as unknown as ReturnType<typeof import('@/lib/supabase/service').getSupabaseServiceClient>
  return {
    supabase: client,
    escritas: () => writes,
    escritasEm: (t: string) => writes.filter(w => w.table === t),
    gravadoEm: (t: string) => writes.filter(w => w.table === t).at(-1)!.data,
    filtrosDoUpdate: (t: string) => writes.filter(w => w.table === t).at(-1)!.filtros,
  }
}

function clienteQueFalhaAoLer(_tabela: 'ab_tests') {
  return clienteCom([], { falhaAoLer: true })
}

// ─── Setup / Teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubEnv('LINKS_SHORT_DOMAIN', 'go.test.com')
  vi.clearAllMocks()
  mockChannelAccountId.mockResolvedValue('UCpt')
  ;(calculateBayesianConfidence as ReturnType<typeof vi.fn>).mockReturnValue({
    winnerId: 'v2', confidence: 0.97, probabilities: { v1: 0.03, v2: 0.97 },
  })
  ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({ accessToken: 't' })
  ;(fetchVariantImageBuffer as ReturnType<typeof vi.fn>).mockResolvedValue({
    buffer: Buffer.from('x'), contentType: 'image/jpeg',
  })
  settle.mockReset()
  settle.mockResolvedValue({ resultado: 'feito', campos: { thumbnail: { estado: 'ok' } } })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ─── Fase 2: duração máxima ─────────────────────────────────────────────────

describe('phaseEvaluateActiveTests: ramo único', () => {
  it('antes da duração máxima (13 de 14 dias, duas variantes com impressões) não escreve nada, nem no banco nem no YouTube', async () => {
    const { supabase, escritas } = clienteCom([testeAtivo({ diasNoAr: 13, maxDuracao: 14, ciclos: ciclosComVencedorClaro() })])
    const r = await phaseEvaluateActiveTests(supabase)
    expect(r).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
    expect(escritas()).toHaveLength(0)
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })

  it('fronteira: com 14 de 14 dias encerra', async () => {
    const { supabase } = clienteCom([testeAtivo({ diasNoAr: 14, maxDuracao: 14, ciclos: ciclosComVencedorClaro() })])
    expect(await phaseEvaluateActiveTests(supabase)).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
  })

  it('duração vencida, critérios todos verdes: pede settleOnAir(original, duracao_maxima) e NÃO grava nada pela fase (vencedor e carência são do banco)', async () => {
    const { supabase, escritas } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14, ciclos: ciclosComVencedorClaro(), comVencedorSugerido: true, carenciaAte: 'futuro' })])
    const r = await phaseEvaluateActiveTests(supabase)
    expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
    expect(settle).toHaveBeenCalledTimes(1)
    expect(settle).toHaveBeenCalledWith('test-1', { siteId: 'site-1', destino: { tipo: 'original' }, motivo: 'duracao_maxima', prazo: expect.any(Number) })
    expect(escritas()).toHaveLength(0)
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })

  it('regra_duracao v2 com 30 dias em ms: a guarda v2 não chama settleOnAir (evaluated conta 1); v1 igual encerra', async () => {
    vi.mocked(settle).mockClear()
    const v2 = clienteCom([testeAtivo({ diasNoAr: 30, maxDuracao: 14, regraDuracao: 'v2' })])
    expect(await phaseEvaluateActiveTests(v2.supabase)).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
    expect(settle).not.toHaveBeenCalled()
    const v1 = clienteCom([testeAtivo({ diasNoAr: 30, maxDuracao: 14, regraDuracao: 'v1' })])
    expect((await phaseEvaluateActiveTests(v1.supabase)).resolved).toBe(1)
  })

  it('config sem max_duration_days: usa 14 dias (padrão testado apagando a chave)', async () => {
    const t = testeAtivo({ diasNoAr: 15, maxDuracao: 14 })
    delete (t.config as Record<string, unknown>).max_duration_days
    const { supabase } = clienteCom([t])
    expect((await phaseEvaluateActiveTests(supabase)).resolved).toBe(1)
    const t2 = testeAtivo({ diasNoAr: 13, maxDuracao: 14 })
    delete (t2.config as Record<string, unknown>).max_duration_days
    expect((await phaseEvaluateActiveTests(clienteCom([t2]).supabase)).resolved).toBe(0)
  })

  it('started_at nulo usa created_at: criado há 3 dias não encerra; criado há 15 encerra', async () => {
    const novo = clienteCom([testeAtivo({ startedAt: null, criadoHaDias: 3, maxDuracao: 14 })])
    expect(await phaseEvaluateActiveTests(novo.supabase)).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
    expect(novo.escritas()).toHaveLength(0)
    const velho = clienteCom([testeAtivo({ startedAt: null, criadoHaDias: 15, maxDuracao: 14 })])
    expect((await phaseEvaluateActiveTests(velho.supabase)).resolved).toBe(1)
  })

  it.each(['thumbnail', 'title', 'combo'] as const)('teste de %s vencido: um pedido de saída, sem escrita direta no YouTube', async (tipo) => {
    const { supabase } = clienteCom([testeAtivo({ tipo, diasNoAr: 15, maxDuracao: 14, ciclos: [cicloVazio()], originalNoBlob: true })])
    expect(await phaseEvaluateActiveTests(supabase)).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
    expect(settle).toHaveBeenCalledTimes(1)
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('campo que não voltou ao original (falhou): resolved 1, errors 1 (o cron fica vermelho), sem Sentry de exceção', async () => {
    settle.mockResolvedValueOnce({ resultado: 'feito', campos: { thumbnail: { estado: 'falhou' }, title: { estado: 'ok' } } })
    const { supabase } = clienteCom([testeAtivo({ tipo: 'combo', diasNoAr: 15, maxDuracao: 14 })])
    expect(await phaseEvaluateActiveTests(supabase)).toEqual({ evaluated: 1, resolved: 1, errors: 1 })
  })

  it('pausa convertida pela guarda do teste do YouTube não conta como resolvida (Phil C1)', async () => {
    settle.mockResolvedValueOnce({ resultado: 'feito', campos: { thumbnail: { estado: 'pulado_teste_youtube' } }, pausadoPorTesteYoutube: true })
    const { supabase } = clienteCom([testeAtivo({ diasNoAr: 15 })])
    expect(await phaseEvaluateActiveTests(supabase)).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
  })

  it('campo desistiu também deixa o cron vermelho; pulado_drift e pulado_sem_original não', async () => {
    settle.mockResolvedValueOnce({ resultado: 'feito', campos: { thumbnail: { estado: 'desistiu' } } })
    expect((await phaseEvaluateActiveTests(clienteCom([testeAtivo({ diasNoAr: 15 })]).supabase)).errors).toBe(1)
    settle.mockResolvedValueOnce({ resultado: 'feito', campos: { thumbnail: { estado: 'pulado_drift' }, title: { estado: 'pulado_sem_original' } } })
    expect((await phaseEvaluateActiveTests(clienteCom([testeAtivo({ diasNoAr: 15 })]).supabase)).errors).toBe(0)
  })

  it('a leitura de ab_tests falha: conta erro, não devolve zero em verde', async () => {
    const { supabase } = clienteQueFalhaAoLer('ab_tests')
    expect(await phaseEvaluateActiveTests(supabase)).toEqual({ evaluated: 0, resolved: 0, errors: 1 })
  })

  it('settleOnAir lança no primeiro de dois testes vencidos: conta erro, vai ao Sentry e o segundo é pedido', async () => {
    settle.mockRejectedValueOnce(new Error('ab_settle_claim caiu'))
    const { supabase } = clienteCom([testeAtivo({ id: 'a', diasNoAr: 15, maxDuracao: 14 }), testeAtivo({ id: 'b', diasNoAr: 15, maxDuracao: 14 })])
    expect(await phaseEvaluateActiveTests(supabase)).toMatchObject({ resolved: 1, errors: 1 })
    expect(settle).toHaveBeenCalledTimes(2)
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it.each(['ja_encerrado', 'em_andamento'] as const)('settleOnAir devolve %s (outro escritor é dono do teste): não conta resolvido nem erro', async (resultado) => {
    settle.mockResolvedValueOnce({ resultado, campos: null })
    const { supabase } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14 })])
    expect(await phaseEvaluateActiveTests(supabase)).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
  })

  it('F-D3: corte de tempo: com menos de 40 s de rota pela frente não inicia a saída, adia com Sentry e o teste não conta como resolvido', async () => {
    const { supabase } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14 })])
    const r = await phaseEvaluateActiveTests(supabase, Date.now() - 100_000) // 20 s sobram dos 120 s
    expect(r).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
    expect(settle).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith('ab-evaluate: duração máxima adiada por tempo', expect.anything())
  })

  it('T8 r1 (Yannis DEVE-1, Phil DEVE-1): o prazo passado ao settle é o início da rota + 105 s (15 s ficam para longevidade, recordCron e escalada)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const inicio = Date.now() - 30_000
      const { supabase } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14 })])
      await phaseEvaluateActiveTests(supabase, inicio)
      expect(settle).toHaveBeenCalledWith('test-1', expect.objectContaining({ prazo: inicio + 105_000 }))
    } finally { vi.useRealTimers() }
  })

  it('T8 r1: o corte de "não inicia" mede contra o mesmo fim (105 s): com 39 s até o fim adia, com 41 s inicia', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const { supabase } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14 })])
      await phaseEvaluateActiveTests(supabase, Date.now() - 66_000)
      expect(settle).not.toHaveBeenCalled()
      await phaseEvaluateActiveTests(supabase, Date.now() - 64_000)
      expect(settle).toHaveBeenCalledTimes(1)
    } finally { vi.useRealTimers() }
  })

  it('F-D3: no limite (40 s sobrando) ainda inicia; o relógio anda entre dois testes e o segundo é adiado', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      settle.mockImplementation(async () => { vi.advanceTimersByTime(45_000); return { resultado: 'feito', campos: {} } })
      const { supabase } = clienteCom([testeAtivo({ id: 'a', diasNoAr: 15 }), testeAtivo({ id: 'b', diasNoAr: 15 }), testeAtivo({ id: 'c', diasNoAr: 15 })])
      const r = await phaseEvaluateActiveTests(supabase, Date.now() - 40_000) // restam 80 s: o 1º começa (80), o 2º tem 35 s e é adiado
      expect(settle).toHaveBeenCalledTimes(1)
      expect(r).toEqual({ evaluated: 3, resolved: 1, errors: 0 })
    } finally { vi.useRealTimers() }
  })

  it('AB_AUTO_APPLY_WINNER=true com carência vencida não aplica nada nem escreve em ab_tests', async () => {
    process.env.AB_AUTO_APPLY_WINNER = 'true'
    try {
      const { supabase, escritasEm } = clienteCom([testeAtivo({
        tipo: 'combo', diasNoAr: 3, maxDuracao: 14, ciclos: ciclosComVencedorClaro(),
        comVencedorSugerido: true, carenciaAte: 'passado', consecutiveConfidentEvals: 3,
      })])
      await phaseEvaluateActiveTests(supabase)
      expect(setThumbnail).not.toHaveBeenCalled()
      expect(updateVideoMetadata).not.toHaveBeenCalled()
      expect(escritasEm('ab_tests')).toHaveLength(0)
    } finally {
      delete process.env.AB_AUTO_APPLY_WINNER
    }
  })
})
