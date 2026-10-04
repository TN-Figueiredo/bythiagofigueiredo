import type { Campaign } from '@tn-figueiredo/cms'
import {
  SupabasePostRepository,
  SupabaseCampaignRepository,
  SupabaseRingContext,
} from '@tn-figueiredo/cms'
import { getSupabaseServiceClient } from '../supabase/service'

export function postRepo() {
  return new SupabasePostRepository(getSupabaseServiceClient())
}

/**
 * cms@0.2.0 `getById`/`getBySlug` selecionam `brevo_list_id`/`brevo_template_id`, colunas que não
 * existem mais em `campaigns` (42703): a tela de edição, publish, unpublish, archive, schedule e
 * update (que terminam em `getById`) falhavam. Aqui `getById`/`getBySlug` leem só colunas reais e
 * reusam o mapeamento do pacote (os campos brevo saem null). `create` do pacote também escrevia
 * brevo: criar campanha usa `insertCampaignDraft` (services/campaign-graduation).
 */
const CAMPAIGN_COLUMNS = `id, site_id, interest, status, pdf_storage_path, form_fields,
  scheduled_for, published_at, created_at, updated_at, created_by, updated_by,
  campaign_translations(*)`

class SchemaAlignedCampaignRepository extends SupabaseCampaignRepository {
  private readonly db = getSupabaseServiceClient()

  override async getById(id: string, siteId: string): Promise<Campaign | null> {
    const { data, error } = await this.db
      .from('campaigns')
      .select(CAMPAIGN_COLUMNS)
      .eq('id', id)
      .eq('site_id', siteId)
      .maybeSingle()
    if (error) throw error
    return data ? this['mapCampaign'](data) : null
  }

  override async getBySlug(opts: { siteId: string; locale: string; slug: string }): Promise<Campaign | null> {
    const { data, error } = await this.db
      .from('campaigns')
      .select(CAMPAIGN_COLUMNS.replace('campaign_translations(*)', 'campaign_translations!inner(*)'))
      .eq('site_id', opts.siteId)
      .eq('campaign_translations.locale', opts.locale)
      .eq('campaign_translations.slug', opts.slug)
      .maybeSingle()
    if (error) throw error
    return data ? this['mapCampaign'](data) : null
  }
}

export function campaignRepo() {
  return new SchemaAlignedCampaignRepository(getSupabaseServiceClient())
}

export function ringContext() {
  return new SupabaseRingContext(getSupabaseServiceClient())
}

/**
 * Translation row returned by `getCampaignBySlug`. Mirrors the columns the OG
 * route + page-metadata factory consume from `campaign_translations`.
 */
export interface CampaignTranslationLite {
  locale: string
  slug: string
  meta_title: string | null
  meta_description: string | null
  og_image_url: string | null
}

export interface CampaignWithTranslation {
  id: string
  translation: CampaignTranslationLite
}

/**
 * Slug-based campaign lookup. Sprint 5b — `@tn-figueiredo/cms`
 * `SupabaseCampaignRepository` exposes `getById/list/create/update/publish/...`
 * but NOT `getBySlug`, and the `/og/campaigns/[locale]/[slug]` route needs
 * slug→campaign resolution. Mirrors the public-read RLS shape (status='published' AND published_at <= now()
 * + locale + slug match) even though it runs under the service-role client.
 */
export async function getCampaignBySlug(input: {
  siteId: string
  locale: string
  slug: string
}): Promise<CampaignWithTranslation | null> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select(
      `id, site_id, status, published_at,
       campaign_translations!inner(locale, slug, meta_title, meta_description, og_image_url)`,
    )
    .eq('site_id', input.siteId)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .eq('campaign_translations.locale', input.locale)
    .eq('campaign_translations.slug', input.slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as { id: string; campaign_translations?: CampaignTranslationLite[] }
  const tx = row.campaign_translations?.[0]
  if (!tx) return null
  return { id: row.id, translation: tx }
}
