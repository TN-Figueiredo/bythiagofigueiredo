-- Add last_sent_at column to invitations if missing (needed for 30s cooldown guard)
alter table public.invitations
  add column if not exists last_sent_at timestamptz;

-- Drop old void version before recreating with boolean return type
drop function if exists public.increment_invitation_resend(uuid);

-- increment_invitation_resend: atomic increment with 30s cooldown guard (I4 fix)
-- Returns true if the row was updated (cooldown not active), false if skipped.
create or replace function public.increment_invitation_resend(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_updated int;
begin
  update public.invitations
     set resend_count = resend_count + 1,
         resent_at = now(),
         last_sent_at = now()
   where id = p_id
     and (last_sent_at is null or last_sent_at < now() - interval '30 seconds');
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
revoke all on function public.increment_invitation_resend(uuid) from public, anon, authenticated;
grant execute on function public.increment_invitation_resend(uuid) to service_role;
