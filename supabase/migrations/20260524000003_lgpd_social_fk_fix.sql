-- P0 LGPD: Fix FK references to auth.users that block phase3 deleteUser.
--
-- Two tables reference auth.users(id) without ON DELETE SET NULL:
--   1. social_posts.created_by  (NOT NULL + bare FK = RESTRICT)
--   2. page_content.updated_by  (nullable + bare FK = RESTRICT)
--
-- Fix: drop NOT NULL on social_posts.created_by, replace both FKs with
-- ON DELETE SET NULL, and expand the prenullify RPC to cover them both.
--
-- P1: Expand phase1 RPC to anonymize newsletter_sends (subscriber_email,
-- open_ip, open_user_agent) and sent_emails (to_email, subject, metadata)
-- so PII in transactional email logs is scrubbed atomically.

-- ── 1. social_posts.created_by: drop NOT NULL, replace FK ───────────────────

ALTER TABLE public.social_posts ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_created_by_fkey;
ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 2. page_content.updated_by: replace FK ──────────────────────────────────

ALTER TABLE public.page_content DROP CONSTRAINT IF EXISTS page_content_updated_by_fkey;
ALTER TABLE public.page_content
  ADD CONSTRAINT page_content_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 3. Expand prenullify RPC ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."lgpd_phase3_prenullify_fks"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.authors SET user_id = NULL WHERE user_id = p_user_id;
  UPDATE public.blog_posts SET owner_user_id = NULL WHERE owner_user_id = p_user_id;
  UPDATE public.campaigns SET owner_user_id = NULL WHERE owner_user_id = p_user_id;
  UPDATE public.audit_log SET actor_user_id = NULL WHERE actor_user_id = p_user_id;
  UPDATE public.invitations SET invited_by = NULL WHERE invited_by = p_user_id;
  UPDATE public.invitations SET accepted_by_user_id = NULL WHERE accepted_by_user_id = p_user_id;
  UPDATE public.social_posts SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE public.page_content SET updated_by = NULL WHERE updated_by = p_user_id;
END $$;

-- ── 4. Expand phase1 RPC: add newsletter_sends + sent_emails cleanup ────────

CREATE OR REPLACE FUNCTION "public"."lgpd_phase1_cleanup"("p_user_id" "uuid", "p_pre_capture" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_master_admin uuid;
  v_master_ring uuid;
  v_email text;
  v_email_hash text;
BEGIN
  IF auth.role() NOT IN ('service_role','supabase_admin')
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden: can only clean up own account'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.skip_cascade_audit', '1', true);

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
        email = '[REDACTED]@redacted.invalid',
        message = '[REDACTED]',
        ip = NULL,
        user_agent = NULL
    WHERE email::text = ANY (
      SELECT jsonb_array_elements_text(p_pre_capture->'newsletter_emails')
    );
  END IF;

  -- 3. Newsletter sends anonymize (subscriber_email, open_ip, open_user_agent).
  IF p_pre_capture ? 'newsletter_emails' THEN
    UPDATE newsletter_sends
    SET subscriber_email = '[REDACTED]@redacted.invalid',
        open_ip = NULL,
        open_user_agent = NULL
    WHERE subscriber_email::text = ANY (
      SELECT jsonb_array_elements_text(p_pre_capture->'newsletter_emails')
    );
  END IF;

  -- 4. Sent emails anonymize (to_email, subject, metadata).
  IF p_pre_capture ? 'newsletter_emails' THEN
    UPDATE sent_emails
    SET to_email = '[REDACTED]@redacted.invalid',
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
