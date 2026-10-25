// @vitest-environment node
/**
 * A/B Lab P2, Tarefa 4: o pipeline (REST = serviço, ação MCP e recurso MCP) entrega `null` com
 * `aviso` onde entregava impressões, cliques, confiança e lift fabricados; vitória só conta
 * quando humana (`ehVitoriaHumana`).
 *
 * PostgREST em memória (fakePostgrest). O REST das rotas devolve `data` do serviço sem tocar nele,
 * então "REST" aqui é o próprio retorno do serviço; a ação e o recurso MCP passam pelos adaptadores.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import type { FakePostgrestOptions } from '../helpers/fake-postgrest'
import { fakePostgrestComDias as fakePostgrest } from '../helpers/fake-postgrest-dias'
import { createTestMcpPair, type McpTestPair } from '../mcp/helpers'

let sb = fakePostgrest({ tables: {} })

const mcpCtx = { siteId: 'site-1', permissions: ['read'] as string[], keyHash: 'h', keyId: 'key-1' }
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => mcpCtx }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => sb.client }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))

import * as youtube from '@/lib/pipeline/services/youtube'
import { projetarTeste } from '@/lib/pipeline/services/youtube'
import { manageAbTest } from '@/lib/pipeline/mcp/services/ab-tests'
import { registerResources } from '@/lib/pipeline/mcp/resources'
import type { ServiceContext } from '@/lib/pipeline/services/types'

const AVISO = 'sem métrica de entrega'
const SITE = 'site-1'
const ctxOf = (): ServiceContext => ({ siteId: SITE, permissions: ['read'], supabase: sb.client as unknown as ServiceContext['supabase'], source: 'api_key' })

let pair: McpTestPair | null = null
afterEach(async () => { await pair?.cleanup(); pair = null })
beforeEach(() => { mcpCtx.permissions = ['read'] })

function chavesNumericasNaoNulas(o: Record<string, unknown>): string[] {
  return Object.entries(o).filter(([, v]) => typeof v === 'number').map(([k]) => k).sort()
}

// ---- fixtures fiéis: TODAS as colunas das duas tabelas (database.types.ts), numéricas diferentes de zero ----
function testeCompleto(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    applied_by: 'auto', apply_attempts: 2, completed_at: '2026-03-10T00:00:00.000Z', completed_reason: 'manual_winner',
    confidence_at_completion: 0.97, config: {}, consecutive_confident_evals: 3, created_at: '2026-03-01T00:00:00.000Z',
    drift_acknowledged_at: null, grace_expires_at: null, id: 't1', last_applied_variant_id: null, last_apply_error: null,
    name: 'Teste', original_thumbnail_url: 'https://x/y.png', original_title: 'T',
    parent_test_id: null, paused_at: null, playoff_start_after: null, playoff_test_id: null, queue_start_after: null,
    result_metadata: { winner_label: 'B', ctr_lift_percent: 12, total_impressions: 5000, estimated_monthly_extra_clicks: 90 },
    revert_expires_at: null, round_number: 4, site_id: SITE, source_pipeline_id: null, started_at: '2026-03-01T00:00:00.000Z',
    status: 'completed', status_note: null, test_type: 'thumbnail', updated_at: '2026-03-10T00:00:00.000Z',
    winner_applied_at: null, winner_variant_id: 'v1', youtube_video_id: 'yt1',
    restore_status: null, restore_seq: 3,
    variants: [{ id: 'v1', label: 'B', is_original: false, blob_url: null, title_text: null, metadata: {}, sort_order: 1 }],
    cycles: [{
      applied_metadata: null, avd_seconds: 31, backfill_attempts: 2, backfill_status: 'confirmed', clicks: 15, created_at: '2026-03-01T00:00:00.000Z',
      ctr: 0.1, cycle_number: 1, ended_at: null, estimated_clicks: 14, estimated_ctr: 0.09, estimated_impressions: 140, estimated_revenue: 3.5,
      end_reason: null, id: 'c1', impressions: 150, likes: 7, started_at: '2026-03-01T00:00:00.000Z', subscribers_gained: 2, test_id: 't1', variant_id: 'v1', views: 80,
    }],
    tracked_links: [],
    ...over,
  }
}
const COLS_TESTE = Object.keys(testeCompleto()).filter(k => !['variants', 'cycles', 'tracked_links'].includes(k))

const semTestes = (): FakePostgrestOptions => ({
  tables: { sites: [{ id: SITE }], ab_tests: [], ab_test_variants: [], thumbnail_library: [], ab_test_cycles: [] },
  columns: {
    ab_tests: COLS_TESTE,
    ab_test_variants: ['id', 'test_id', 'metadata'],
    thumbnail_library: ['id', 'blob_url', 'title', 'video_title', 'tags', 'lift_at_win', 'source_type', 'site_id', 'created_at'],
    ab_test_cycles: ['test_id', 'variant_id', 'impressions', 'clicks'],
  },
})

/** um auto_resolve, um manual_winner, um manual_no_apply (os dois com vencedor) e um inconclusive (sem). */
function mundoMisto(): FakePostgrestOptions {
  const w = (tag: string) => ({ id: `w-${tag}`, label: tag, title_text: null, metadata: { thumbnail_tags: [tag], title_pattern: `p-${tag}` } })
  return {
    tables: {
      sites: [{ id: SITE }],
      ab_tests: [
        testeCompleto({ id: 'ta', completed_reason: 'auto_resolve', winner_variant_id: 'va', youtube_video_id: 'yt-a', winner: w('tag-so-do-auto'), variants: [w('tag-so-do-auto')] }),
        testeCompleto({ id: 'tm', completed_reason: 'manual_winner', winner_variant_id: 'vm', youtube_video_id: 'yt-m', winner: w('tag-so-do-manual'), variants: [w('tag-so-do-manual')] }),
        testeCompleto({ id: 'tn', completed_reason: 'manual_no_apply', winner_variant_id: 'vn', youtube_video_id: 'yt-n', winner: w('tag-so-do-no-apply'), variants: [w('tag-so-do-no-apply')] }),
        testeCompleto({ id: 'ti', completed_reason: 'inconclusive', winner_variant_id: null, youtube_video_id: 'yt-i', winner: null, variants: [] }),
      ],
      ab_test_variants: [
        { id: 'va', test_id: 'ta', metadata: { thumbnail_tags: ['tag-so-do-auto'] } },
        { id: 'vm', test_id: 'tm', metadata: { thumbnail_tags: ['tag-so-do-manual'] } },
        { id: 'vn', test_id: 'tn', metadata: { thumbnail_tags: ['tag-so-do-no-apply'] } },
      ],
      thumbnail_library: [{ id: 'th1', blob_url: 'https://x/t.png', title: 'a', video_title: 'V', tags: ['x'], lift_at_win: 8.5, source_type: 'ab', site_id: SITE, created_at: '2026-03-01T00:00:00.000Z', thumbnail_longevity: [] }],
    },
    columns: semTestes().columns,
  }
}

