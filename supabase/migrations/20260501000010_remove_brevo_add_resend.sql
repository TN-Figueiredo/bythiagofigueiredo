-- Remove all Brevo columns, indexes, constraints
-- Add welcome_sent + tracking_consent to newsletter_subscriptions

-- ============================================================
-- 1. newsletter_subscriptions: drop brevo, add welcome_sent + tracking_consent
-- ============================================================

ALTER TABLE public.newsletter_subscriptions
  DROP CONSTRAINT IF EXISTS newsletter_subscriptions_check;

ALTER TABLE public.newsletter_subscriptions
  DROP COLUMN IF EXISTS brevo_contact_id;

DROP INDEX IF EXISTS newsletter_pending_brevo_sync;

ALTER TABLE public.newsletter_subscriptions
  DROP CONSTRAINT IF EXISTS newsletter_subscriptions_status_check;
ALTER TABLE public.newsletter_subscriptions
  ADD CONSTRAINT newsletter_subscriptions_status_check
  CHECK (status IN ('pending_confirmation','confirmed','unsubscribed','bounced','complained'));

ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS welcome_sent boolean NOT NULL DEFAULT false;

ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS tracking_consent boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS newsletter_pending_welcome
  ON public.newsletter_subscriptions (site_id)
  WHERE status = 'confirmed' AND welcome_sent = false;

-- ============================================================
-- 2. campaigns: drop brevo columns
-- ============================================================
ALTER TABLE public.campaigns
  DROP COLUMN IF EXISTS brevo_list_id,
  DROP COLUMN IF EXISTS brevo_template_id;

-- ============================================================
-- 3. campaign_submissions: drop brevo columns + constraint + index
-- ============================================================
ALTER TABLE public.campaign_submissions
  DROP CONSTRAINT IF EXISTS campaign_submissions_sync_status_check;

DROP INDEX IF EXISTS campaign_submissions_brevo_sync_status_idx;

ALTER TABLE public.campaign_submissions
  DROP COLUMN IF EXISTS brevo_contact_id,
  DROP COLUMN IF EXISTS brevo_sync_status,
  DROP COLUMN IF EXISTS brevo_sync_error,
  DROP COLUMN IF EXISTS brevo_synced_at;

-- ============================================================
-- 4. sites: drop brevo_newsletter_list_id
-- ============================================================
ALTER TABLE public.sites
  DROP COLUMN IF EXISTS brevo_newsletter_list_id;
