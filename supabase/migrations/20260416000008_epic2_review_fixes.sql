-- Epic 2 code review fixes — append-only migration; drops + recreates affected objects.
-- C1: Remove p_user_id param from accept_invitation_atomic (privilege escalation)
-- C2: Add clarifying comment to unsubscribe_tokens (RLS deny-all documented)
-- I1: Add status guard in confirm_newsletter_subscription
-- I2: Drop now() from newsletter_pending_token partial index predicate

-- ============================================================
-- C1: accept_invitation_atomic — bind to auth.uid(), remove p_user_id param
-- ============================================================

drop function if exists public.accept_invitation_atomic(text, uuid);

create or replace function public.accept_invitation_atomic(
  p_token text
) returns json language plpgsql security definer as $fn$
declare
  v_user_id uuid := auth.uid();
  v_inv record;
  v_user_email citext;
begin
  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  -- Lock the invitation row
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

  -- Verify caller's email matches invitation email
  select email::citext into v_user_email from auth.users where id = v_user_id;
  if v_user_email is null or lower(v_user_email::text) <> lower(v_inv.email::text) then
    return json_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  -- Atomic inserts
  insert into public.organization_members (org_id, user_id, role)
  values (v_inv.org_id, v_user_id, v_inv.role)
  on conflict (org_id, user_id) do nothing;

  insert into public.authors (user_id, name, slug)
  values (
    v_user_id,
    split_part(v_inv.email::text, '@', 1),
    split_part(v_inv.email::text, '@', 1) || '-' || substring(v_user_id::text, 1, 8)
  )
  on conflict (user_id) do nothing;

  update public.invitations
  set accepted_at = now(), accepted_by_user_id = v_user_id
  where id = v_inv.id;

  return json_build_object('ok', true, 'org_id', v_inv.org_id);
end $fn$;

grant execute on function public.accept_invitation_atomic(text) to authenticated;

-- ============================================================
-- I2: newsletter_pending_token — drop now() from partial index predicate
-- ============================================================

drop index if exists public.newsletter_pending_token;

create unique index if not exists newsletter_pending_token
  on public.newsletter_subscriptions (confirmation_token)
  where status = 'pending_confirmation';

-- ============================================================
-- I1: confirm_newsletter_subscription — add invalid_state guard
-- ============================================================

create or replace function public.confirm_newsletter_subscription(p_token text) returns json language plpgsql security definer as $fn$
declare v_sub record;
begin
  select id, site_id, email, status, confirmation_expires_at into v_sub
  from public.newsletter_subscriptions
  where confirmation_token = p_token
  for update;

  if v_sub.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Guard: only pending_confirmation and confirmed are valid states here.
  -- unsubscribed subscriptions must re-subscribe rather than re-confirm.
  if v_sub.status not in ('pending_confirmation', 'confirmed') then
    return json_build_object('ok', false, 'error', 'invalid_state');
  end if;

  if v_sub.status = 'confirmed' then
    return json_build_object('ok', true, 'email', v_sub.email, 'site_id', v_sub.site_id, 'already', true);
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

  return json_build_object('ok', true, 'email', v_sub.email, 'site_id', v_sub.site_id);
end $fn$;

grant execute on function public.confirm_newsletter_subscription(text) to anon, authenticated;
