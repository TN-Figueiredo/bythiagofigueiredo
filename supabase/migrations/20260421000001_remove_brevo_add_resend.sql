-- 20260421000001_remove_brevo_add_resend.sql
-- Phase 1: Remove all Brevo columns, indexes, constraints
-- Phase 2: Add Resend email_provider enum value + welcome_sent + tracking_consent

BEGIN;

-- ============================================================
-- 1. newsletter_subscriptions: drop brevo, add welcome_sent + tracking_consent
-- ============================================================

-- Drop the CHECK constraint that required brevo_contact_id for confirmed status
-- The constraint name comes from: check (status <> 'confirmed' or brevo_contact_id is not null or status = 'pending_confirmation')
ALTER TABLE public.newsletter_subscriptions
  DROP CONSTRAINT IF EXISTS newsletter_subscriptions_check;

ALTER TABLE public.newsletter_subscriptions
  DROP COLUMN IF EXISTS brevo_contact_id;

-- Drop the Brevo sync index
DROP INDEX IF EXISTS newsletter_pending_brevo_sync;

-- Re-add status CHECK without brevo_contact_id requirement + new statuses
ALTER TABLE public.newsletter_subscriptions
  DROP CONSTRAINT IF EXISTS newsletter_subscriptions_status_check;
ALTER TABLE public.newsletter_subscriptions
  ADD CONSTRAINT newsletter_subscriptions_status_check
  CHECK (status IN ('pending_confirmation','confirmed','unsubscribed','bounced','complained'));

-- Add welcome_sent for post-Brevo welcome email flow
ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS welcome_sent boolean NOT NULL DEFAULT false;

-- Add tracking_consent for LGPD analytics opt-out
ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS tracking_consent boolean NOT NULL DEFAULT true;

-- Index for welcome email cron
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

-- ============================================================
-- 5. sent_emails: add 'resend' to email_provider enum
-- ============================================================
ALTER TYPE public.email_provider ADD VALUE IF NOT EXISTS 'resend';

-- ============================================================
-- 6. update_campaign_atomic RPC: remove brevo fields from patch whitelist
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_campaign_atomic(
  p_campaign_id uuid,
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_translations jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign record;
  v_result jsonb;
  v_key text;
  v_allowed_keys text[] := ARRAY[
    'interest', 'status', 'pdf_storage_path',
    'form_fields', 'scheduled_for', 'published_at',
    'owner_user_id'
  ];
  v_set_parts text[] := '{}';
  v_trans jsonb;
  v_trans_allowed text[] := ARRAY[
    'locale','slug','meta_title','meta_description',
    'content_mdx','content_compiled','cover_image_url',
    'pdf_storage_path','seo_extras'
  ];
BEGIN
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Build dynamic SET clause from allowed keys only
  FOR v_key IN SELECT jsonb_object_keys(p_patch)
  LOOP
    IF v_key = ANY(v_allowed_keys) THEN
      v_set_parts := array_append(v_set_parts,
        format('%I = %L', v_key, p_patch->>v_key));
    END IF;
  END LOOP;

  IF array_length(v_set_parts, 1) > 0 THEN
    EXECUTE format(
      'UPDATE campaigns SET %s, updated_at = now() WHERE id = %L',
      array_to_string(v_set_parts, ', '), p_campaign_id
    );
  END IF;

  -- Upsert translations
  FOR v_trans IN SELECT * FROM jsonb_array_elements(p_translations)
  LOOP
    INSERT INTO campaign_translations (campaign_id, locale, slug, meta_title, meta_description,
      content_mdx, content_compiled, cover_image_url, pdf_storage_path, seo_extras)
    VALUES (
      p_campaign_id,
      v_trans->>'locale',
      v_trans->>'slug',
      v_trans->>'meta_title',
      v_trans->>'meta_description',
      v_trans->>'content_mdx',
      v_trans->>'content_compiled',
      v_trans->>'cover_image_url',
      v_trans->>'pdf_storage_path',
      CASE WHEN v_trans ? 'seo_extras' THEN v_trans->'seo_extras' ELSE NULL END
    )
    ON CONFLICT (campaign_id, locale) DO UPDATE SET
      slug = EXCLUDED.slug,
      meta_title = EXCLUDED.meta_title,
      meta_description = EXCLUDED.meta_description,
      content_mdx = EXCLUDED.content_mdx,
      content_compiled = EXCLUDED.content_compiled,
      cover_image_url = EXCLUDED.cover_image_url,
      pdf_storage_path = EXCLUDED.pdf_storage_path,
      seo_extras = COALESCE(EXCLUDED.seo_extras, campaign_translations.seo_extras);
  END LOOP;

  SELECT row_to_json(c.*) INTO v_result FROM campaigns c WHERE c.id = p_campaign_id;
  RETURN jsonb_build_object('ok', true, 'campaign', v_result);
END;
$$;

COMMIT;
