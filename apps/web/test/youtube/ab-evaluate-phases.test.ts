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
vi.mock('@/lib/youtube/ab-templates', () => ({ resolveTemplates: vi.fn() }))
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
vi.mock('@/lib/youtube/ab-playoff', () => ({
  checkPlayoffEligibility: vi.fn(() => ({ eligible: false })),
  selectPlayoffVariants: vi.fn(() => null),
}))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ autoImportWinner: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn().mockResolvedValue(1) }))

import {
  phaseEvaluateActiveTests,
  phaseAutoStartPlayoffs,
} from '@/lib/youtube/ab-evaluate-phases'
import * as Sentry from '@sentry/nextjs'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { fetchVariantImageBuffer, setThumbnail } from '@/lib/youtube/ab-youtube'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { resolveTemplates } from '@/lib/youtube/ab-templates'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { startAbTestInternal } from '@/lib/youtube/ab-start'

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
    original_description: 'Original Description',
    original_thumbnail_url: o.originalNoBlob ? BLOB : FORA_DO_BLOB,
    consecutive_confident_evals: o.consecutiveConfidentEvals ?? 0,
    grace_expires_at: o.carenciaAte === 'futuro' ? new Date(Date.now() + DIA).toISOString()
      : o.carenciaAte === 'passado' ? new Date(Date.now() - 3_600_000).toISOString() : null,
    winner_variant_id: o.comVencedorSugerido ? 'v2' : null,
    confidence_at_completion: null as number | null,
    config: {
      confidence_threshold: 0.95, burn_in_days: 0, auto_apply_winner: true,
      max_duration_days: o.maxDuracao ?? 14, stability_threshold: 3,
    },
    variants: [
      { id: 'v1', label: 'original', is_original: true, sort_order: 0, blob_url: 'https://blob/a.jpg', title_text: null, description_text: null, metadata: {} },
      { id: 'v2', label: 'variant_b', is_original: false, sort_order: 1, blob_url: 'https://blob/b.jpg', title_text: 'New Title', description_text: null, metadata: {} },
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
  draftPlayoffs?: unknown[]
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
            if (col === 'status' && val === 'draft') {
              const ch: Record<string, unknown> = {}
              for (const m of ['eq', 'not', 'lte']) ch[m] = () => ch
              ch.then = (r: (v: unknown) => void) => r({ data: opts.draftPlayoffs ?? [], error: null })
              return ch
            }
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
              data: { id: 'v2', label: 'variant_b', blob_url: 'https://blob/b.jpg', title_text: 'New Title', description_text: null }, error: null,
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
  ;(resolveTemplates as ReturnType<typeof vi.fn>).mockImplementation((text: string) => text)
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

  it('critérios todos verdes e duração vencida: encerra inconclusive, sem vencedor, sem carência, ciclos fechados', async () => {
    const { supabase, gravadoEm } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14, ciclos: ciclosComVencedorClaro(), comVencedorSugerido: true, carenciaAte: 'futuro' })])
    const r = await phaseEvaluateActiveTests(supabase)
    expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
    const linha = gravadoEm('ab_tests')
    expect(linha).toMatchObject({
      status: 'completed', completed_reason: 'inconclusive', confidence_at_completion: null,
      winner_variant_id: null, grace_expires_at: null,
    })
    for (const chave of ['winner_applied_at', 'applied_by', 'consecutive_confident_evals', 'result_metadata']) {
      expect(linha).not.toHaveProperty(chave)
    }
    expect(gravadoEm('ab_test_cycles')).toHaveProperty('ended_at')
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
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

  it.each(['thumbnail', 'combo'] as const)('%s, com ciclo (foi ao ar) e original no Blob: tenta restaurar uma vez', async (tipo) => {
    const { supabase, gravadoEm } = clienteCom([testeAtivo({ tipo, diasNoAr: 15, maxDuracao: 14, ciclos: [cicloVazio()], originalNoBlob: true })])
    const r = await phaseEvaluateActiveTests(supabase)
    expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
    expect(setThumbnail).toHaveBeenCalledTimes(1)
    expect(gravadoEm('ab_tests')).not.toHaveProperty('status_note')
  })

  it.each(['title', 'description'] as const)('teste de %s não chama setThumbnail e encerra sem erro', async (tipo) => {
    const { supabase, gravadoEm } = clienteCom([testeAtivo({ tipo, diasNoAr: 15, maxDuracao: 14, ciclos: [cicloVazio()], originalNoBlob: true })])
    const r = await phaseEvaluateActiveTests(supabase)
    expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(gravadoEm('ab_tests')).not.toHaveProperty('status_note')
  })

  it('thumbnail que nunca foi ao ar (nenhum ciclo): não chama o YouTube, encerra sem erro', async () => {
    const { supabase } = clienteCom([testeAtivo({ tipo: 'thumbnail', diasNoAr: 15, maxDuracao: 14, ciclos: [], originalNoBlob: true })])
    const r = await phaseEvaluateActiveTests(supabase)
    expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('original fora do Blob, com variante que foi ao ar: encerra, status_note preenchido, errors 1, sem chamar o YouTube', async () => {
    const { supabase, gravadoEm } = clienteCom([testeAtivo({ tipo: 'thumbnail', diasNoAr: 15, maxDuracao: 14, ciclos: [cicloVazio()], originalNoBlob: false })])
    const r = await phaseEvaluateActiveTests(supabase)
    expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 1 })
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(gravadoEm('ab_tests').status_note).toMatch(/original não restaurado \(sem_original_no_blob\)/)
  })

  it('a restauração falha (setThumbnail rejeita): encerra, resolved 1, errors 1, status_note preenchido, Sentry chamado', async () => {
    ;(setThumbnail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('token expirado'))
    const { supabase, gravadoEm } = clienteCom([testeAtivo({ tipo: 'thumbnail', diasNoAr: 15, maxDuracao: 14, ciclos: [cicloVazio()], originalNoBlob: true })])
    const r = await phaseEvaluateActiveTests(supabase)
    expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 1 })
    expect(gravadoEm('ab_tests').status_note).toMatch(/original não restaurado \(falhou\)/)
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('a leitura de ab_tests falha: conta erro, não devolve zero em verde', async () => {
    const { supabase } = clienteQueFalhaAoLer('ab_tests')
    expect(await phaseEvaluateActiveTests(supabase)).toEqual({ evaluated: 0, resolved: 0, errors: 1 })
  })

  it('a gravação do encerramento falha: conta erro e não conta como resolvido', async () => {
    const { supabase } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14 })], { falhaAoGravar: 'ab_tests' })
    expect(await phaseEvaluateActiveTests(supabase)).toMatchObject({ resolved: 0, errors: 1 })
  })

  it('fechar os ciclos falha: resolved 0, errors 1 e ab_tests não é gravado', async () => {
    const { supabase, escritasEm } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14 })], { falhaAoGravar: 'ab_test_cycles' })
    expect(await phaseEvaluateActiveTests(supabase)).toMatchObject({ resolved: 0, errors: 1 })
    expect(escritasEm('ab_tests')).toHaveLength(0)
  })

  it('dois testes vencidos, o primeiro falha: o segundo encerra', async () => {
    const { supabase } = clienteCom(
      [testeAtivo({ id: 'a', diasNoAr: 15, maxDuracao: 14 }), testeAtivo({ id: 'b', diasNoAr: 15, maxDuracao: 14 })],
      { falhaAoGravar: { tabela: 'ab_test_cycles', idDoTeste: 'a' } },
    )
    expect(await phaseEvaluateActiveTests(supabase)).toMatchObject({ resolved: 1, errors: 1 })
  })

  it('o teste deixou de ser active entre a leitura e a restauração: setThumbnail não é chamado e nada é gravado', async () => {
    const { supabase, escritas } = clienteCom(
      [testeAtivo({ tipo: 'thumbnail', diasNoAr: 15, maxDuracao: 14, ciclos: [cicloVazio()], originalNoBlob: true })],
      { statusNaReleitura: 'completed' },
    )
    const r = await phaseEvaluateActiveTests(supabase)
    expect(r).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(escritas()).toHaveLength(0)
  })

  it('o update final casa zero linha (alguém encerrou ou pausou à mão): resolved 0, errors 0, e o filtro status=active foi enviado', async () => {
    const { supabase, filtrosDoUpdate } = clienteCom([testeAtivo({ diasNoAr: 15, maxDuracao: 14 })], { updateCasaZeroLinha: true })
    expect(await phaseEvaluateActiveTests(supabase)).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
    expect(filtrosDoUpdate('ab_tests')).toMatchObject({ id: expect.any(String), status: 'active' })
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

// ─── Phase 1: phaseAutoStartPlayoffs ────────────────────────────────────────

describe('phaseAutoStartPlayoffs', () => {
  it('starts draft round-2 playoffs past cooldown', async () => {
    const playoff = {
      id: 'playoff-1',
      site_id: 'site-1',
      round_number: 2,
      parent_test_id: 'parent-1',
      playoff_start_after: new Date(Date.now() - 3_600_000).toISOString(), // 1h ago — past cooldown
    }

    ;(startAbTestInternal as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true })

    const { supabase: client } = clienteCom([], { draftPlayoffs: [playoff] })

    const result = await phaseAutoStartPlayoffs(client)

    expect(result.processed).toBe(1)
    expect(result.errors).toBe(0)
    expect(startAbTestInternal).toHaveBeenCalledWith('playoff-1', 'site-1')
  })
})