/** teste de A/B concluído com um so manual_winner (para getAbTest) */
function mundoUmTeste(): FakePostgrestOptions {
  const o = mundoMisto()
  o.tables.ab_tests = [testeCompleto()]
  return o
}

describe('funil: impressões e cliques de entrega saem null com aviso; link_clicks sai null (P3: sem link rastreado)', () => {
  const START = '2026-03-01T00:00:00.000Z'
  const END = '2026-03-10T00:00:00.000Z'
  const world = (): FakePostgrestOptions => ({
    tables: {
      sites: [{ id: SITE }],
      ab_tests: [{ id: 't1', site_id: SITE, started_at: START, completed_at: END }],
      ab_test_cycles: [
        { test_id: 't1', variant_id: 'v1', impressions: 150, clicks: 15, started_at: START },
        { test_id: 't1', variant_id: 'v2', impressions: 200, clicks: 30, started_at: START },
      ],
      tracked_links: [{ id: 'l1', site_id: SITE, deleted_at: null }],
      link_clicks: [{ id: 'c1', site_id: SITE, link_id: 'l1', is_bot: false, clicked_at: '2026-03-02T00:00:00.000Z' }],
    },
    columns: {
      ab_tests: ['id', 'site_id', 'started_at', 'completed_at'],
      ab_test_cycles: ['test_id', 'variant_id', 'impressions', 'clicks', 'started_at'],
      tracked_links: ['id', 'site_id', 'deleted_at'],
      link_clicks: ['id', 'site_id', 'link_id', 'is_bot', 'clicked_at'],
    },
  })

  it('REST (serviço)', async () => {
    sb = fakePostgrest(world())
    const { data } = await youtube.getAbTestFunnel(ctxOf(), 't1')
    expect(data.aviso).toBe(AVISO)
    expect(data.per_variant.length).toBeGreaterThan(0)
    for (const v of data.per_variant) {
      expect(v.impressions).toBeNull()
      expect(v.clicks).toBeNull()
      expect(v.link_clicks).toBeNull()
    }
    expect(data.per_link).toEqual([])
    expect(data.link_clicks_window).toBeNull()
  })

  it('I-1: ciclos com impressions null (caso real de produção) ainda listam as variantes que rodaram', async () => {
    const w = world()
    w.tables.ab_test_cycles = [
      { test_id: 't1', variant_id: 'v1', impressions: null, clicks: null, started_at: START },
      { test_id: 't1', variant_id: 'v2', impressions: null, clicks: null, started_at: START },
    ]
    sb = fakePostgrest(w)
    const { data } = await youtube.getAbTestFunnel(ctxOf(), 't1')
    expect(data.per_variant.map(v => v.variant_id).sort()).toEqual(['v1', 'v2'])
    for (const v of data.per_variant) expect(v.impressions).toBeNull()
  })

  it('paridade: ação MCP get_funnel dá o mesmo JSON do serviço', async () => {
    sb = fakePostgrest(world())
    const rest = await youtube.getAbTestFunnel(ctxOf(), 't1')
    const mcp = await acao({ action: 'get_funnel', test_id: 't1' }) as Record<string, unknown>
    expect(mcp).toEqual(doJson(rest.data))
    expect(JSON.stringify(mcp)).not.toMatch(/"impressions":\s*0/)
    expect(mcp.aviso).toBe(AVISO)
  })
})

