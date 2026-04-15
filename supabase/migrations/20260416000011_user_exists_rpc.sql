-- Add resent_at column to invitations if missing (needed for increment_invitation_resend)
alter table public.invitations
  add column if not exists resent_at timestamptz;

-- user_exists_by_email: safely check if an auth user exists by email
-- using service_role only — avoids listUsers() unbounded scan (C3)
create or replace function public.user_exists_by_email(p_email text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $fn$
  select exists(select 1 from auth.users where email = p_email);
$fn$;
revoke all on function public.user_exists_by_email(text) from public, anon, authenticated;
grant execute on function public.user_exists_by_email(text) to service_role;

-- increment_invitation_resend: atomic increment to avoid read-modify-write race (I13)
create or replace function public.increment_invitation_resend(p_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $fn$
  update public.invitations
     set resend_count = resend_count + 1,
         resent_at = now(),
         last_sent_at = now()
   where id = p_id;
$fn$;
revoke all on function public.increment_invitation_resend(uuid) from public, anon, authenticated;
grant execute on function public.increment_invitation_resend(uuid) to service_role;
