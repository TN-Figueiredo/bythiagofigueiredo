// @vitest-environment node
/**
 * "Nova campanha" do CMS: o guard de permissão roda ANTES do service client, e a criação grava
 * campanha + tradução só com colunas reais (o create do pacote escrevia colunas brevo removidas).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakePostgrest } from '../../helpers/fake-postgrest'

const CAMPAIGNS = ['created_at', 'created_by', 'form_fields', 'id', 'interest', 'link_group_id', 'locale', 'owner_user_id', 'pdf_storage_path', 'published_at', 'scheduled_for', 'site_id', 'social_config', 'status', 'updated_at', 'updated_by']
const TRANSLATIONS = ['body_content_md', 'campaign_id', 'check_mail_text', 'context_tag', 'created_at', 'download_button_label', 'extras', 'form_button_label', 'form_button_loading_label', 'form_intro_md', 'id', 'introductory_block_md', 'locale', 'main_hook_md', 'meta_description', 'meta_title', 'og_image_url', 'slug', 'success_headline', 'success_headline_duplicate', 'success_subheadline', 'success_subheadline_duplicate', 'supporting_argument_md', 'updated_at']

let db: ReturnType<typeof fakePostgrest>
let tables: Record<string, Record<string, unknown>[]>
const serviceClient = vi.fn(() => ({ from: (t: string) => db.client.from(t) }))
const scope = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => serviceClient() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => scope(...a) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { createCampaign } from '../../../src/app/cms/(authed)/campaigns/new/actions'

const input = { slug: 'oferta', interest: 'creator', locale: 'pt-BR', title: 'Oferta', main_hook_md: 'Gancho' }

beforeEach(() => {
  serviceClient.mockClear()
  scope.mockReset().mockResolvedValue({ ok: true })
  tables = { campaigns: [], campaign_translations: [] }
  db = fakePostgrest({ tables, columns: { campaigns: CAMPAIGNS, campaign_translations: TRANSLATIONS }, idFor: (t, n) => `${t}-${n}`, cascade: { campaigns: [{ table: 'campaign_translations', column: 'campaign_id' }] } })
})

describe('createCampaign (CMS)', () => {
  it('cria rascunho + tradução com colunas reais', async () => {
    const res = await createCampaign(input)
    expect(res).toEqual({ ok: true, campaignId: 'campaigns-1' })
    expect(tables.campaigns[0]).toMatchObject({ site_id: 'site-1', interest: 'creator', status: 'draft' })
    expect(tables.campaign_translations[0]).toMatchObject({ campaign_id: 'campaigns-1', locale: 'pt-BR', slug: 'oferta', meta_title: 'Oferta', main_hook_md: 'Gancho', context_tag: 'creator', success_headline: '', download_button_label: '' })
    expect(Object.keys(tables.campaigns[0]!)).not.toContain('brevo_list_id')
  })

  it('sem permissão: forbidden e o service client nem é criado', async () => {
    scope.mockResolvedValue({ ok: false, reason: 'forbidden' })
    const res = await createCampaign(input)
    expect(res).toMatchObject({ ok: false, error: 'forbidden' })
    expect(serviceClient).not.toHaveBeenCalled()
    expect(tables.campaigns).toHaveLength(0)
  })

  it('interest fora do vocabulário: validation_failed antes de qualquer escrita', async () => {
    expect(await createCampaign({ ...input, interest: 'banana' })).toMatchObject({ ok: false, error: 'validation_failed' })
    expect(tables.campaigns).toHaveLength(0)
  })

  it('slug repetido (23505 do trigger na tradução): duplicate_slug e a campanha é desfeita', async () => {
    db = fakePostgrest({ tables, columns: { campaigns: CAMPAIGNS, campaign_translations: TRANSLATIONS }, idFor: (t, n) => `${t}-${n}`, fail: q => (q.table === 'campaign_translations' && q.op === 'insert' ? { code: '23505', message: 'dup' } : null) })
    expect(await createCampaign(input)).toMatchObject({ ok: false, error: 'validation_failed', message: 'duplicate_slug' })
    expect(tables.campaigns).toHaveLength(0)
  })
})
