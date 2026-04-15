-- Rate limit: max 20 invitations per hour per (invited_by). Defense against
-- compromised admin credentials spamming invites.

create or replace function public.invitations_rate_limit() returns trigger language plpgsql as $fn$
declare v_count int;
begin
  select count(*) into v_count from public.invitations
   where invited_by = new.invited_by
     and created_at > now() - interval '1 hour';
  if v_count >= 20 then
    raise exception 'rate_limit_exceeded: max 20 invitations per hour per admin'
      using errcode = 'check_violation';
  end if;
  return new;
end $fn$;

drop trigger if exists tg_invitations_rate_limit on public.invitations;
create trigger tg_invitations_rate_limit
  before insert on public.invitations
  for each row execute function public.invitations_rate_limit();
