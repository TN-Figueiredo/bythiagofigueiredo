-- Epic 2 security hardening — append-only migration.
-- Fixes:
-- 1. set search_path = public, pg_temp on ALL security definer functions (CVE-class)
-- 2. PII leakage: strip email/site_id/sub_id from unsubscribe_via_token and
--    confirm_newsletter_subscription responses
-- 3. invitations_rate_limit: advisory xact lock to prevent race + search_path
-- 4. invitations.invited_by: nullable + ON DELETE SET NULL
-- 5. Hot-path index on invitations (invited_by, created_at desc)
-- 6. accept_invitation_atomic: gate authors insert on role='author' + slug conflict fallback
-- 7. unsubscribe_tokens: explicit revoke + deny-all policy (defense-in-depth)
-- 8. Length CHECKs on sent_emails.template_name and sites.contact_notification_email
-- 9. Null confirmation_token on unsubscribe transition
--
-- Wrapped in DO + EXECUTE to be Supabase CLI 2.90-safe (multi-statement
-- parser combines sequential top-level statements into a single prepared
-- statement; DO blocks are always parsed as one top-level statement).

DO $mig$ BEGIN

-- ============================================================
-- 1+2+9: unsubscribe_via_token — search_path + PII strip + null confirmation_token
-- ============================================================

EXECUTE $stmt$
create or replace function public.unsubscribe_via_token(p_token text) returns json language plpgsql security definer set search_path = public, pg_temp as $fn$
declare
  v_tok record;
  v_sub record;
begin
  select token, site_id, email, used_at into v_tok
  from public.unsubscribe_tokens
  where token = p_token
  for update;

  if v_tok.token is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_tok.used_at is not null then
    return json_build_object('ok', true, 'already', true);
  end if;

  select id, status into v_sub
  from public.newsletter_subscriptions
  where site_id = v_tok.site_id and email = v_tok.email
  for update;

  if v_sub.id is not null and v_sub.status <> 'unsubscribed' then
    update public.newsletter_subscriptions
    set status = 'unsubscribed',
        unsubscribed_at = now(),
        confirmation_token = null
    where id = v_sub.id;
  end if;

  update public.unsubscribe_tokens set used_at = now() where token = p_token;

  return json_build_object('ok', true);
end $fn$
$stmt$;

-- ============================================================
-- 1+2: confirm_newsletter_subscription — search_path + PII strip + oracle fix
-- ============================================================

EXECUTE $stmt$
create or replace function public.confirm_newsletter_subscription(p_token text) returns json language plpgsql security definer set search_path = public, pg_temp as $fn$
declare
  v_sub record;
begin
  select id, site_id, email, status, confirmation_expires_at into v_sub
  from public.newsletter_subscriptions
  where confirmation_token = p_token
  for update;

  if v_sub.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_sub.status not in ('pending_confirmation', 'confirmed') then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_sub.status = 'confirmed' then
    return json_build_object('ok', true, 'already', true);
  end if;

  if v_sub.confirmation_expires_at <= now() then
    return json_build_object('ok', false, 'error', 'expired');
  end if;

  update public.newsletter_subscriptions
  set status = 'confirmed',
      confirmed_at = now(),
      confirmation_token = null,
      confirmation_expires_at = null
  where id = v_sub.id;

  return json_build_object('ok', true);
end $fn$
$stmt$;

-- ============================================================
-- 1+6: accept_invitation_atomic — search_path + role-gated authors insert + slug fallback
-- ============================================================

EXECUTE $stmt$
create or replace function public.accept_invitation_atomic(p_token text) returns json language plpgsql security definer set search_path = public, pg_temp as $fn$
declare
  v_user_id uuid := auth.uid();
  v_inv record;
  v_user_email citext;
  v_base_slug text;
  v_slug text;