async function acao(params: Record<string, unknown>): Promise<Record<string, unknown> | unknown[]> {
  const r = await manageAbTest(params)
  return JSON.parse((r.content[0] as { text: string }).text)
}
async function recurso(uri: string): Promise<unknown> {
  pair = await createTestMcpPair({ setupServer: s => registerResources(s) })
  const res = await pair.client.readResource({ uri })
  return JSON.parse((res.contents[0] as { text: string }).text)
}
const doJson = (x: unknown) => JSON.parse(JSON.stringify(x))

describe('getAbTest / listAbTests: lista fechada, campos de entrega null, aviso', () => {
  it('getAbTest: ciclo e teste de entrega saem null; só as chaves numéricas esperadas continuam', async () => {
    sb = fakePostgrest(mundoUmTeste())
    const { data } = await youtube.getAbTest(ctxOf(), 't1')
    expect(data.confidence_at_completion).toBeNull()
    expect(data.consecutive_confident_evals).toBeNull()
    expect(data.result_metadata).toEqual({ winner_label: 'B', ctr_lift_percent: null, total_impressions: null, estimated_monthly_extra_clicks: null })
    expect(data.aviso).toBe(AVISO)
    const cycle = (data.cycles as Record<string, unknown>[])[0]!
    for (const k of ['impressions', 'clicks', 'ctr', 'estimated_impressions', 'estimated_clicks', 'estimated_ctr']) expect(cycle[k]).toBeNull()
    expect(chavesNumericasNaoNulas(cycle)).toEqual(['avd_seconds', 'backfill_attempts', 'cycle_number', 'estimated_revenue', 'likes', 'subscribers_gained', 'views'])
    expect(chavesNumericasNaoNulas(data)).toEqual(['apply_attempts', 'round_number'])
  })

  it('coluna futura de ab_tests / ab_test_cycles não vaza (lista fechada)', async () => {
    const o = mundoUmTeste()
    const t = o.tables.ab_tests![0]!
    t.coluna_futura_do_teste = 123
    ;(t.cycles as Record<string, unknown>[])[0]!.coluna_futura_do_ciclo = 456
    sb = fakePostgrest(o)
    const { data } = await youtube.getAbTest(ctxOf(), 't1')
    expect(data).not.toHaveProperty('coluna_futura_do_teste')
    expect(data).not.toHaveProperty('restore_seq') // interno
    expect(data).toHaveProperty('restore_status') // sai cru
    expect((data.cycles as Record<string, unknown>[])[0]).not.toHaveProperty('coluna_futura_do_ciclo')
    const lista = await youtube.listAbTests(ctxOf(), {})
    expect(lista.data[0]).not.toHaveProperty('coluna_futura_do_teste')
    expect(lista.data[0]).not.toHaveProperty('restore_seq')
  })

  it('listAbTests continua vetor, com aviso e nulls em cada item', async () => {
    sb = fakePostgrest(mundoMisto())
    const { data } = await youtube.listAbTests(ctxOf(), {})
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(4)
    for (const t of data as unknown as Record<string, unknown>[]) {
      expect(t.aviso).toBe(AVISO)
      expect(t.confidence_at_completion).toBeNull()
      expect(t.consecutive_confident_evals).toBeNull()
      expect(t.result_metadata).toMatchObject({ ctr_lift_percent: null, total_impressions: null, estimated_monthly_extra_clicks: null })
      expect(chavesNumericasNaoNulas(t)).toEqual(['apply_attempts', 'round_number'])
    }
  })

  it('paridade: get_test, list_tests (ação) e recurso ab-tests dão o mesmo JSON do serviço', async () => {
    sb = fakePostgrest(mundoUmTeste())
    const t = await youtube.getAbTest(ctxOf(), 't1')
    expect(await acao({ action: 'get_test', test_id: 't1' })).toEqual(doJson(t.data))
    const l = await youtube.listAbTests(ctxOf(), {})
    expect(await acao({ action: 'list_tests' })).toEqual(doJson(l.data))
    expect(await recurso('pipeline://youtube/ab-tests')).toEqual(doJson(l.data))
    expect(JSON.stringify(l.data)).toContain(AVISO)
  })
})

