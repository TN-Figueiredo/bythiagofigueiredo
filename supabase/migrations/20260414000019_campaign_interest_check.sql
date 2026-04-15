-- Controlled vocabulary for campaigns.interest. Extending: drop this check
-- constraint and recreate with the new vocabulary in a forward-only migration.
-- Keep values in sync with the TypeScript union at `apps/web/lib/campaigns/interest.ts`
-- (created alongside this migration — contributors changing one must change both).

alter table public.campaigns
  add constraint campaigns_interest_vocab
  check (interest in ('creator','fitness','style','career','finance','wellness','other'));
