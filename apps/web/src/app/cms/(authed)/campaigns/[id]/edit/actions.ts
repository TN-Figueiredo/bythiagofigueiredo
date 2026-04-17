'use server'

import { revalidatePath } from 'next/cache'
import { isSafeUrl } from '@tn-figueiredo/cms'
import { campaignRepo } from '../../../../../../../lib/cms/repositories'
import { getSupabaseServiceClient } from '../../../../../../../lib/supabase/service'
import { requireSiteAdminForRow } from '../../../../../../../lib/cms/auth-guards'
import { captureServerActionError } from '../../../../../../lib/sentry-wrap'
import { revalidateCampaignSeo } from '@/lib/seo/cache-invalidation'

export interface SaveCampaignTranslationPatch {
  locale: string
  slug?: string
  meta_title?: string | null
  meta_description?: string | null
  og_image_url?: string | null
  main_hook_md?: string
  supporting_argument_md?: string | null
  introductory_block_md?: string | null
  body_content_md?: string | null
  form_intro_md?: string | null
  form_button_label?: string
  form_button_loading_label?: string
  context_tag?: string
  success_headline?: string
  success_headline_duplicate?: string
  success_subheadline?: string
  success_subheadline_duplicate?: string
  check_mail_text?: string
  download_button_label?: string
  extras?: unknown
}

export interface SaveCampaignPatch {
  /**
   * NOTE: `status`, `scheduled_for`, `published_at` are intentionally NOT
   * part of the save patch. Status transitions go through the dedicated
   * `publishCampaign` / `unpublishCampaign` / `archiveCampaign` actions.
   * If callers include them here they'll be filtered and a
   * `status_transition_rejected` result is returned.
   */
  interest?: string
  pdf_storage_path?: string | null
  brevo_list_id?: number | null
  brevo_template_id?: number | null
  form_fields?: unknown
}

export type SaveCampaignResult =
  | { ok: true; campaignId: string }
  | { ok: false; error: 'validation_failed'; fields: Record<string, string> }
  | { ok: false; error: 'status_transition_rejected'; message: string }
  | { ok: false; error: 'db_error'; message: string }

const STATUS_TRANSITION_KEYS = ['status', 'scheduled_for', 'published_at'] as const

/**
 * Save a campaign's scalar patch + translations in a single transaction via
 * the `update_campaign_atomic` RPC. Guarded by `requireSiteAdminForRow`.
 */
export async function saveCampaign(
  id: string,
  patch: SaveCampaignPatch,
  translations: SaveCampaignTranslationPatch[],
): Promise<SaveCampaignResult> {
  // Reject any caller that tries to sneak status/timestamp transitions through
  // the generic save path. Those must go through dedicated action helpers.
  const rawPatch = (patch ?? {}) as Record<string, unknown>
  const offending = STATUS_TRANSITION_KEYS.filter((k) => k in rawPatch)
  if (offending.length > 0) {
    return {
      ok: false,
      error: 'status_transition_rejected',
      message: `status transitions must use publish/unpublish/archive actions (got: ${offending.join(', ')})`,
    }
  }

  for (const t of translations) {
    if (!t.locale || !t.locale.trim()) {
      return { ok: false, error: 'validation_failed', fields: { locale: 'required' } }
    }
    if (t.slug !== undefined && !t.slug.trim()) {
      return { ok: false, error: 'validation_failed', fields: { slug: 'required' } }
    }
    if (!isSafeUrl(t.og_image_url ?? null)) {
      return { ok: false, error: 'validation_failed', fields: { og_image_url: 'invalid_url' } }
    }
  }

  const { siteId } = await requireSiteAdminForRow('campaigns', id)

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.rpc('update_campaign_atomic', {
    p_campaign_id: id,
    p_patch: patch ?? {},
    p_translations: translations ?? [],
  })
  if (error) {
    captureServerActionError(error, {
      action: 'save_campaign',
      campaign_id: id,
      site_id: siteId,
    })
    return { ok: false, error: 'db_error', message: error.message }
  }

  const refreshed = await campaignRepo().getById(id, siteId)
  revalidatePath('/cms/campaigns')
  if (refreshed) {
    for (const tx of refreshed.translations) {
      revalidateCampaignSeo(siteId, id, tx.locale, tx.slug)
    }
  }
  return { ok: true, campaignId: id }
}

export async function publishCampaign(id: string): Promise<void> {
  const { siteId } = await requireSiteAdminForRow('campaigns', id)
  try {
    const campaign = await campaignRepo().publish(id, siteId)
    revalidatePath('/cms/campaigns')
    for (const tx of campaign.translations) {
      revalidateCampaignSeo(siteId, id, tx.locale, tx.slug)
    }
  } catch (err) {
    captureServerActionError(err, {
      action: 'publish_campaign',
      campaign_id: id,
      site_id: siteId,
    })
    throw err
  }
}

export async function unpublishCampaign(id: string): Promise<void> {
  const { siteId } = await requireSiteAdminForRow('campaigns', id)
  const campaign = await campaignRepo().unpublish(id, siteId)
  revalidatePath('/cms/campaigns')
  for (const tx of campaign.translations) {
    revalidateCampaignSeo(siteId, id, tx.locale, tx.slug)
  }
}

export async function archiveCampaign(id: string): Promise<void> {
  const { siteId } = await requireSiteAdminForRow('campaigns', id)
  const campaign = await campaignRepo().archive(id, siteId)
  revalidatePath('/cms/campaigns')
  for (const tx of campaign.translations) {
    revalidateCampaignSeo(siteId, id, tx.locale, tx.slug)
  }
}

export type DeleteCampaignResult =
  | { ok: true }
  | { ok: false; error: 'already_published' | 'not_found' | 'db_error'; message?: string }

export async function deleteCampaign(id: string): Promise<DeleteCampaignResult> {
  const { siteId } = await requireSiteAdminForRow('campaigns', id)
  const campaign = await campaignRepo().getById(id, siteId)
  if (!campaign) return { ok: false, error: 'not_found' }
  if (campaign.status !== 'draft' && campaign.status !== 'archived') {
    return { ok: false, error: 'already_published' }
  }
  try {
    await campaignRepo().delete(id, siteId)
  } catch (e) {
    return {
      ok: false,
      error: 'db_error',
      message: e instanceof Error ? e.message : String(e),
    }
  }
  for (const tx of campaign.translations) {
    revalidateCampaignSeo(siteId, id, tx.locale, tx.slug)
  }
  revalidatePath('/cms/campaigns')
  return { ok: true }
}
