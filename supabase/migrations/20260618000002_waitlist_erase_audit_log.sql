-- =============================================================================
-- MIGRATION: audit-log the waitlist erasure (LGPD Art. 8 accountability — C).
-- Replaces waitlist_erase_by_email with a signature that takes the requester's ip/ua and
-- writes ONE audit_log row per actual erasure (mirrors the consent log in waitlist_signup).
-- A NEW migration (20260618000001 is already applied to prod) — drop-first idempotent.
-- =============================================================================

-- Deploy-safe: do NOT drop the original 2-arg version. The currently-live prod code calls
-- waitlist_erase_by_email(uuid, citext); keeping a 2-arg WRAPPER that delegates to the new
-- 4-arg means there is no break in the window between this migration and the new deploy, and
-- the old path also gets audit-logged. (Both overloads coexist; service_role-only.)
drop function if exists public.waitlist_erase_by_email(uuid, public.citext, inet, text);

create or replace function public.waitlist_erase_by_email(
  p_site_id    uuid,
  p_email      public.citext,
  p_ip         inet,
  p_user_agent text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count  integer;
  v_org_id uuid;
begin
  update public.waitlist_signups s set
    email        = encode(sha256(s.email::text::bytea), 'hex'),
    ip           = null,
    user_agent   = null,
    locale       = null,
    anonymized_at = now()
  where s.site_id = p_site_id
    and s.email operator(public.=) p_email
    and s.anonymized_at is null;
  get diagnostics v_count = row_count;

  -- Accountability: record the honored deletion request (only when something was erased).
  -- Stores the HASHED email (never the plaintext) + the row count. No actor_user_id — the
  -- requester is an anonymous data subject proving control via the rights token.
  if v_count > 0 then
    select org_id into v_org_id from public.sites where id = p_site_id;
    insert into public.audit_log
      (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
    values
      (null, 'waitlist_erasure', 'waitlist_signups', null, v_org_id, p_site_id,
       jsonb_build_object(
         'email_hash', encode(sha256(p_email::text::bytea), 'hex'),
         'rows_affected', v_count,
         'reason', 'data_subject_request'),
       p_ip, p_user_agent);
  end if;

  return v_count;
end;
$$;

revoke all on function public.waitlist_erase_by_email(uuid, public.citext, inet, text) from public, anon, authenticated;
grant execute on function public.waitlist_erase_by_email(uuid, public.citext, inet, text) to service_role;

-- Back-compat 2-arg wrapper (delegates to the 4-arg with no requester ip/ua) so the
-- previously-deployed callers keep working — and now also audit-log — until they roll forward.
create or replace function public.waitlist_erase_by_email(p_site_id uuid, p_email public.citext)
returns integer
language sql
security definer
set search_path = ''
as $$
  select public.waitlist_erase_by_email(p_site_id, p_email, null::inet, null::text);
$$;
revoke all on function public.waitlist_erase_by_email(uuid, public.citext) from public, anon, authenticated;
grant execute on function public.waitlist_erase_by_email(uuid, public.citext) to service_role;
