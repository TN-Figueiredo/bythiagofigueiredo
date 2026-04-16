-- Defense in depth: even though the GRANT is service_role-only, add an
-- explicit caller check so a future mis-edited GRANT cannot let users
-- wipe other accounts. CREATE OR REPLACE to update the existing function.
--
-- Body is the verbatim content of 20260430000006_rpc_lgpd_phase1_cleanup.sql
-- with the caller-identity guard prepended right after BEGIN. Do not drift
-- the non-guard logic from the original migration — when 000006 is patched
-- in future, this file must be re-pasted to match.

CREATE OR REPLACE FUNCTION public.lgpd_phase1_cleanup(p_user_id uuid, p_pre_capture jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_master_admin uuid;
  v_master_ring uuid;
  v_email text;
  v_email_hash text;
BEGIN
  -- Caller identity guard (Sprint 5a fix 16).
  -- Only service_role / supabase_admin / postgres can wipe ANY user.
  -- Other roles (e.g. `authenticated`) can only target themselves — so
  -- even if a future migration mis-grants EXECUTE to authenticated,
  -- they can't wipe a stranger's account.
  IF current_user NOT IN ('service_role','supabase_admin','postgres')
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden: can only clean up own account'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.skip_cascade_audit', '1', true);

  -- Resolve master admin (for content reassignment). Pick any org_admin of master ring.
  SELECT id INTO v_master_ring FROM organizations WHERE parent_org_id IS NULL LIMIT 1;
  IF v_master_ring IS NOT NULL THEN
    SELECT user_id INTO v_master_admin
    FROM organization_members
    WHERE org_id = v_master_ring AND role = 'org_admin' AND user_id <> p_user_id
    LIMIT 1;
  END IF;

  -- 1. Newsletter anonymize via pre-captured emails.
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

  -- 2. Contact submissions anonymize — by email matches from pre-capture.
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

  -- 3 + 4. Reassign content ownership to master_admin (NULL if no master_admin exists).
  UPDATE blog_posts SET owner_user_id = v_master_admin
    WHERE owner_user_id = p_user_id;
  UPDATE campaigns SET owner_user_id = v_master_admin
    WHERE owner_user_id = p_user_id;

  -- 5. Nullify authors.user_id for this user — keeps author row for historical byline.
  UPDATE authors SET user_id = NULL WHERE user_id = p_user_id;

  -- 6. Delete pending invitations this user sent out.
  DELETE FROM invitations
  WHERE invited_by = p_user_id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

  -- 7. Null actor_user_id in audit_log (structural preservation per LGPD accountability).
  UPDATE audit_log SET actor_user_id = NULL WHERE actor_user_id = p_user_id;
END $$;
