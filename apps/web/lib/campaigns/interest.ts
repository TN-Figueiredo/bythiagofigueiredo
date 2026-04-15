// Controlled vocabulary mirrored from supabase/migrations/20260414000019_campaign_interest_check.sql.
// When adding a new interest, update BOTH this file and the migration.
export const CAMPAIGN_INTERESTS = [
  'creator',
  'fitness',
  'style',
  'career',
  'finance',
  'wellness',
  'other',
] as const

export type CampaignInterest = (typeof CAMPAIGN_INTERESTS)[number]
