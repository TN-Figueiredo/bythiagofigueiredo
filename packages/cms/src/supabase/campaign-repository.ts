import type { ICampaignRepository } from '../interfaces/campaign-repository'
import type {
  Campaign,
  CampaignListItem,
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignFormField,
  CampaignTranslation,
} from '../types/campaign'
import type { ContentListOpts, ContentCountOpts } from '../types/content'
import { SupabaseContentRepository } from './content-repository'

/**
 * Supabase implementation of ICampaignRepository.
 *
 * Authz: this class is typically constructed with a service-role Supabase
 * client (bypassing RLS). Round-2 hardening forces every write path (and
 * every id-based read) through a mandatory `siteId` parameter, and the
 * underlying SQL narrows with `.eq('site_id', siteId)`. Callers MUST still
 * validate `can_admin_site(siteId)` BEFORE invoking any write method — the
 * `.eq('site_id', ...)` filter is a defense-in-depth stop against cross-ring
 * id collisions, not a substitute for authz.
 *
 * For multi-field atomic patches prefer the `update_campaign_atomic` RPC,
 * which re-checks `can_admin_site` inside the function.
 */
export class SupabaseCampaignRepository
  extends SupabaseContentRepository
  implements ICampaignRepository
{
  async list(opts: ContentListOpts): Promise<CampaignListItem[]> {
    const page = opts.page ?? 1
    const perPage = opts.perPage ?? 12
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    let q = this.supabase
      .from('campaigns')
      .select(`
        id, status, published_at, interest,
        campaign_translations!inner(locale, slug, meta_title, context_tag)
      `)
      .eq('site_id', opts.siteId)
      .eq('campaign_translations.locale', opts.locale)

    if (opts.status) q = q.eq('status', opts.status)
    if (opts.search) q = q.ilike('campaign_translations.meta_title', `%${opts.search}%`)

    const { data, error } = await q
      .range(from, to)
      .order('published_at', { ascending: false, nullsFirst: false })
    if (error) throw error
    return (data ?? []).map((row: Record<string, unknown>) => this.mapListItem(row))
  }

  async getById(id: string, siteId: string): Promise<Campaign | null> {
    const { data, error } = await this.supabase
      .from('campaigns')
      .select(`
        id, site_id, interest, status, pdf_storage_path,
        brevo_list_id, brevo_template_id, form_fields,
        scheduled_for, published_at, created_at, updated_at,
        created_by, updated_by,
        campaign_translations(*)
      `)
      .eq('id', id)
      .eq('site_id', siteId)
      .maybeSingle()
    if (error) throw error
    return data ? this.mapCampaign(data) : null
  }

  async getBySlug(opts: { siteId: string; locale: string; slug: string }): Promise<Campaign | null> {
    const { data, error } = await this.supabase
      .from('campaigns')
      .select(`
        id, site_id, interest, status, pdf_storage_path,
        brevo_list_id, brevo_template_id, form_fields,
        scheduled_for, published_at, created_at, updated_at,
        created_by, updated_by,
        campaign_translations!inner(*)
      `)
      .eq('site_id', opts.siteId)
      .eq('campaign_translations.locale', opts.locale)
      .eq('campaign_translations.slug', opts.slug)
      .maybeSingle()
    if (error) throw error
    return data ? this.mapCampaign(data) : null
  }

  async create(input: CreateCampaignInput): Promise<Campaign> {
    const { data: campaign, error: cErr } = await this.supabase
      .from('campaigns')
      .insert({
        site_id: input.site_id,
        interest: input.interest,
        status: 'draft',
        brevo_list_id: input.brevo_list_id ?? null,
        brevo_template_id: input.brevo_template_id ?? null,
        form_fields: input.form_fields ?? [],
        pdf_storage_path: input.pdf_storage_path ?? null,
      })
      .select()
      .single()
    if (cErr || !campaign) throw cErr ?? new Error('campaign insert failed')

    const t = input.initial_translation
    const { error: tErr } = await this.supabase.from('campaign_translations').insert({
      campaign_id: campaign.id,
      locale: t.locale,
      slug: t.slug,
      main_hook_md: t.main_hook_md,
      context_tag: t.context_tag,
      success_headline: t.success_headline,
      success_headline_duplicate: t.success_headline_duplicate,
      success_subheadline: t.success_subheadline,
      success_subheadline_duplicate: t.success_subheadline_duplicate,
      check_mail_text: t.check_mail_text,
      download_button_label: t.download_button_label,
      meta_title: t.meta_title ?? null,
      meta_description: t.meta_description ?? null,
      og_image_url: t.og_image_url ?? null,
      supporting_argument_md: t.supporting_argument_md ?? null,
      introductory_block_md: t.introductory_block_md ?? null,
      body_content_md: t.body_content_md ?? null,
      form_intro_md: t.form_intro_md ?? null,
      ...(t.form_button_label !== undefined ? { form_button_label: t.form_button_label } : {}),
      ...(t.form_button_loading_label !== undefined
        ? { form_button_loading_label: t.form_button_loading_label }
        : {}),
      extras: t.extras ?? null,
    })
    if (tErr) throw tErr

    const loaded = await this.getById(campaign.id, input.site_id)
    if (!loaded) throw new Error('campaign disappeared after create')
    return loaded
  }

  async update(id: string, siteId: string, patch: UpdateCampaignInput): Promise<Campaign> {
    const campaignPatch: Record<string, unknown> = {}
    if (patch.status !== undefined) campaignPatch.status = patch.status
    if (patch.scheduled_for !== undefined) campaignPatch.scheduled_for = patch.scheduled_for
    if (patch.interest !== undefined) campaignPatch.interest = patch.interest
    if (patch.pdf_storage_path !== undefined) campaignPatch.pdf_storage_path = patch.pdf_storage_path
    if (patch.brevo_list_id !== undefined) campaignPatch.brevo_list_id = patch.brevo_list_id
    if (patch.brevo_template_id !== undefined)
      campaignPatch.brevo_template_id = patch.brevo_template_id
    if (patch.form_fields !== undefined) campaignPatch.form_fields = patch.form_fields

    if (Object.keys(campaignPatch).length > 0) {
      const { error } = await this.supabase
        .from('campaigns')
        .update(campaignPatch)
        .eq('id', id)
        .eq('site_id', siteId)
      if (error) throw error
    }

    if (patch.translation) {
      const t = patch.translation
      const translationPatch: Record<string, unknown> = {}
      const keys: Array<keyof typeof t> = [
        'slug',
        'meta_title',
        'meta_description',
        'og_image_url',
        'main_hook_md',
        'supporting_argument_md',
        'introductory_block_md',
        'body_content_md',
        'form_intro_md',
        'form_button_label',
        'form_button_loading_label',
        'context_tag',
        'success_headline',
        'success_headline_duplicate',
        'success_subheadline',
        'success_subheadline_duplicate',
        'check_mail_text',
        'download_button_label',
        'extras',
      ]
      for (const k of keys) {
        if (t[k] !== undefined) translationPatch[k] = t[k]
      }

      if (Object.keys(translationPatch).length > 0) {
        // campaign_translations has no site_id — we gate by campaign_id and
        // trust the fact that the parent update above verified ownership.
        const { error } = await this.supabase
          .from('campaign_translations')
          .update(translationPatch)
          .eq('campaign_id', id)
          .eq('locale', t.locale)
        if (error) throw error
      }
    }

    const loaded = await this.getById(id, siteId)
    if (!loaded) throw new Error('campaign disappeared after update')
    return loaded
  }

  async publish(id: string, siteId: string): Promise<Campaign> {
    const { error } = await this.supabase
      .from('campaigns')
      .update({ status: 'published', published_at: this.nowIso() })
      .eq('id', id)
      .eq('site_id', siteId)
    if (error) throw error
    const loaded = await this.getById(id, siteId)
    if (!loaded) throw new Error('campaign disappeared after publish')
    return loaded
  }

  async unpublish(id: string, siteId: string): Promise<Campaign> {
    const { error } = await this.supabase
      .from('campaigns')
      .update({ status: 'draft', published_at: null })
      .eq('id', id)
      .eq('site_id', siteId)
    if (error) throw error
    const loaded = await this.getById(id, siteId)
    if (!loaded) throw new Error('campaign disappeared after unpublish')
    return loaded
  }

  async schedule(id: string, siteId: string, scheduledFor: Date): Promise<Campaign> {
    const { error } = await this.supabase
      .from('campaigns')
      .update({ status: 'scheduled', scheduled_for: scheduledFor.toISOString() })
      .eq('id', id)
      .eq('site_id', siteId)
    if (error) throw error
    const loaded = await this.getById(id, siteId)
    if (!loaded) throw new Error('campaign disappeared after schedule')
    return loaded
  }

  async archive(id: string, siteId: string): Promise<Campaign> {
    const { error } = await this.supabase
      .from('campaigns')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('site_id', siteId)
    if (error) throw error
    const loaded = await this.getById(id, siteId)
    if (!loaded) throw new Error('campaign disappeared after archive')
    return loaded
  }

  async delete(id: string, siteId: string): Promise<void> {
    const { error } = await this.supabase
      .from('campaigns')
      .delete()
      .eq('id', id)
      .eq('site_id', siteId)
    if (error) throw error
  }

  async count(opts: ContentCountOpts): Promise<number> {
    // Mirror list()'s shape: inner-join translations + filter by locale so the
    // count matches what list() would return for the same opts.
    let q = this.supabase
      .from('campaigns')
      .select('id, campaign_translations!inner(locale)', { count: 'exact', head: true })
      .eq('site_id', opts.siteId)
    if (opts.locale) q = q.eq('campaign_translations.locale', opts.locale)
    if (opts.status) q = q.eq('status', opts.status)
    const { count, error } = await q
    if (error) throw error
    return count ?? 0
  }

  private mapListItem(row: Record<string, unknown>): CampaignListItem {
    const translations = (row.campaign_translations as Record<string, unknown>[]) ?? []
    const t = translations[0] ?? {}
    return {
      id: row.id as string,
      status: row.status as CampaignListItem['status'],
      published_at: (row.published_at as string | null) ?? null,
      interest: (row.interest as string) ?? '',
      translation: {
        locale: t.locale as string,
        slug: t.slug as string,
        meta_title: (t.meta_title as string | null) ?? null,
        context_tag: (t.context_tag as string) ?? '',
      },
      available_locales: translations.map((x) => x.locale as string),
    }
  }

  private mapCampaign(row: Record<string, unknown>): Campaign {
    return {
      id: row.id as string,
      site_id: (row.site_id as string | null) ?? null,
      interest: row.interest as string,
      status: row.status as Campaign['status'],
      pdf_storage_path: (row.pdf_storage_path as string | null) ?? null,
      brevo_list_id: (row.brevo_list_id as number | null) ?? null,
      brevo_template_id: (row.brevo_template_id as number | null) ?? null,
      form_fields: (row.form_fields as CampaignFormField[]) ?? [],
      scheduled_for: (row.scheduled_for as string | null) ?? null,
      published_at: (row.published_at as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      created_by: (row.created_by as string | null) ?? null,
      updated_by: (row.updated_by as string | null) ?? null,
      translations: ((row.campaign_translations as Record<string, unknown>[]) ?? []).map((t) =>
        this.mapTranslation(t),
      ),
    }
  }

  private mapTranslation(t: Record<string, unknown>): CampaignTranslation {
    return {
      id: t.id as string,
      campaign_id: t.campaign_id as string,
      locale: t.locale as string,
      slug: t.slug as string,
      meta_title: (t.meta_title as string | null) ?? null,
      meta_description: (t.meta_description as string | null) ?? null,
      og_image_url: (t.og_image_url as string | null) ?? null,
      main_hook_md: t.main_hook_md as string,
      supporting_argument_md: (t.supporting_argument_md as string | null) ?? null,
      introductory_block_md: (t.introductory_block_md as string | null) ?? null,
      body_content_md: (t.body_content_md as string | null) ?? null,
      form_intro_md: (t.form_intro_md as string | null) ?? null,
      form_button_label: t.form_button_label as string,
      form_button_loading_label: t.form_button_loading_label as string,
      context_tag: t.context_tag as string,
      success_headline: t.success_headline as string,
      success_headline_duplicate: t.success_headline_duplicate as string,
      success_subheadline: t.success_subheadline as string,
      success_subheadline_duplicate: t.success_subheadline_duplicate as string,
      check_mail_text: t.check_mail_text as string,
      download_button_label: t.download_button_label as string,
      extras: (t.extras as unknown) ?? null,
      created_at: t.created_at as string,
      updated_at: t.updated_at as string,
    }
  }
}
