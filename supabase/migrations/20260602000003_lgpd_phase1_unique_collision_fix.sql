-- Fix LGPD phase1 UNIQUE constraint violation when 2+ users delete accounts.
--
-- Problem: lgpd_phase1_cleanup sets subscriber_email and to_email to
-- '[REDACTED]@redacted.invalid' which collides on:
--   - newsletter_sends UNIQUE(edition_id, subscriber_email)
--   - sent_emails sent_emails_welcome_unique
--   - sent_emails sent_emails_contact_autoreply_daily
--
-- Fix: Use per-user unique placeholder incorporating a hash of p_user_id,
-- so each deletion produces a distinct email that never collides.

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
END $$;
