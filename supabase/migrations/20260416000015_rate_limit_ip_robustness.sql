-- Epic 4 round-3 hardening: IP robustness in rate-limit RPCs.
--
-- Previous versions compared with `host(ip) = p_ip` which is text-based and
-- fragile (IPv6 canonicalization differences, empty-string confusion).
-- Rewrite to cast p_ip → inet so both sides normalize, and handle null IP
-- correctly: null still enforces the per-email limit (newsletter) and simply
-- skips the per-ip clause (both).
--
-- Also replaces the older 2-arg newsletter_rate_check (p_site_id, p_ip) —
-- app now passes p_email too, so drop the old signature first.

-- Drop the prior 2-arg newsletter RPC (different signature, PG won't replace).
drop function if exists public.newsletter_rate_check(uuid, text);

create or replace function public.newsletter_rate_check(
  p_site_id uuid, p_ip text, p_email text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_inet inet;
  v_count int;
begin
  if p_site_id is null then return false; end if;

  begin
    v_ip_inet := case when p_ip is null or p_ip = '' then null else p_ip::inet end;
  exception when others then
    v_ip_inet := null;
  end;

  select count(*) into v_count
  from newsletter_subscriptions
  where site_id = p_site_id
    and subscribed_at > now() - interval '1 hour'
    and (
      email = p_email
      or (v_ip_inet is not null and ip = v_ip_inet)
    );

  return v_count < 5;
end;
$$;

grant execute on function public.newsletter_rate_check(uuid, text, text)
  to anon, authenticated, service_role;

-- Contact: same pattern, 10-minute window, 5-per-window cap, submitted_at.
create or replace function public.contact_rate_check(
  p_site_id uuid, p_ip text, p_email text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_inet inet;
  v_count int;
begin
  if p_site_id is null then return false; end if;

  begin
    v_ip_inet := case when p_ip is null or p_ip = '' then null else p_ip::inet end;
  exception when others then
    v_ip_inet := null;
  end;

  select count(*) into v_count
  from contact_submissions
  where site_id = p_site_id
    and submitted_at > now() - interval '10 minutes'
    and (
      (p_email is not null and email = p_email::citext)
      or (v_ip_inet is not null and ip = v_ip_inet)
    );

  return v_count < 5;
end;
$$;

grant execute on function public.contact_rate_check(uuid, text, text)
  to anon, authenticated, service_role;
