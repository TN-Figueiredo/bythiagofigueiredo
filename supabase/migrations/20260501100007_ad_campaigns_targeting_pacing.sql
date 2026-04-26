-- Migration: ad_campaigns_targeting_pacing
ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS target_categories TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS impressions_target INT,
  ADD COLUMN IF NOT EXISTS clicks_target      INT,
  ADD COLUMN IF NOT EXISTS budget_cents       INT,
  ADD COLUMN IF NOT EXISTS spent_cents        INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pacing_strategy    TEXT    NOT NULL DEFAULT 'even',
  ADD COLUMN IF NOT EXISTS variant_group      TEXT,
  ADD COLUMN IF NOT EXISTS variant_weight     INT     NOT NULL DEFAULT 50;

ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_pacing_strategy_check
    CHECK (pacing_strategy IN ('even', 'front_loaded', 'asap'));

ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_variant_weight_check
    CHECK (variant_weight BETWEEN 1 AND 100);

ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_budget_positive
    CHECK (budget_cents IS NULL OR budget_cents > 0);

ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_spent_non_negative
    CHECK (spent_cents >= 0);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_target_categories
  ON public.ad_campaigns USING GIN (target_categories);

COMMENT ON COLUMN public.ad_campaigns.target_categories IS
  'Array of target category slugs. Empty array = all categories (no filter).';
COMMENT ON COLUMN public.ad_campaigns.pacing_strategy IS
  'even: uniform daily distribution. front_loaded: 60% in first 40% of flight. asap: no throttle.';
COMMENT ON COLUMN public.ad_campaigns.variant_group IS
  'Campaigns sharing the same variant_group compete for A/B split. NULL = no A/B.';
COMMENT ON COLUMN public.ad_campaigns.variant_weight IS
  'Traffic percentage allocated to this variant (1–100).';
COMMENT ON COLUMN public.ad_campaigns.budget_cents IS
  'Total budget in cents (USD). NULL = unlimited.';
COMMENT ON COLUMN public.ad_campaigns.spent_cents IS
  'Accumulated spend in cents. Incremented by tracking endpoint on each billable event.';
