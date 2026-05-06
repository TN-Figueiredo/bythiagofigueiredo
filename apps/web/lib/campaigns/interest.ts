// Controlled vocabulary mirrored from supabase/migrations/20260507000001_schema.sql (campaigns_interest_vocab constraint).
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