begin
  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select id, email, org_id, role, expires_at, accepted_at, revoked_at
    into v_inv
  from public.invitations
  where token = p_token
  for update;

  if v_inv.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_inv.accepted_at is not null then
    return json_build_object('ok', false, 'error', 'already_accepted');
  end if;
  if v_inv.revoked_at is not null then
    return json_build_object('ok', false, 'error', 'revoked');
  end if;
  if v_inv.expires_at <= now() then
    return json_build_object('ok', false, 'error', 'expired');
  end if;

  select email::citext into v_user_email from auth.users where id = v_user_id;
  if v_user_email is null or lower(v_user_email::text) <> lower(v_inv.email::text) then
    return json_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  insert into public.organization_members (org_id, user_id, role)
  values (v_inv.org_id, v_user_id, v_inv.role)
  on conflict (org_id, user_id) do nothing;

  if v_inv.role = 'author' then
    v_base_slug := split_part(v_inv.email::text, '@', 1) || '-' || substring(v_user_id::text, 1, 8);
    v_slug := v_base_slug;

    begin
      insert into public.authors (user_id, name, slug)
      values (
        v_user_id,
        split_part(v_inv.email::text, '@', 1),
        v_slug
      )
      on conflict (user_id) do nothing;
    exception when unique_violation then
      v_slug := v_base_slug || '-' || substring(md5(random()::text), 1, 4);
      insert into public.authors (user_id, name, slug)
      values (
        v_user_id,
        split_part(v_inv.email::text, '@', 1),
        v_slug
      )
      on conflict (user_id) do nothing;
    end;
  end if;

  update public.invitations
  set accepted_at = now(), accepted_by_user_id = v_user_id
  where id = v_inv.id;

  return json_build_object('ok', true, 'org_id', v_inv.org_id);
end $fn$
$stmt$;

-- ============================================================
-- 1: get_invitation_by_token — add search_path
-- ============================================================

EXECUTE $stmt$
create or replace function public.get_invitation_by_token(p_token text) returns table ( email citext, role text, org_name text, expires_at timestamptz, expired boolean ) language sql stable security definer set search_path = public, pg_temp as $fn$
  select
    i.email,
    i.role,
    o.name as org_name,
    i.expires_at,
    (i.expires_at <= now() or i.accepted_at is not null or i.revoked_at is not null) as expired
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  where i.token = p_token
  limit 1
$fn$
$stmt$;

-- ============================================================
-- 3: invitations_rate_limit — search_path + advisory xact lock (race fix)
-- ============================================================

EXECUTE $stmt$
create or replace function public.invitations_rate_limit() returns trigger language plpgsql set search_path = public, pg_temp as $fn$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.invited_by::text, 0));

  select count(*) into v_count from public.invitations
   where invited_by = new.invited_by
     and created_at > now() - interval '1 hour';

  if v_count >= 20 then
    raise exception 'rate_limit_exceeded: max 20 invitations per hour per admin'
      using errcode = 'check_violation';
  end if;
  return new;
end $fn$
$stmt$;

-- ============================================================
-- 4: invitations.invited_by — nullable + ON DELETE SET NULL
-- ============================================================

EXECUTE $stmt$
alter table public.invitations alter column invited_by drop not null
$stmt$;

EXECUTE $stmt$
alter table public.invitations drop constraint if exists invitations_invited_by_fkey
$stmt$;

EXECUTE $stmt$
alter table public.invitations
  add constraint invitations_invited_by_fkey
  foreign key (invited_by) references auth.users(id) on delete set null
$stmt$;

-- ============================================================
-- 5: Hot-path index
-- ============================================================

EXECUTE $stmt$
create index if not exists invitations_invited_by_recent_idx
  on public.invitations (invited_by, created_at desc)
$stmt$;

-- ============================================================
-- 7: unsubscribe_tokens — revoke + deny-all policy
-- ============================================================

EXECUTE $stmt$
revoke all on public.unsubscribe_tokens from anon, authenticated
$stmt$;

EXECUTE $stmt$
drop policy if exists "_deny_all" on public.unsubscribe_tokens
$stmt$;

EXECUTE $stmt$
create policy "_deny_all" on public.unsubscribe_tokens for all using (false) with check (false)
$stmt$;

-- ============================================================
-- 8: Length CHECKs
-- ============================================================

EXECUTE $stmt$
alter table public.sent_emails
  add constraint sent_emails_template_name_len
  check (char_length(template_name) <= 80)
$stmt$;

EXECUTE $stmt$
alter table public.sites
  add constraint sites_contact_email_len
  check (contact_notification_email is null or char_length(contact_notification_email) <= 320)
$stmt$;

END $mig$;
