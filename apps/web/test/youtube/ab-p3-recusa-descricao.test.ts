// @vitest-environment node
/**
 * A/B Lab P3, Tarefa 2: o pipeline (serviço = REST, e ação MCP) recusa descrição com 422
 * DESCRICAO_FORA_DO_TESTE; sem links rastreados no funil; lista fechada das variantes.
 * Os casos dos prompts (ab-ideate / ab-write) ficam em test/mcp/youtube-mcp-prompts.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { fakePostgrest, type FakePostgrestOptions } from '../helpers/fake-postgrest'

let sb = fakePostgrest({ tables: {} })
let upsertsFeitos: Array<Record<string, unknown>[]> = []
let testeGravado: Record<string, unknown> | null = null

const mcpCtx = { siteId: 'site-1', permissions: ['read', 'write'] as string[], keyHash: 'h', keyId: 'key-1' }
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => mcpCtx }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => clienteDeEscrita() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))

import * as youtube from '@/lib/pipeline/services/youtube'
import { manageAbTest } from '@/lib/pipeline/mcp/services/ab-tests'
import { DESCRICAO_FORA_DO_TESTE, pedeDescricao } from '@/lib/youtube/ab-schemas'
import { PatchPayloadSchema } from '@/lib/youtube/intelligence-schemas'
import type { ServiceContext } from '@/lib/pipeline/services/types'

const SITE = 'site-1'
const TEST_ID = '22222222-2222-4222-8222-222222222222'
const UUID = '33333333-3333-4333-8333-333333333333'
const FRASE = 'A descrição não participa mais do teste A/B'

/** Cliente falso de escrita: ab_tests.select().eq().single() e ab_test_variants.upsert().select(). */
function clienteDeEscrita() {
  return {
    from(tabela: string) {
      if (tabela === 'ab_tests') {
        const b: Record<string, unknown> = {}
        b.select = () => b
        b.eq = () => b
        b.single = async () => ({ data: testeGravado, error: testeGravado ? null : { message: 'x' } })
        return b
      }
      if (tabela === 'ab_test_variants') {
        return {
          upsert(rows: Record<string, unknown>[]) {
            upsertsFeitos.push(rows)
            return { select: async () => ({ data: rows.map((r, i) => ({ id: `v${i}`, label: r.label })), error: null }) }
          },
          select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
        }
      }
      throw new Error(`tabela inesperada: ${tabela}`)
    },
  }
}
const ctx = (): ServiceContext => ({ siteId: SITE, permissions: ['read', 'write'], supabase: clienteDeEscrita() as unknown as ServiceContext['supabase'], source: 'api_key' })
const teste = (over: Record<string, unknown>) => { upsertsFeitos = []; testeGravado = { id: TEST_ID, ...over } }
const ctxLeitura = (): ServiceContext => ({ siteId: SITE, permissions: ['read'], supabase: sb.client as unknown as ServiceContext['supabase'], source: 'api_key' })

