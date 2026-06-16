-- MIGRATION: waitlist_rate_check — 10-min window, 5 per IP OR email. Fail-closed caller.
drop function if exists public.waitlist_rate_check(uuid, text, text);
create or replace function public.waitlist_rate_check(p_site_id uuid, p_ip text, p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ip_inet inet; v_count int;
begin
  if p_site_id is null then return false; end if;
  begin
    v_ip_inet := case when p_ip is null or p_ip = '' then null else p_ip::inet end;
  exception when others then v_ip_inet := null; end;
  select count(*) into v_count
    from public.waitlist_signups
   where site_id = p_site_id
     and anonymized_at is null  -- consistency with waitlist_signup; anonymized rows have null ip + hashed email so this is a no-op today but defensive if anonymization ever stops nulling ip
     and created_at > now() - interval '10 minutes'
     and ((p_email is not null and email operator(public.=) p_email::public.citext)
          or (v_ip_inet is not null and ip = v_ip_inet));
  return v_count < 5;
end; $$;
revoke all on function public.waitlist_rate_check(uuid, text, text) from public, anon, authenticated;
grant execute on function public.waitlist_rate_check(uuid, text, text) to service_role;
