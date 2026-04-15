-- Epic 10 / T75 — LGPD retention: purge sent_emails older than N days (default 90).
--
-- Called by the /api/cron/purge-sent-emails route (service_role only). Returns
-- the count of deleted rows so the cron handler can emit structured telemetry.

create or replace function public.purge_sent_emails(p_older_than_days int default 90) returns int language plpgsql security definer set search_path = public as $fn$
declare v_days int; v_deleted int;
begin
  v_days := greatest(coalesce(p_older_than_days, 90), 1);

  with del as (
    delete from public.sent_emails
    where sent_at < now() - (v_days || ' days')::interval
    returning id
  )
  select count(*) into v_deleted from del;

  return v_deleted;
end $fn$;

revoke execute on function public.purge_sent_emails(int) from public;
grant execute on function public.purge_sent_emails(int) to service_role;