describe('painel (getAbDashboard)', () => {
  it('confiança e lift saem null com aviso; winRate só conta vitória humana (auto_resolve fora de numerador e denominador)', async () => {
    const o = mundoMisto()
    o.tables.ab_tests = [
      testeCompleto({ id: 'a', completed_reason: 'manual_winner', winner_variant_id: 'v1' }),
      testeCompleto({ id: 'b', completed_reason: 'auto_resolve', winner_variant_id: 'v2' }),
      testeCompleto({ id: 'c', completed_reason: 'inconclusive', winner_variant_id: null }),
    ]
    sb = fakePostgrest(o)
    const { data } = await youtube.getAbDashboard(ctxOf())
    expect(data.avgConfidence).toBeNull()
    expect(data.avgLift).toBeNull()
    expect(data.aviso).toBe(AVISO)
    expect(data.winRate).toBe(50)
    expect(data.testsByStatus.completed).toBe(3)
  })

  it('B2: original vencedora entra no denominador e não conta como vitória de variante (Cowork)', async () => {
    const o = mundoMisto()
    const vars = [{ id: 'vo', is_original: true }, { id: 'vb', is_original: false }]
    o.tables.ab_tests = [
      testeCompleto({ id: 'a', completed_reason: 'manual_winner', winner_variant_id: 'vb', variants: vars }),
      testeCompleto({ id: 'b', completed_reason: 'manual_winner', winner_variant_id: 'vo', variants: vars }),
    ]
    sb = fakePostgrest(o)
    const { data } = await youtube.getAbDashboard(ctxOf())
    expect(data.winRate).toBe(50)
  })
  it('só auto_resolve concluídos: winRate é null, nunca 0', async () => {
    const o = semTestes()
    o.tables.ab_tests = [testeCompleto({ id: 'a', completed_reason: 'auto_resolve', winner_variant_id: 'v1' })]
    sb = fakePostgrest(o)
    expect((await youtube.getAbDashboard(ctxOf())).data.winRate).toBeNull()
  })

  it('sem nenhum teste concluído: winRate null, nunca 0, e o aviso está lá', async () => {
    sb = fakePostgrest(semTestes())
    const { data } = await youtube.getAbDashboard(ctxOf())
    expect(data.winRate).toBeNull()
    expect(data.aviso).toBe(AVISO)
  })

  it('manual_no_apply com vencedor preenchido está no denominador e fora do numerador', async () => {
    const o = semTestes()
    o.tables.ab_tests = [
      testeCompleto({ id: 'n', completed_reason: 'manual_no_apply', winner_variant_id: 'v9' }),
      testeCompleto({ id: 'm', completed_reason: 'manual_winner', winner_variant_id: 'v1' }),
    ]
    sb = fakePostgrest(o)
    expect((await youtube.getAbDashboard(ctxOf())).data.winRate).toBe(50)
  })

  it('paridade: get_dashboard (ação) e recurso dão o mesmo JSON do serviço', async () => {
    sb = fakePostgrest(mundoMisto())
    const d = await youtube.getAbDashboard(ctxOf())
    expect(await acao({ action: 'get_dashboard' })).toEqual(doJson(d.data))
    expect(await recurso('pipeline://youtube/ab-dashboard')).toEqual(doJson(d.data))
  })
})

