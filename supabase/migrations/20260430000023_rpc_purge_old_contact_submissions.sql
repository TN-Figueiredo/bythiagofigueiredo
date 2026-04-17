-- Sprint 5a P1-9: enforce 2-year retention for contact_submissions via periodic
-- anonymization (not hard delete). Policy (Section 6, privacy.pt-BR.mdx) says
-- "até 2 anos" + "anonimização sob solicitação" — we reconcile both by
-- calling the existing anonymize_contact_submission RPC per row, which
-- preserves site_id + submitted_at for aggregate analytics but zeroes
-- name/email/ip/user_agent/message and stamps anonymized_at.
--
-- SECURITY DEFINER + explicit search_path hardening (standard pattern in this
-- repo). EXECUTE granted only to service_role — the cron route supplies the
-- service-role bearer via withCronLock + getSupabaseServiceClient.

create or replace function public.purge_old_contact_submissions(
  p_older_than_days int default 730
) returns int
  language plpgsql
  security definer
  set search_path = public
as $fn$
declare
  v_count int := 0;
  v_id uuid;
begin
  for v_id in
    select id
    from public.contact_submissions
    where submitted_at < now() - (p_older_than_days || ' days')::interval
      and anonymized_at is null
  loop
    perform public.anonymize_contact_submission(v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$fn$;

do $grants$
begin
  execute $stmt$revoke execute on function public.purge_old_contact_submissions(int) from public$stmt$;
  execute $stmt$grant execute on function public.purge_old_contact_submissions(int) to service_role$stmt$;
end
$grants$;