describe('P3: a descrição não participa do teste', () => {
  it('constante', () => {
    expect(DESCRICAO_FORA_DO_TESTE).toEqual({ code: 'DESCRICAO_FORA_DO_TESTE', message: FRASE, status: 422 })
  })

  it.each([
    [{ variants: [{ label: 'B', description_text: 'x' }] }, true],
    [{ variants: [{ label: 'B', description_text: '' }] }, true],
    [{ variants: [{ label: 'B', description_text: null }] }, false],
    [{ variants: [{ label: 'B' }] }, false],
    [{ variants: [{ label: 'B', description: 'x' }] }, true],
    [{ test_type: 'description' }, true],
    [{ test_type: 'combo' }, false],
  ])('pedeDescricao(%j) = %s', (input, esperado) => expect(pedeDescricao(input)).toBe(esperado))

  it('upsertVariants com description_text "x" → 422, sem gravar', async () => {
    teste({ status: 'draft', test_type: 'title', site_id: SITE })
    await expect(youtube.upsertVariants(ctx(), TEST_ID, [{ label: 'B', title_text: 'T', description_text: 'x' }]))
      .rejects.toMatchObject({ status: 422, code: 'DESCRICAO_FORA_DO_TESTE', message: FRASE })
    expect(upsertsFeitos).toHaveLength(0)
  })

  it('texto longo (> 5000) também dá 422, não 400', async () => {
    teste({ status: 'draft', test_type: 'title', site_id: SITE })
    await expect(youtube.upsertVariants(ctx(), TEST_ID, [{ label: 'B', title_text: 'T', description_text: 'x'.repeat(6000) }]))
      .rejects.toMatchObject({ status: 422 })
  })

  it('upsertVariants com description_text null → aceito; a linha gravada não tem description_text', async () => {
    teste({ status: 'draft', test_type: 'title', site_id: SITE })
    await youtube.upsertVariants(ctx(), TEST_ID, [{ label: 'B', title_text: 'T', description_text: null }])
    expect(upsertsFeitos[0]![0]).not.toHaveProperty('description_text')
  })

  it('teste gravado como description → 422 (não 400 "Unknown test type")', async () => {
    teste({ status: 'draft', test_type: 'description', site_id: SITE })
    await expect(youtube.upsertVariants(ctx(), TEST_ID, [{ label: 'B', title_text: 'T' }])).rejects.toMatchObject({ status: 422 })
  })

  it('teste gravado com tipo desconhecido → 400 VALIDATION_ERROR', async () => {
    teste({ status: 'draft', test_type: 'xyz', site_id: SITE })
    await expect(youtube.upsertVariants(ctx(), TEST_ID, [{ label: 'B', title_text: 'T' }]))
      .rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
  })

  it('MCP upsert_variants com dry_run padrão e description_text → erro DESCRICAO_FORA_DO_TESTE', async () => {
    teste({ status: 'draft', test_type: 'title', site_id: SITE })
    const r = await manageAbTest({ action: 'upsert_variants', test_id: TEST_ID, variants: [{ label: 'B', description_text: 'x' }] })
    expect(r.isError).toBe(true)
    const corpo = JSON.parse((r.content[0] as { text: string }).text)
    expect(corpo).toMatchObject({ code: 'DESCRICAO_FORA_DO_TESTE', message: FRASE })
    expect(corpo.retryable).toBe(false)
    expect(corpo.recovery_action).toContain('Remove description_text')
  })

  it('MCP upsert_variants dry_run:false → mesmo code e mesma mensagem que o REST', async () => {
    teste({ status: 'draft', test_type: 'title', site_id: SITE })
    const r = await manageAbTest({ action: 'upsert_variants', test_id: TEST_ID, dry_run: false, variants: [{ label: 'B', title_text: 'T', description_text: 'x' }] })
    expect(r.isError).toBe(true)
    expect(JSON.parse((r.content[0] as { text: string }).text)).toMatchObject({ code: 'DESCRICAO_FORA_DO_TESTE', message: FRASE })
    expect(upsertsFeitos).toHaveLength(0)
  })

  it('MCP dry_run (padrão) com description null: proposed_variants não leva description_text', async () => {
    teste({ status: 'draft', test_type: 'title', site_id: SITE })
    const r = await manageAbTest({ action: 'upsert_variants', test_id: TEST_ID, variants: [{ label: 'B', title_text: 'T', description_text: null }] })
    const corpo = JSON.parse((r.content[0] as { text: string }).text)
    expect(corpo.proposed_variants[0]).not.toHaveProperty('description_text')
  })

  const TODAS = {
    id: 'v1', test_id: 't1', label: 'B', is_original: false, blob_url: null, blob_key: 'k', file_size_bytes: 10, dimensions: '1x1',
    title_text: 'T', description_text: 'segredo', metadata: {}, sort_order: 1, source_variant_id: 'v0', created_at: '2026-03-01T00:00:00.000Z',
  }
  const COLS_VAR = [...Object.keys(TODAS)]
  const COLS_TESTE = ['id', 'site_id', 'status', 'test_type', 'name', 'original_description', 'original_title', 'created_at', 'result_metadata']
  const mundo = (): FakePostgrestOptions => ({
    tables: {
      sites: [{ id: SITE }],
      ab_tests: [{
        id: 't1', site_id: SITE, status: 'draft', test_type: 'title', name: 'n', original_description: 'desc antiga', original_title: 'T', created_at: '2026-03-01T00:00:00.000Z', result_metadata: {},
        variants: [{ ...TODAS }], cycles: [], tracked_links: [{ id: 'tl1', link_id: 'l1' }],
      }],
      ab_test_variants: [{ ...TODAS }],
    },
    columns: { ab_tests: COLS_TESTE, ab_test_variants: COLS_VAR },
  })

  it('listVariants, getAbTest e listAbTests não entregam description_text nem original_description, e entregam source_variant_id', async () => {
    const o = mundo()
    o.tables.ab_tests![0]!.id = TEST_ID
    o.tables.ab_test_variants![0]!.test_id = TEST_ID
    ;(o.tables.ab_tests![0]!.variants as Record<string, unknown>[])[0]!.test_id = TEST_ID
    sb = fakePostgrest(o)
    const lv = (await youtube.listVariants(ctxLeitura(), TEST_ID)).data as unknown as Record<string, unknown>[]
    expect(lv[0]).not.toHaveProperty('description_text')
    expect(lv[0]).toHaveProperty('source_variant_id', 'v0')
    expect(Object.keys(lv[0]!).sort()).toEqual(['blob_key', 'blob_url', 'created_at', 'dimensions', 'file_size_bytes', 'id', 'is_original', 'label', 'metadata', 'sort_order', 'source_variant_id', 'test_id', 'title_text'])

    const detail = (await youtube.getAbTest(ctxLeitura(), TEST_ID)).data as unknown as Record<string, unknown>
    expect(detail).not.toHaveProperty('original_description')
    const dv = (detail.variants as Record<string, unknown>[])[0]!
    expect(dv).not.toHaveProperty('description_text')
    expect(dv).toHaveProperty('source_variant_id', 'v0')

    const lista = (await youtube.listAbTests(ctxLeitura(), {})).data as unknown as Record<string, unknown>[]
    expect(lista[0]).not.toHaveProperty('original_description')
    const lvv = (lista[0]!.variants as Record<string, unknown>[])[0]!
    expect(lvv).not.toHaveProperty('description_text')
    expect(lvv).toHaveProperty('source_variant_id', 'v0')
  })

  it('getAbTest entrega tracked_links: []', async () => {
    const o = mundo()
    o.tables.ab_tests![0]!.id = TEST_ID
    sb = fakePostgrest(o)
    const detail = (await youtube.getAbTest(ctxLeitura(), TEST_ID)).data
    expect(detail.tracked_links).toEqual([])
  })

  it('getAbTestFunnel entrega link_clicks null, per_link [] e link_clicks_window null', async () => {
    sb = fakePostgrest({
      tables: {
        sites: [{ id: SITE }],
        ab_tests: [{ id: 't1', site_id: SITE, started_at: '2026-03-01T00:00:00.000Z', completed_at: null }],
        ab_test_cycles: [{ test_id: 't1', variant_id: 'v1', impressions: 150, clicks: 15, started_at: '2026-03-01T00:00:00.000Z' }],
      },
      columns: { ab_tests: ['id', 'site_id', 'started_at', 'completed_at'], ab_test_cycles: ['test_id', 'variant_id', 'impressions', 'clicks', 'started_at'] },
      fail: q => { if (q.table === 'link_clicks' || q.table === 'tracked_links') throw new Error(`leu ${q.table}`); return null },
    })
    const { data } = await youtube.getAbTestFunnel(ctxLeitura(), 't1')
    expect(data.per_variant).toEqual([{ variant_id: 'v1', impressions: null, clicks: null, link_clicks: null }])
    expect(data.per_link).toEqual([])
    expect(data.link_clicks_window).toBeNull()
  })

  it('PATCH de inteligência com action_type description_test → 400 com a frase', () => {
    const r = PatchPayloadSchema.safeParse({ task_id: UUID, video_recommendations: [{ video_id: UUID, action_type: 'description_test', priority: 'low', confidence: 0.5, reasoning: 'r' }] })
    expect(r.success).toBe(false)
    expect(JSON.stringify(r.error!.issues)).toContain('a descrição não participa mais do teste A/B')
  })
})
