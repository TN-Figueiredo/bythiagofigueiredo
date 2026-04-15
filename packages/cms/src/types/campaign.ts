import type { ContentStatus } from './content'

/**
 * Extras are an opt-in array of structured landing-page blocks (youtube embed,
 * testimonial, whoAmI, whatsapp CTAs, etc.). The CMS package intentionally
 * keeps this loosely typed (`unknown`) so consumers can validate with their
 * own Zod schema — see `apps/web/lib/campaigns/extras-schema.ts` for the
 * canonical shape used by bythiagofigueiredo.
 */
export type CampaignExtras = unknown

export interface CampaignTranslation {
  id: string
  campaign_id: string
  locale: string
  slug: string

  meta_title: string | null
  meta_description: string | null
  og_image_url: string | null

  main_hook_md: string
  supporting_argument_md: string | null
  introductory_block_md: string | null
  body_content_md: string | null

  form_intro_md: string | null
  form_button_label: string
  form_button_loading_label: string

  context_tag: string
  success_headline: string
  success_headline_duplicate: string
  success_subheadline: string
  success_subheadline_duplicate: string
  check_mail_text: string
  download_button_label: string

  extras: CampaignExtras | null

  created_at: string
  updated_at: string
}

export interface CampaignFormField {
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox'
  required?: boolean
  options?: Array<{ value: string; label: string }>
  placeholder?: string
}

export interface Campaign {
  id: string
  site_id: string | null
  interest: string
  status: ContentStatus
  pdf_storage_path: string | null
  brevo_list_id: number | null
  brevo_template_id: number | null
  form_fields: CampaignFormField[]
  scheduled_for: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  translations: CampaignTranslation[]
}

export interface CampaignListItem {
  id: string
  status: ContentStatus
  published_at: string | null
  interest: string
  translation: {
    locale: string
    slug: string
    meta_title: string | null
    context_tag: string
  }
  available_locales: string[]
}

export interface CreateCampaignInput {
  site_id: string
  interest: string
  brevo_list_id?: number | null
  brevo_template_id?: number | null
  form_fields?: CampaignFormField[]
  pdf_storage_path?: string | null
  initial_translation: {
    locale: string
    slug: string
    main_hook_md: string
    context_tag: string
    success_headline: string
    success_headline_duplicate: string
    success_subheadline: string
    success_subheadline_duplicate: string
    check_mail_text: string
    download_button_label: string
    meta_title?: string | null
    meta_description?: string | null
    og_image_url?: string | null
    supporting_argument_md?: string | null
    introductory_block_md?: string | null
    body_content_md?: string | null
    form_intro_md?: string | null
    form_button_label?: string
    form_button_loading_label?: string
    extras?: CampaignExtras | null
  }
}

export interface UpdateCampaignInput {
  status?: ContentStatus
  scheduled_for?: string | null
  interest?: string
  pdf_storage_path?: string | null
  brevo_list_id?: number | null
  brevo_template_id?: number | null
  form_fields?: CampaignFormField[]
  translation?: Partial<Omit<CampaignTranslation, 'id' | 'campaign_id' | 'created_at' | 'updated_at'>> & {
    locale: string
  }
}