describe('vencedor automático ou "sem aplicar" não conta como vitória', () => {
  it('getAbLearnings: só a vitória humana entra; avgLift null; aviso', async () => {
    sb = fakePostgrest(mundoMisto())
    const { data } = await youtube.getAbLearnings(ctxOf())
    expect(data.aviso).toBe(AVISO)
    expect(data.tagWinRates.length).toBeGreaterThan(0)
    expect(data.tagWinRates.every(t => t.avgLift === null)).toBe(true)
    expect(data.tagWinRates.find(t => t.tag === 'tag-so-do-manual')).toBeDefined()
    expect(data.totalCompletedTests).toBe(1)
    const json = JSON.stringify(data)
    expect(json).not.toContain('tag-so-do-auto')
    expect(json).not.toContain('tag-so-do-no-apply')
    expect(json).not.toMatch(/%/)
    expect(json).not.toContain('Not enough data')
  })

  it('getAbPerformance: idem', async () => {
    sb = fakePostgrest(mundoMisto())
    const { data } = await youtube.getAbPerformance(ctxOf())
    expect(data.aviso).toBe(AVISO)
    const json = JSON.stringify(data)
    expect(json).toContain('tag-so-do-manual')
    expect(json).not.toContain('tag-so-do-auto')
    expect(json).not.toContain('tag-so-do-no-apply')
  })

  it('getAbVideoHistory: winner só sai preenchido para vitória humana; liftPercent null; aviso', async () => {
    sb = fakePostgrest(mundoMisto())
    const man = (await youtube.getAbVideoHistory(ctxOf(), 'yt-m')).data
    expect(man.aviso).toBe(AVISO)
    expect(man.tests[0]!.winner).toBe('tag-so-do-manual')
    expect(man.tests[0]!.liftPercent).toBeNull()
    expect((await youtube.getAbVideoHistory(ctxOf(), 'yt-n')).data.tests[0]!.winner).toBeNull()
    expect((await youtube.getAbVideoHistory(ctxOf(), 'yt-a')).data.tests[0]!.winner).toBeNull()
    expect((await youtube.getAbVideoHistory(ctxOf(), 'yt-a')).data.tests[0]!.liftPercent).toBeNull()
  })

  describe('S8-F4 B2: a original vencedora não é vitória de variante', () => {
    const w = (tag: string, is_original: boolean) => ({ id: `w-${tag}`, label: tag, title_text: null, is_original, metadata: { thumbnail_tags: [tag], title_pattern: `p-${tag}` } })
    function mundoOriginal(): FakePostgrestOptions {
      const o = mundoMisto()
      o.tables.ab_tests = [
        testeCompleto({ id: 'tv', completed_reason: 'manual_winner', winner_variant_id: 'vv', youtube_video_id: 'yt-v', winner: w('tag-da-variante', false), variants: [w('tag-da-variante', false)] }),
        testeCompleto({ id: 'to', completed_reason: 'manual_winner', winner_variant_id: 'vo', youtube_video_id: 'yt-o', winner: w('tag-da-original', true), variants: [w('tag-da-original', true)] }),
      ]
      o.tables.ab_test_variants = [
        { id: 'vv', test_id: 'tv', metadata: { thumbnail_tags: ['tag-da-variante'] } },
        { id: 'vo', test_id: 'to', metadata: { thumbnail_tags: ['tag-da-original'] } },
      ]
      return o
    }
    it('getAbPerformance: tags e padrões da original não entram em "padrões vencedores"', async () => {
      sb = fakePostgrest(mundoOriginal())
      const json = JSON.stringify((await youtube.getAbPerformance(ctxOf())).data)
      expect(json).toContain('tag-da-variante')
      expect(json).not.toContain('tag-da-original')
      expect(json).not.toContain('p-tag-da-original')
    })
    it('getAbLearnings: tagWinRates ignora a original vencedora', async () => {
      sb = fakePostgrest(mundoOriginal())
      const { data } = await youtube.getAbLearnings(ctxOf())
      expect(data.tagWinRates.map(t => t.tag)).toEqual(['tag-da-variante'])
      expect(data.totalCompletedTests).toBe(1)
    })
    it('getAbVideoHistory (get_history): winner da original sai null', async () => {
      sb = fakePostgrest(mundoOriginal())
      expect((await youtube.getAbVideoHistory(ctxOf(), 'yt-v')).data.tests[0]!.winner).toBe('tag-da-variante')
      expect((await youtube.getAbVideoHistory(ctxOf(), 'yt-o')).data.tests[0]!.winner).toBeNull()
    })
  })

  it('paridade: get_learnings, get_performance, get_history (ação) e recursos dão o mesmo JSON do serviço', async () => {
    sb = fakePostgrest(mundoMisto())
    const l = await youtube.getAbLearnings(ctxOf())
    expect(await acao({ action: 'get_learnings' })).toEqual(doJson(l.data))
    expect(await recurso('pipeline://youtube/ab-learnings')).toEqual(doJson(l.data))
    const p = await youtube.getAbPerformance(ctxOf())
    expect(await acao({ action: 'get_performance' })).toEqual(doJson(p.data))
    const perf = await recurso('pipeline://youtube/ab-performance') as Record<string, unknown>
    expect(perf.aviso).toBe(AVISO)
    const h = await youtube.getAbVideoHistory(ctxOf(), 'yt-m')
    expect(await acao({ action: 'get_history', video_id: 'yt-m' })).toEqual(doJson(h.data))
  })
})

