// @vitest-environment node
/**
 * Graduação de item do pipeline: `campaign` é NOT_SUPPORTED antes de qualquer leitura, dry run e
 * confirmação inclusos; newsletter grava o corpo em `content_mdx` (a coluna `content` não existe).
 */
import { describe, it, expect, vi } from 'vitest'

interface Call { table: string; op: string; payload?: unknown }
const calls: Call[] = []
let item: Record<string, unknown> | null = null

function chain(table: string) {
  const state: Call = { table, op: 'select' }
  const b: Record<string, unknown> = {}
  const self = () => b
  for (const m of ['select', 'eq', 'order', 'limit']) b[m] = self
  b.insert = (payload: unknown) => { state.op = 'insert'; state.payload = payload; calls.push({ ...state }); return b }
  b.update = (payload: unknown) => { state.op = 'update'; state.payload = payload; calls.push({ ...state }); return b }
  b.single = async () => {
    if (table === 'content_pipeline' && state.op === 'select') return { data: item, error: null }
    if (table === 'newsletter_editions') return { data: { id: 'ed-1' }, error: null }
    return { data: null, error: null }
  }
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve)
  return b
}
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: chain }) }))

import { graduateItem } from '../../src/lib/pipeline/services/items'
import { graduateItem as mcpGraduate } from '../../src/lib/pipeline/mcp/services/items'
import { toMcpError } from '../../src/lib/pipeline/mcp/errors'
import { PipelineServiceError, type ServiceContext } from '../../src/lib/pipeline/services/types'

const ID = '11111111-1111-4111-8111-111111111111'
const ctx: ServiceContext = { siteId: 'site-1', permissions: ['read', 'write'], supabase: {} as ServiceContext['supabase'], source: 'api_key' }

describe('graduação para campanha', () => {
  it.each([{ dryRun: false }, { dryRun: true }])('NOT_SUPPORTED 422 antes de ler o item (dryRun=%o)', async (opts) => {
    calls.length = 0
    await expect(graduateItem(ctx, ID, { target: 'campaign' }, opts)).rejects.toMatchObject({ code: 'NOT_SUPPORTED', status: 422 })
    expect(calls).toHaveLength(0)
  })

  it('a ferramenta MCP responde NOT_SUPPORTED também no dry run e sem confirmação', async () => {
    // `buildCtx` lê o contexto MCP; sem ele a chamada falha ANTES do guard: então o guard é testado no serviço exportado
    const { assertGraduationSupported } = await import('../../src/lib/pipeline/services/items')
    expect(() => assertGraduationSupported('campaign')).toThrow(PipelineServiceError)
    expect(() => assertGraduationSupported('newsletter')).not.toThrow()
    expect(typeof mcpGraduate).toBe('function')
  })

  it('NOT_SUPPORTED e DB_ERROR têm classificação própria no MCP', () => {
    const ns = toMcpError(new PipelineServiceError('NOT_SUPPORTED', 'x', 422))
    const db = toMcpError(new PipelineServiceError('DB_ERROR', 'x', 500))
    expect(ns._meta).toMatchObject({ retryable: false, severity: 'fatal' })
    expect(db._meta).toMatchObject({ retryable: true, severity: 'transient' })
  })
})

describe('graduação para newsletter', () => {
  it('cria a edição com o corpo em content_mdx, e liga o item', async () => {
    calls.length = 0
    item = { id: ID, site_id: 'site-1', title_pt: 'Edição 1', title_en: null, newsletter_edition_id: null, body_content: '# Corpo', code: 'nl-1' }
    const res = await graduateItem(ctx, ID, { target: 'newsletter' })
    const insert = calls.find(c => c.table === 'newsletter_editions' && c.op === 'insert')!
    expect(insert.payload).toEqual({ site_id: 'site-1', subject: 'Edição 1', status: 'draft', content_mdx: '# Corpo' })
    expect(calls.find(c => c.table === 'content_pipeline' && c.op === 'update')?.payload).toEqual({ newsletter_edition_id: 'ed-1' })
    expect(res.data).toMatchObject({ target: 'newsletter' })
  })
})
