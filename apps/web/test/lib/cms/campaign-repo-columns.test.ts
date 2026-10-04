// @vitest-environment node
/**
 * campaignRepo(): getById/getBySlug do pacote cms@0.2.0 selecionavam brevo_list_id/brevo_template_id
 * (colunas removidas, 42703). A subclasse local lê só colunas reais; publish/archive/update, que
 * terminam em getById, voltam a funcionar.
 */
import { describe, it, expect, vi } from 'vitest'
import { fakePostgrest } from '../../helpers/fake-postgrest'

const CAMPAIGNS = ['id', 'site_id', 'interest', 'status', 'pdf_storage_path', 'form_fields', 'scheduled_for', 'published_at', 'created_at', 'updated_at', 'created_by', 'updated_by', 'link_group_id', 'locale', 'owner_user_id', 'social_config']
let db: ReturnType<typeof fakePostgrest>
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: (t: string) => db.client.from(t) }) }))

import { campaignRepo } from '../../../lib/cms/repositories'

describe('campaignRepo sem colunas brevo', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'c1', site_id: 'site-1', interest: 'creator', status: 'draft', pdf_storage_path: null, form_fields: [],
    scheduled_for: null, published_at: null, created_at: 'a', updated_at: 'b', created_by: null, updated_by: null,
    campaign_translations: [{ id: 't1', campaign_id: 'c1', locale: 'en', slug: 's', main_hook_md: 'h', form_button_label: 'Enviar', form_button_loading_label: '...', context_tag: 'creator', success_headline: '', success_headline_duplicate: '', success_subheadline: '', success_subheadline_duplicate: '', check_mail_text: '', download_button_label: '', created_at: 'a', updated_at: 'b' }],
    ...over,
  })

  it('getById lê e mapeia a campanha do site; outro site => null', async () => {
    db = fakePostgrest({ tables: { campaigns: [row()] }, columns: { campaigns: CAMPAIGNS } })
    const c = await campaignRepo().getById('c1', 'site-1')
    expect(c).toMatchObject({ id: 'c1', interest: 'creator', brevo_list_id: null })
    expect(c?.translations[0]).toMatchObject({ locale: 'en', slug: 's' })
    expect(await campaignRepo().getById('c1', 'site-2')).toBeNull()
  })

  it('publish termina em getById e funciona', async () => {
    db = fakePostgrest({ tables: { campaigns: [row()] }, columns: { campaigns: CAMPAIGNS } })
    const c = await campaignRepo().publish('c1', 'site-1')
    expect(c.status).toBe('published')
  })
})