describe('biblioteca de thumbnails', () => {
  it('lift sai null e a resposta tem aviso; REST = ação-irmã = recurso', async () => {
    sb = fakePostgrest(mundoMisto())
    const { data } = await youtube.getThumbnailLibrary(ctxOf())
    expect(data.aviso).toBe(AVISO)
    expect(data.thumbnails.length).toBeGreaterThan(0)
    for (const t of data.thumbnails) expect(t.lift).toBeNull()
    expect(await recurso('pipeline://youtube/thumbnails/library')).toEqual(doJson(data))
  })
})

describe('aviso também com nenhum teste concluído (retorno antecipado)', () => {
  it.each([
    ['getAbDashboard', () => youtube.getAbDashboard(ctxOf())],
    ['getAbLearnings', () => youtube.getAbLearnings(ctxOf())],
    ['getAbPerformance', () => youtube.getAbPerformance(ctxOf())],
    ['getAbVideoHistory', () => youtube.getAbVideoHistory(ctxOf(), 'yt-x')],
    ['getThumbnailLibrary', () => youtube.getThumbnailLibrary(ctxOf())],
  ])('%s', async (_nome, chamar) => {
    sb = fakePostgrest(semTestes())
    const { data } = await chamar()
    expect(JSON.stringify(data)).toContain(AVISO)
  })

  it('getAbLearnings sem vitória humana: retorno antecipado traz aviso e totalCompletedTests 0', async () => {
    const o = semTestes()
    o.tables.ab_tests = [testeCompleto({ completed_reason: 'auto_resolve', winner_variant_id: 'v1' })]
    sb = fakePostgrest(o)
    const { data } = await youtube.getAbLearnings(ctxOf())
    expect(data).toEqual({ tagWinRates: [], channelInsights: [], totalCompletedTests: 0, aviso: AVISO })
  })
})

