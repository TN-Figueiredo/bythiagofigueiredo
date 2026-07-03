-- =============================================================================
-- MIGRATION: LGPD phase1 — anonymize password_reset_attempts
-- =============================================================================
-- Finding: `lgpd_phase1_cleanup` anonymized newsletter/contact/waitlist PII on
-- account deletion but left `password_reset_attempts` (email + ip, keyed by
-- email, no user_id column) holding plaintext for up to 30 days (until the
-- BTF-032 retention purge runs). LGPD Art. 18 erasure must strip that PII
-- immediately at phase 1, not eventually.
--
-- Fix: re-create lgpd_phase1_cleanup as a VERBATIM copy of the body from
-- 20260616000005_waitlist_lgpd.sql, with ONLY a new section (§11) appended that
-- hashes `email` and nulls `ip` on password_reset_attempts for every address in
-- the pre-captured `newsletter_emails` set (the same auth-derived email array the
-- other email-keyed branches use — password_reset_attempts has no user_id, so
-- email is the only link to the deleting user).
--
-- search_path: kept `TO 'public'` (verbatim, matches the base fn). Body is either
-- schema-qualified (§10, new §11) or resolves under public — do NOT normalize.
-- Idempotent: §11 hashes plaintext emails; a re-run finds no plaintext matches
-- (rows already hold hex hashes) → no-op. CREATE OR REPLACE keeps it re-runnable.
-- =============================================================================

CREATE OR REPLACE FUNCTION "public"."lgpd_phase1_cleanup"("p_user_id" "uuid", "p_pre_capture" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_master_admin uuid;
  v_master_ring uuid;
  v_email text;
  v_email_hash text;
  v_redacted_email text;
BEGIN
  IF auth.role() NOT IN ('service_role','supabase_admin')
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden: can only clean up own account'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.skip_cascade_audit', '1', true);

  -- Per-user unique redacted email to avoid UNIQUE constraint collisions.
  v_redacted_email := '[REDACTED]-' || encode(sha256(p_user_id::text::bytea), 'hex') || '@redacted.invalid';

  SELECT id INTO v_master_ring FROM organizations WHERE parent_org_id IS NULL LIMIT 1;
  IF v_master_ring IS NOT NULL THEN
    SELECT user_id INTO v_master_admin
    FROM organization_members
    WHERE org_id = v_master_ring AND role = 'org_admin' AND user_id <> p_user_id
    LIMIT 1;
  END IF;

  -- 1. Newsletter subscriptions anonymize via pre-captured emails.
  IF p_pre_capture ? 'newsletter_emails' THEN
    FOR v_email IN SELECT jsonb_array_elements_text(p_pre_capture->'newsletter_emails')
    LOOP
      v_email_hash := encode(sha256(v_email::bytea), 'hex');
      UPDATE newsletter_subscriptions
      SET email = v_email_hash,
          ip = NULL,
          user_agent = NULL,
          status = 'unsubscribed',
          unsubscribed_at = COALESCE(unsubscribed_at, now())
      WHERE email = v_email AND status <> 'unsubscribed';
    END LOOP;
  END IF;

  -- 2. Contact submissions anonymize.
  IF p_pre_capture ? 'newsletter_emails' THEN
    UPDATE contact_submissions
    SET name = '[REDACTED]',
        email = v_redacted_email,
        message = '[REDACTED]',
        ip = NULL,
        user_agent = NULL
    WHERE email::text = ANY (
      SELECT jsonb_array_elements_text(p_pre_capture->'newsletter_emails')
    );
  END IF;

  -- 3. Newsletter sends anonymize (subscriber_email, open_ip, open_user_agent).
  --    Uses per-user unique email to avoid UNIQUE(edition_id, subscriber_email) collision.
  IF p_pre_capture ? 'newsletter_emails' THEN
    UPDATE newsletter_sends
    SET subscriber_email = v_redacted_email,
        open_ip = NULL,
        open_user_agent = NULL
    WHERE subscriber_email::text = ANY (
      SELECT jsonb_array_elements_text(p_pre_capture->'newsletter_emails')
    );
  END IF;

  -- 4. Sent emails anonymize (to_email, subject, metadata).
  --    Uses per-user unique email to avoid sent_emails_welcome_unique
  --    and sent_emails_contact_autoreply_daily constraint collisions.
  IF p_pre_capture ? 'newsletter_emails' THEN
    UPDATE sent_emails
    SET to_email = v_redacted_email,
        subject = '[REDACTED]',
        metadata = NULL
    WHERE to_email::text = ANY (
      SELECT jsonb_array_elements_text(p_pre_capture->'newsletter_emails')
    );
  END IF;

  -- 5 + 6. Reassign content ownership to master_admin.
  UPDATE blog_posts SET owner_user_id = v_master_admin
    WHERE owner_user_id = p_user_id;
  UPDATE campaigns SET owner_user_id = v_master_admin
    WHERE owner_user_id = p_user_id;

  -- 7. Nullify authors.user_id.
  UPDATE authors SET user_id = NULL WHERE user_id = p_user_id;

  -- 8. Delete pending invitations this user sent.
  DELETE FROM invitations
  WHERE invited_by = p_user_id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

  -- 9. Null actor_user_id in audit_log.
  UPDATE audit_log SET actor_user_id = NULL WHERE actor_user_id = p_user_id;

  -- 10. Waitlist signups: anonymize via pre-captured emails.
  --     Citext-native comparison: cast array elements to public.citext for
  --     case-insensitive matching (NOT column to text — must be citext on both
  --     sides to use citext equality operator).
  --     consent_grant_at and consent_text_version are deliberately retained:
  --     they serve as Art.15 proof-of-consent on the anonymized row.
  IF p_pre_capture ? 'waitlist_emails' THEN
    UPDATE public.waitlist_signups
       SET email = encode(sha256(email::text::bytea),'hex'),
           ip = NULL, user_agent = NULL, locale = NULL, anonymized_at = now()
     WHERE email operator(public.=) ANY (
             SELECT (jsonb_array_elements_text(p_pre_capture->'waitlist_emails'))::public.citext)
       AND anonymized_at IS NULL;
  END IF;

  -- 11. Password reset attempts: anonymize by email (keyed, no user_id column).
  --     email is text and ip is inet — hash the email (hex) and null the ip so
  --     the security-audit trail keeps a (non-reversible) marker without PII.
  --     Uses the SAME auth-derived `newsletter_emails` set as the other
  --     email-keyed branches (§1-4). BTF-032's 30-day retention purge deletes
  --     these rows eventually; this strips PII IMMEDIATELY at erasure time.
  IF p_pre_capture ? 'newsletter_emails' THEN
    UPDATE public.password_reset_attempts
    SET email = encode(sha256(email::bytea), 'hex'),
        ip = NULL
    WHERE email = ANY (
      SELECT jsonb_array_elements_text(p_pre_capture->'newsletter_emails')
    );
  END IF;
END $$;
