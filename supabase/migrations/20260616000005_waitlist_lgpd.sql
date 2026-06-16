-- =============================================================================
-- MIGRATION: waitlist_lgpd
--
-- (1) Re-creates lgpd_phase1_cleanup with a new waitlist_emails branch.
--     Body is verbatim copy of 20260602000003_lgpd_phase1_unique_collision_fix.sql
--     with ONLY the waitlist_emails branch added. No other line changed.
--
-- (2) New waitlist_retention_sweep(p_site_id) — per-site PASS-2 sweep.
--     Comment: the withdrawal branch keys on suppressed_at (post-withdrawal
--     grace), the other branches on created_at (storage-age) — intentional,
--     do not unify.
--
-- (3) New waitlist_signup_counts(p_site_id) — aggregate for CMS list KPIs (C3).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- (1) lgpd_phase1_cleanup — verbatim copy + waitlist_emails branch
-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: search_path divergence is INTENTIONAL — this fn keeps `TO 'public'`
-- (verbatim copy of 20260602000003; fully schema-qualified internally so safe),
-- while the two net-new fns below use `= ''`. Do NOT "normalize" this into a
-- behavior change. The one operator(public.=) on line 130 is required because
-- bare `=` on citext does NOT resolve case-insensitively even under search_path=public
-- once the array elements are explicitly cast to public.citext at the call site.
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
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (2) waitlist_retention_sweep — net-new per-site PASS-2 sweep
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.waitlist_retention_sweep(uuid);
create or replace function public.waitlist_retention_sweep(p_site_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
-- RETURN CONTRACT: the returned integer is the PASS-2 ip/ua-scrub row count
-- (rows whose ip/user_agent were nulled by the second UPDATE), NOT the count of
-- rows fully anonymized by PASS-1. It exists solely for the idempotency check
-- (first sweep > 0, repeat sweep = 0). Do NOT consume it as "rows anonymized".
declare v_pass2 integer;
begin
  update public.waitlist_signups s set
    email = encode(sha256(s.email::text::bytea),'hex'),
    ip = null, user_agent = null, locale = null, anonymized_at = now()
  where s.site_id = p_site_id and s.anonymized_at is null
    and (
      (s.status='suppressed' and s.suppression_reason='unsubscribe'
         and s.suppressed_at < now() - interval '30 days')
      or (exists (select 1 from public.waitlists w where w.id=s.waitlist_id and w.status in ('closed','launched'))
         and s.created_at < now() - interval '7 days')
      or (s.status='pending'
         and exists (select 1 from public.waitlists w where w.id=s.waitlist_id and w.status in ('draft','open'))
         and s.created_at < now() - interval '90 days')
    )
    and not (s.status='suppressed' and s.suppression_reason in ('bounce','complaint'));
  update public.waitlist_signups s set ip=null, user_agent=null
  where s.site_id = p_site_id
    and (s.ip is not null or s.user_agent is not null)
    and s.created_at < now() - interval '30 days';
  get diagnostics v_pass2 = row_count;
  return v_pass2;
end; $$;
revoke all on function public.waitlist_retention_sweep(uuid) from public, anon, authenticated;
grant execute on function public.waitlist_retention_sweep(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- (3) waitlist_signup_counts — net-new aggregate for CMS list KPIs (C3)
--     Security: service_role bypasses (app server actions enforce requireSiteAdmin
--     before calling); any other authenticated caller must pass can_view_site().
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.waitlist_signup_counts(uuid);
create or replace function public.waitlist_signup_counts(p_site_id uuid)
returns table (waitlist_id uuid, pending integer, suppressed integer)
language plpgsql security definer set search_path = '' as $$
begin
  -- service_role (CMS server client) bypasses; any other caller must be able to view the site.
  if coalesce(auth.role(), '') <> 'service_role' and not public.can_view_site(p_site_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.waitlist_id,
           count(*) filter (where s.status='pending')::int,
           count(*) filter (where s.status='suppressed')::int
    from public.waitlist_signups s
    where s.site_id = p_site_id and s.anonymized_at is null
    group by s.waitlist_id;
end; $$;
revoke all on function public.waitlist_signup_counts(uuid) from public, anon;
grant execute on function public.waitlist_signup_counts(uuid) to authenticated, service_role;
