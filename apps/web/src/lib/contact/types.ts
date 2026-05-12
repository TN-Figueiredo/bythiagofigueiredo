export interface FaqItem {
  q: string
  a: string
}

export interface ContactPageSettings {
  id: string
  site_id: string
  locale: string
  hero_title: string
  hero_subtitle: string
  response_time_text: string
  form_title: string
  auto_reply_text: string
  subject_options: string[]
  faq_items: FaqItem[]
}

export interface ContactPageVisibility {
  id: string
  site_id: string
  show_hero: boolean
  show_social_links: boolean
  show_contact_form: boolean
  show_faq: boolean
  show_avatar: boolean
  show_bio: boolean
  show_response_badge: boolean
  social_order: string[]
  social_visible: Record<string, boolean>
  email_highlight: boolean
  handwritten_note: boolean
  show_subject_selector: boolean
  show_marketing_consent: boolean
}

export interface ContactAuthorData {
  name: string
  avatar_url: string | null
  social_links: Record<string, string>
  headline: string | null
  bio: string | null
}

export type ContactResult =
  | { status: 'ok' }
  | { status: 'validation' }
  | { status: 'captcha_failed' }
  | { status: 'rate_limited' }
  | { status: 'error' }
