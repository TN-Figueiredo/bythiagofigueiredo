-- Track password reset attempts for rate limiting (Sprint 3 C3 fix)
create table if not exists public.password_reset_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip inet,
  attempted_at timestamptz not null default now()
);

create index if not exists password_reset_attempts_email_recent_idx
  on public.password_reset_attempts (email, attempted_at desc);

alter table public.password_reset_attempts enable row level security;
revoke all on public.password_reset_attempts from anon, authenticated;
drop policy if exists "_deny_all" on public.password_reset_attempts;
create policy "_deny_all" on public.password_reset_attempts for all using (false) with check (false);

-- Atomic check + insert. Returns true if allowed, false if rate-limited.
create or replace function public.record_password_reset_attempt(p_email text, p_ip text default null)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_email, 1));
  select count(*) into v_count
    from public.password_reset_attempts
    where email = p_email
      and attempted_at > now() - interval '1 hour';
  if v_count >= 5 then
    return false;
  end if;
  insert into public.password_reset_attempts(email, ip)
    values (p_email, nullif(p_ip, '')::inet);
  return true;
end;
$$;
revoke all on function public.record_password_reset_attempt(text, text) from public, anon, authenticated;
grant execute on function public.record_password_reset_attempt(text, text) to service_role;
