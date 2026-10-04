// @vitest-environment node
/**
 * Graduação de item para CAMPANHA: cria um rascunho válido (campanha + tradução), liga o item.
 * Banco: fakePostgrest com as colunas reais de cada tabela, então coluna inexistente (o bug
 * original: `campaigns.name`/`slug`) falha como no PostgREST.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakePostgrest, type FakeError, type FakeQuery } from '../../helpers/fake-postgrest'

const CAMPAIGNS = ['created_at', 'created_by', 'form_fields', 'id', 'interest', 'link_group_id', 'locale', 'owner_user_id', 'pdf_storage_path', 'published_at', 'scheduled_for', 'site_id', 'social_config', 'status', 'updated_at', 'updated_by']
const TRANSLATIONS = ['body_content_md', 'campaign_id', 'check_mail_text', 'context_tag', 'created_at', 'download_button_label', 'extras', 'form_button_label', 'form_button_loading_label', 'form_intro_md', 'id', 'introductory_block_md', 'locale', 'main_hook_md', 'meta_description', 'meta_title', 'og_image_url', 'slug', 'success_headline', 'success_headline_duplicate', 'success_subheadline', 'success_subheadline_duplicate', 'supporting_argument_md', 'updated_at']
const PIPELINE = ['id', 'site_id', 'code', 'title_pt', 'title_en', 'language', 'hook', 'synopsis', 'body_content', 'cover_image_url', 'campaign_id', 'blog_post_id', 'newsletter_edition_id', 'format_metadata', 'created_by']
const HISTORY = ['id', 'pipeline_id', 'event_type', 'from_value', 'to_value', 'changed_by', 'changed_by_key_id', 'changed_at']

const ID = '11111111-1111-4111-8111-111111111111'
type Row = Record<string, unknown>

function pipelineItem(over: Row = {}): Row {
  return {
    id: ID, site_id: 'site-1', code: 'CMP-1', title_pt: 'Guia de Edição Rápida', title_en: 'Quick Edit Guide',
    language: 'pt-br', hook: 'Edite em metade do tempo', synopsis: 'Um guia curto', body_content: '# Corpo',
    cover_image_url: 'https://cdn/cover.png', campaign_id: null, blog_post_id: null, newsletter_edition_id: null,
    format_metadata: {}, created_by: null, ...over,
  }
}

let db: ReturnType<typeof fakePostgrest>
let tables: Record<string, Row[]>
const mockClient = { from: (t: string) => db.client.from(t) }
const sentry = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => mockClient }))

import { graduateItem } from '../../../src/lib/pipeline/services/items'
import { PipelineServiceError, type ServiceContext } from '../../../src/lib/pipeline/services/types'

const ctx: ServiceContext = { siteId: 'site-1', permissions: ['read', 'write'], supabase: {} as ServiceContext['supabase'], source: 'api_key', keyId: 'key-1' }

function setup(items: Row[] = [pipelineItem()], extra: Partial<Record<string, Row[]>> = {}, fail?: (q: FakeQuery) => FakeError | null) {
  tables = {
    content_pipeline: items,
    campaigns: [],
    campaign_translations: [],
    content_pipeline_history: [],
    ...(extra as Record<string, Row[]>),
  }
  db = fakePostgrest({
    tables,
    columns: { campaigns: CAMPAIGNS, campaign_translations: TRANSLATIONS, content_pipeline: PIPELINE, content_pipeline_history: HISTORY },
    idFor: (t, n) => `${t}-${n}`,
    cascade: { campaigns: [{ table: 'campaign_translations', column: 'campaign_id' }] },
    fail,
  })
}

const OPTS = { interest: 'creator' }

beforeEach(() => { sentry.captureException.mockClear(); setup() })

describe('graduação para campanha: caminho feliz', () => {
  it('cria rascunho + tradução com os campos certos e liga o item', async () => {
    const res = await graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS })

    expect(tables.campaigns).toHaveLength(1)
    expect(tables.campaigns[0]).toMatchObject({ site_id: 'site-1', interest: 'creator', status: 'draft', locale: 'pt-BR', form_fields: [] })
    expect(tables.campaigns[0]).not.toHaveProperty('published_at')
    const tx = tables.campaign_translations[0]!
    expect(tx).toMatchObject({
      campaign_id: tables.campaigns[0]!.id,
      locale: 'pt-BR',
      slug: 'guia-de-edicao-rapida',
      meta_title: 'Guia de Edição Rápida',
      main_hook_md: 'Edite em metade do tempo',
      meta_description: 'Um guia curto',
      og_image_url: 'https://cdn/cover.png',
      body_content_md: '# Corpo',
      context_tag: 'creator',
      success_headline: '', success_headline_duplicate: '', success_subheadline: '',
      success_subheadline_duplicate: '', check_mail_text: '', download_button_label: '',
    })
    expect(tables.content_pipeline[0]!.campaign_id).toBe(tables.campaigns[0]!.id)
    expect(tables.content_pipeline_history[0]).toMatchObject({ pipeline_id: ID, event_type: 'graduated', to_value: `campaign:${tables.campaigns[0]!.id}`, changed_by_key_id: 'key-1' })
    expect(res.data).toMatchObject({ graduated: true, target: 'campaign', entity_id: tables.campaigns[0]!.id, status: 'draft', slug: 'guia-de-edicao-rapida' })
  })

  it('item em inglês usa título EN e locale en; opções sobrescrevem os defaults', async () => {
    setup([pipelineItem({ language: 'en' })])
    await graduateItem(ctx, ID, { target: 'campaign', campaign: { ...OPTS, slug: 'quick', context_tag: 'tag', check_mail_text: 'Check', form_button_label: 'Go' } })
    expect(tables.campaign_translations[0]).toMatchObject({ locale: 'en', slug: 'quick', meta_title: 'Quick Edit Guide', context_tag: 'tag', check_mail_text: 'Check', form_button_label: 'Go' })
  })

  it('sem hook no item: usa a sinopse; sem as duas, exige main_hook_md', async () => {
    setup([pipelineItem({ hook: null })])
    await graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS })
    expect(tables.campaign_translations[0]!.main_hook_md).toBe('Um guia curto')
  })
})

describe('dry run', () => {
  it('não grava nada e devolve o que seria criado', async () => {
    const res = await graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS }, { dryRun: true })
    expect(tables.campaigns).toHaveLength(0)
    expect(tables.campaign_translations).toHaveLength(0)
    expect(tables.content_pipeline[0]!.campaign_id).toBeNull()
    expect(db.queries.filter(q => q.op && q.op !== 'select')).toHaveLength(0)
    expect(res.data).toMatchObject({ graduated: true, dry_run: true, entity_id: null })
    expect(res.data.would_create).toMatchObject({
      campaign: { site_id: 'site-1', interest: 'creator', status: 'draft' },
      translation: { slug: 'guia-de-edicao-rapida', main_hook_md: 'Edite em metade do tempo' },
    })
  })
})

describe('campos obrigatórios ausentes', () => {
  it.each([{ dryRun: false }, { dryRun: true }])('422 VALIDATION_ERROR nomeando interest (dryRun=%o)', async (o) => {
    const err = await graduateItem(ctx, ID, { target: 'campaign' }, o).catch(e => e)
    expect(err).toBeInstanceOf(PipelineServiceError)
    expect(err).toMatchObject({ code: 'VALIDATION_ERROR', status: 422, details: { missing_fields: ['interest'] } })
    expect(err.message).toContain('interest')
    expect(tables.campaigns).toHaveLength(0)
  })

  it.each([{ dryRun: false }, { dryRun: true }])('sem hook nem sinopse: lista main_hook_md também (dryRun=%o)', async (o) => {
    setup([pipelineItem({ hook: null, synopsis: null })])
    const err = await graduateItem(ctx, ID, { target: 'campaign' }, o).catch(e => e)
    expect(err).toMatchObject({ code: 'VALIDATION_ERROR', status: 422, details: { missing_fields: ['interest', 'main_hook_md'] } })
  })

  it('interest fora do vocabulário é recusado pelo schema (400)', async () => {
    await expect(graduateItem(ctx, ID, { target: 'campaign', campaign: { interest: 'banana' } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
  })
})

describe('isolamento e idempotência', () => {
  it('item de outro site: 404 e nada criado', async () => {
    setup([pipelineItem({ site_id: 'site-2' })])
    await expect(graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS })).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
    expect(tables.campaigns).toHaveLength(0)
  })

  it('item já graduado para campanha: mesma resposta dos outros destinos (409)', async () => {
    setup([pipelineItem({ campaign_id: 'camp-9' })])
    await expect(graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS })).rejects.toMatchObject({ code: 'INVALID_OPERATION', status: 409, message: 'Already graduated to campaign' })
    expect(tables.campaigns).toHaveLength(0)
  })

  it('segunda chamada seguida da primeira bem-sucedida é recusada, sem segunda campanha', async () => {
    await graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS })
    await expect(graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS })).rejects.toMatchObject({ status: 409 })
    expect(tables.campaigns).toHaveLength(1)
  })
})

describe('atomicidade e erros de banco', () => {
  it('falha ao gravar a tradução desfaz a campanha', async () => {
    setup([pipelineItem()], {}, q => (q.table === 'campaign_translations' && q.op === 'insert' ? { code: 'XX000', message: 'boom: internal pg detail' } : null))
    const err = await graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS }).catch(e => e)
    expect(err).toMatchObject({ code: 'DB_ERROR', status: 500 })
    expect(err.message).not.toContain('boom')
    expect(tables.campaigns).toHaveLength(0)
    expect(tables.content_pipeline[0]!.campaign_id).toBeNull()
  })

  it('falha ao ligar o item desfaz campanha e tradução', async () => {
    setup([pipelineItem()], {}, q => (q.table === 'content_pipeline' && q.op === 'update' && (q.payload as Row).campaign_id ? { message: 'pg secret' } : null))
    const err = await graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS }).catch(e => e)
    expect(err).toMatchObject({ code: 'DB_ERROR' })
    expect(err.message).not.toContain('pg secret')
    expect(tables.campaigns).toHaveLength(0)
    expect(tables.campaign_translations).toHaveLength(0)
  })

  it('falha no histórico desfaz tudo e desliga o item', async () => {
    setup([pipelineItem()], {}, q => (q.table === 'content_pipeline_history' ? { message: 'pg secret' } : null))
    await expect(graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS })).rejects.toMatchObject({ code: 'DB_ERROR' })
    expect(tables.campaigns).toHaveLength(0)
    expect(tables.content_pipeline[0]!.campaign_id).toBeNull()
  })

  it('falha ao criar a campanha propaga como DB_ERROR sem o texto do Postgres', async () => {
    setup([pipelineItem()], {}, q => (q.table === 'campaigns' && q.op === 'insert' ? { message: 'pg secret' } : null))
    const err = await graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS }).catch(e => e)
    expect(err).toMatchObject({ code: 'DB_ERROR', status: 500 })
    expect(err.message).not.toContain('secret')
  })

  it('erro ao checar o slug propaga (não vira "livre")', async () => {
    setup([pipelineItem()], {}, q => (q.table === 'campaign_translations' && q.op !== 'insert' ? { message: 'pg secret' } : null))
    await expect(graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS }, { dryRun: true })).rejects.toMatchObject({ code: 'DB_ERROR' })
  })
})

describe('colisão de slug', () => {
  // tradução com o slug + a campanha dona dela (a checagem lê as duas tabelas; o site vem de campaigns)
  const taken = (siteId: string, locale = 'pt-BR'): Partial<Record<string, Row[]>> => ({
    campaigns: [{ id: 'c-old', site_id: siteId }],
    campaign_translations: [{ id: 't-1', campaign_id: 'c-old', locale, slug: 'guia-de-edicao-rapida' }],
  })

  it.each([{ dryRun: false }, { dryRun: true }])('mesmo slug/locale/site: 409 CONFLICT, nada criado (dryRun=%o)', async (o) => {
    setup([pipelineItem()], taken('site-1'))
    await expect(graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS }, o)).rejects.toMatchObject({ code: 'CONFLICT', status: 409 })
    expect(tables.campaigns).toHaveLength(1) // só a antiga
  })

  it('o mesmo slug em OUTRO SITE não colide (isolamento de site)', async () => {
    setup([pipelineItem()], taken('site-2'))
    await graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS })
    expect(tables.campaigns).toHaveLength(2)
    expect(db.on('campaigns').some(q => q.filters.some(f => f.op === 'eq' && f.col === 'site_id' && f.value === 'site-1'))).toBe(true)
  })

  it('o mesmo slug em outro locale não colide', async () => {
    setup([pipelineItem()], taken('site-1', 'en'))
    await graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS })
    expect(tables.campaigns).toHaveLength(2)
  })

  it('colisão detectada só pelo trigger (23505) vira CONFLICT e desfaz a campanha', async () => {
    setup([pipelineItem()], {}, q => (q.table === 'campaign_translations' && q.op === 'insert' ? { code: '23505', message: 'duplicate slug' } : null))
    await expect(graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS })).rejects.toMatchObject({ code: 'CONFLICT', status: 409 })
    expect(tables.campaigns).toHaveLength(0)
  })
})

describe('rollback', () => {
  it('o delete da campanha é filtrado por id E site_id', async () => {
    setup([pipelineItem()], {}, q => (q.table === 'content_pipeline_history' ? { message: 'x' } : null))
    await graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS }).catch(() => null)
    const del = db.queries.find(q => q.table === 'campaigns' && q.op === 'delete')!
    expect(del.filters.map(f => f.col).sort()).toEqual(['id', 'site_id'])
    expect(del.filters.find(f => f.col === 'site_id')!.value).toBe('site-1')
  })

  it('rollback que falha: erro original ao cliente + Sentry com o id da campanha órfã', async () => {
    setup([pipelineItem()], {}, q => {
      if (q.table === 'content_pipeline_history') return { message: 'history down' }
      if (q.table === 'campaigns' && q.op === 'delete') return { code: 'XX000', message: 'delete down' }
      return null
    })
    const err = await graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS }).catch(e => e)
    expect(err).toMatchObject({ code: 'DB_ERROR', message: 'Failed to record the graduation history' })
    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    expect(sentry.captureException.mock.calls[0]![1]).toMatchObject({ extra: { campaign_id: 'campaigns-1', site_id: 'site-1' } })
  })

  it('unlink que falha no rollback também vai ao Sentry', async () => {
    setup([pipelineItem()], {}, q => {
      if (q.table === 'content_pipeline_history') return { message: 'history down' }
      if (q.table === 'content_pipeline' && q.op === 'update' && (q.payload as Row).campaign_id === null) return { message: 'unlink down' }
      return null
    })
    await graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS }).catch(() => null)
    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    expect(sentry.captureException.mock.calls[0]![1]).toMatchObject({ extra: { item_id: ID } })
  })
})

describe('corrida na ligação do item', () => {
  it('se outro pedido ligou o item no meio: 409, campanha nova desfeita, vínculo do vencedor intacto', async () => {
    let first = true
    setup([pipelineItem()], {}, q => {
      // o vencedor liga o item logo antes do nosso update
      if (first && q.table === 'content_pipeline' && q.op === 'update') {
        first = false
        tables.content_pipeline[0]!.campaign_id = 'winner'
      }
      return null
    })
    await expect(graduateItem(ctx, ID, { target: 'campaign', campaign: OPTS })).rejects.toMatchObject({ code: 'INVALID_OPERATION', status: 409 })
    expect(tables.campaigns).toHaveLength(0)
    expect(tables.content_pipeline[0]!.campaign_id).toBe('winner')
    expect(tables.content_pipeline_history).toHaveLength(0)
  })
})

describe('limites das opções', () => {
  it('texto acima do limite é recusado (400)', async () => {
    await expect(graduateItem(ctx, ID, { target: 'campaign', campaign: { ...OPTS, success_headline: 'x'.repeat(201) } })).rejects.toMatchObject({ status: 400 })
    await expect(graduateItem(ctx, ID, { target: 'campaign', campaign: { ...OPTS, main_hook_md: 'x'.repeat(10001) } })).rejects.toMatchObject({ status: 400 })
    await expect(graduateItem(ctx, ID, { target: 'campaign', campaign: { ...OPTS, meta_description: 'x'.repeat(301) } })).rejects.toMatchObject({ status: 400 })
  })
})

import { truncateAtWord } from '@/lib/pipeline/services/campaign-graduation'
describe('truncateAtWord (meta_description herdada da sinopse)', () => {
  it('não deixa meio emoji na fronteira do corte', () => {
    const out = truncateAtWord('a'.repeat(298) + '😀😀 resto', 300)
    expect(out.endsWith('…')).toBe(true)
    expect(/[\ud800-\udbff](?![\udc00-\udfff])/.test(out)).toBe(false)
  })
  it('texto curto passa intacto, sem reticências', () => { expect(truncateAtWord('Curto e bom', 300)).toBe('Curto e bom') })
  it('corta em limite de palavra até 300 caracteres e termina em …', () => {
    const out = truncateAtWord('palavra '.repeat(80), 300)
    expect(out.length).toBeLessThanOrEqual(300)
    expect(out.endsWith('palavra…')).toBe(true)
  })
})
