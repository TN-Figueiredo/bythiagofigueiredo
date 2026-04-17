import {
  SupabasePostRepository,
  SupabaseCampaignRepository,
  SupabaseRingContext,
} from '@tn-figueiredo/cms'
import { getSupabaseServiceClient } from '../supabase/service'

export function postRepo() {
  return new SupabasePostRepository(getSupabaseServiceClient())
}

export function campaignRepo() {
  return new SupabaseCampaignRepository(getSupabaseServiceClient())
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
 * slug→campaign resolution. Mirrors the public-read RLS shape (status='active'
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
      `id, site_id, status,
       campaign_translations!inner(locale, slug, meta_title, meta_description, og_image_url)`,
    )
    .eq('site_id', input.siteId)
    .eq('status', 'active')
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
