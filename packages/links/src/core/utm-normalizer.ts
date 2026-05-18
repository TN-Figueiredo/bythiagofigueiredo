export type UtmField = 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content' | 'utm_id'

export function normalizeUtmValue(_field: UtmField, _value: string | null | undefined): string | null {
  throw new Error('Not implemented')
}

export interface UtmFieldsInput {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_term?: string | null
  utm_content?: string | null
  utm_id?: string | null
}

export interface UtmFieldsNormalized {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  utm_id: string | null
}

export function normalizeAllUtmFields(_input: UtmFieldsInput): UtmFieldsNormalized {
  throw new Error('Not implemented')
}

export function slugifyForCampaign(_title: string): string {
  throw new Error('Not implemented')
}

export function isKnownMedium(_value: string): boolean {
  throw new Error('Not implemented')
}

export const GA4_MEDIUM_SUGGESTIONS: string[] = []

export const KNOWN_UTM_SOURCES: string[] = []
