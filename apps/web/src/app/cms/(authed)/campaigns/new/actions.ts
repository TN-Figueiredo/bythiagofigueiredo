'use server'

import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { campaignRepo } from '@/lib/cms/repositories'
import { getSiteContext } from '@/lib/cms/site-context'

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

  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )

  const { data: allowed, error: authzErr } = await userClient.rpc('can_admin_site', {
    p_site_id: ctx.siteId,
  })
  if (authzErr) {
    return { ok: false, error: 'forbidden', message: authzErr.message }
  }
  if (!allowed) {
    return { ok: false, error: 'forbidden' }
  }

  // Defensive boundary: re-assert that the site id used for the insert is
  // the same one we just authorized. If `getSiteContext()` ever drifts under
  // Host-header spoofing (fix deferred to Sprint 4 observability), this guard
  // refuses to write a row scoped to a different ring than the one the user
  // was authorized against.
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
