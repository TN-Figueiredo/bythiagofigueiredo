'use server'

import { campaignRepo } from '@/lib/cms/repositories'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

export interface CreateCampaignActionInput {
  slug: string
  interest: string
  locale: string
  title: string
  main_hook_md: string
}

export type CreateCampaignActionResult =
  | { ok: true; campaignId: string }
  | { ok: false; error: 'forbidden' | 'validation_failed' | 'db_error'; message?: string }

/**
 * Server action: create a campaign under the current site_context. Validates
 * the current user can admin the target site before inserting.
 *
 * Sprint 5b PR-C (C.8): no revalidation here — drafts are not visible in the
 * public site (sitemap filters `status='published'`). Publication status
 * changes trigger `revalidateCampaignSeo` via `publishCampaign`.
 */
export async function createCampaign(
  input: CreateCampaignActionInput,
): Promise<CreateCampaignActionResult> {
  if (!input.slug.trim() || !input.interest.trim() || !input.locale.trim() || !input.title.trim()) {
    return { ok: false, error: 'validation_failed', message: 'missing_fields' }
  }

  const ctx = await getSiteContext()

  // Guard: require authenticated user with edit access to this site
  // before touching service client (campaignRepo bypasses RLS).
  const scopeResult = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!scopeResult.ok) {
    return {
      ok: false,
      error: 'forbidden',
      message: scopeResult.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
    }
  }

  const siteIdForInsert = ctx.siteId
  if (!siteIdForInsert || siteIdForInsert.length === 0) {
    return { ok: false, error: 'forbidden', message: 'site_id missing on insert' }
  }

  try {
    const campaign = await campaignRepo().create({
      site_id: siteIdForInsert,
      interest: input.interest,
      initial_translation: {
        locale: input.locale,
        slug: input.slug,
        main_hook_md: input.main_hook_md,
        meta_title: input.title,
        context_tag: input.interest,
        success_headline: '',
        success_headline_duplicate: '',
        success_subheadline: '',
        success_subheadline_duplicate: '',
        check_mail_text: '',
        download_button_label: '',
      },
    })
    return { ok: true, campaignId: campaign.id }
  } catch (e) {
    return {
      ok: false,
      error: 'db_error',
      message: e instanceof Error ? e.message : String(e),
    }
  }
}
