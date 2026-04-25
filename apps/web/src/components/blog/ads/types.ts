/**
 * Ad system types for bythiagofigueiredo blog.
 *
 * Philosophy: editorial-first. Every ad is clearly labeled, dismissable,
 * and respects reader attention.
 */

/** Per-slot toggle configuration */
export type AdSlotConfig = {
  enabled: boolean
  slots: {
    marginalia: boolean
    anchor: boolean
    bookmark: boolean
    coda: boolean
    bowtie: boolean
    doorman: boolean
  }
}

/** Sponsor ad — external brand */
export type SponsorAd = {
  id: string
  label_pt: string
  label_en: string
  brand: string
  brandColor: string
  headline_pt: string
  headline_en: string
  body_pt: string
  body_en: string
  cta_pt: string
  cta_en: string
  url: string
  tagline_pt: string
  tagline_en: string
  /** SVG markup string rendered via dangerouslySetInnerHTML */
  mark: string
}

/** House ad — own products (newsletter, video, post) */
export type HouseAd = SponsorAd & {
  kind: 'newsletter' | 'video' | 'post'
}

/** Locale key used internally for ad content lookup */
export type AdLocaleKey = 'pt' | 'en'

/** Props shared by all ad slot components */
export type AdProps = {
  ad: SponsorAd | HouseAd
  locale: 'en' | 'pt-BR'
  onDismiss?: () => void
}