describe('leitura com erro lança DB_ERROR 500, nunca zero com aviso', () => {
  const falha = (tabela: string): FakePostgrestOptions => ({ ...mundoMisto(), fail: q => (q.table === tabela ? { message: 'boom' } : null) })
  it.each([
    ['getAbDashboard', 'ab_tests', () => youtube.getAbDashboard(ctxOf())],
    ['getAbLearnings', 'ab_tests', () => youtube.getAbLearnings(ctxOf())],
    ['getAbLearnings (variantes)', 'ab_test_variants', () => youtube.getAbLearnings(ctxOf())],
    ['getAbPerformance', 'ab_tests', () => youtube.getAbPerformance(ctxOf())],
    ['getAbVideoHistory', 'ab_tests', () => youtube.getAbVideoHistory(ctxOf(), 'yt-m')],
  ])('%s', async (_nome, tabela, chamar) => {
    sb = fakePostgrest(falha(tabela))
    await expect(chamar()).rejects.toMatchObject({ code: 'DB_ERROR', status: 500 })
  })
})


// ---- A/B P4a T12: restore_status, leitura e end_reason ----
const campoFalhou = { estado: 'falhou', destino: 'original', em: '2026-10-12T08:02:00Z', forcado: false, escreveu: false, erro: { status: 403, reason: 'forbidden' }, attempts: 1 }
const RS = { title: campoFalhou }

describe('A/B P4a T12: restore_status, leitura e end_reason', () => {
  it('P4a-I15: restore_status igual byte a byte em get_test (MCP), getAbTest (REST), list_tests (MCP) e listAbTests (REST); leitura igual; restore_seq fora', async () => {
    const o = mundoUmTeste()
    o.tables.ab_tests = [testeCompleto({ restore_status: RS, restore_seq: 3 })]
    sb = fakePostgrest(o)
    const rest = (await youtube.getAbTest(ctxOf(), 't1')).data
    const listaRest = (await youtube.listAbTests(ctxOf(), {})).data
    const mcp = await acao({ action: 'get_test', test_id: 't1' }) as Record<string, unknown>
    const lista = await acao({ action: 'list_tests' }) as Record<string, unknown>[]
    const nos4 = [mcp, doJson(rest), lista.find(t => t.id === 't1')!, doJson(listaRest.find(t => t.id === 't1'))] as Record<string, unknown>[]
    for (const x of nos4) {
      expect(JSON.stringify(x.restore_status)).toBe(JSON.stringify(RS))
      expect('restore_seq' in x).toBe(false)
      expect((x.leitura as { title: { tipo: string } }).title.tipo).toBe('final')
    }
    expect(JSON.stringify(nos4[0]!.leitura)).toBe(JSON.stringify(nos4[1]!.leitura))
  })

  it('restore_status nulo → restore_status null e leitura null (mundo antigo)', async () => {
    sb = fakePostgrest(mundoUmTeste())
    const x = (await youtube.getAbTest(ctxOf(), 't1')).data
    expect(x.restore_status).toBeNull()
    expect(x.leitura).toBeNull()
  })

  it('restore_status ilegível → leitura { ilegivel: true } (não vira nulo), restore_status sai cru', async () => {
    const ruim = { title: { estado: 'inventado' } }
    const o = mundoUmTeste()
    o.tables.ab_tests = [testeCompleto({ restore_status: ruim })]
    sb = fakePostgrest(o)
    const x = (await youtube.getAbTest(ctxOf(), 't1')).data
    expect(x.leitura).toEqual({ ilegivel: true })
    expect(x.restore_status).toEqual(ruim)
    expect(((await youtube.listAbTests(ctxOf(), {})).data[0] as unknown as Record<string, unknown>).leitura).toEqual({ ilegivel: true })
  })

  it('restore_status {} → leitura {} (passou pelo código novo, nada a mostrar)', async () => {
    const o = mundoUmTeste()
    o.tables.ab_tests = [testeCompleto({ restore_status: {} })]
    sb = fakePostgrest(o)
    const x = (await youtube.getAbTest(ctxOf(), 't1')).data
    expect(x.restore_status).toEqual({})
    expect(x.leitura).toEqual({})
  })

  it('ciclo traz end_reason; variante não traz thumbnail_dhash nem restore_seq (Y-P7)', async () => {
    const o = mundoUmTeste()
    const t = testeCompleto()
    const base = (t.cycles as Record<string, unknown>[])[0]!
    t.cycles = [{ ...base, id: 'c1', end_reason: 'rotacao' }, { ...base, id: 'c2', end_reason: null }]
    t.variants = [{ id: 'v1', test_id: 't1', label: 'B', is_original: false, blob_url: null, blob_key: null, file_size_bytes: null, dimensions: null, title_text: null, metadata: {}, sort_order: 1, source_variant_id: null, created_at: '2026-03-01T00:00:00.000Z', thumbnail_dhash: 'abc123' }]
    o.tables.ab_tests = [t]
    sb = fakePostgrest(o)
    const x = (await youtube.getAbTest(ctxOf(), 't1')).data
    expect((x.cycles as Record<string, unknown>[]).map(c => c.end_reason)).toEqual(['rotacao', null])
    for (const v of x.variants) expect('thumbnail_dhash' in v).toBe(false)
  })

  it('leitura usa o relógio injetado: o mesmo em_andamento é "em andamento" aos 3 min e "sem resposta" aos 6', () => {
    const rs = { title: { estado: 'em_andamento', destino: 'original', em: '2026-10-12T08:00:00Z', forcado: false, escreveu: null, erro: null, attempts: 0 } }
    const linha = { ...testeCompleto(), restore_status: rs }
    const leitura = (agora: string) => (projetarTeste(linha, new Date(agora), null).leitura as { title: { tipo: string } }).title.tipo
    expect(leitura('2026-10-12T08:03:00Z')).toBe('em_andamento')
    expect(leitura('2026-10-12T08:06:00Z')).toBe('sem_resposta')
  })
})
