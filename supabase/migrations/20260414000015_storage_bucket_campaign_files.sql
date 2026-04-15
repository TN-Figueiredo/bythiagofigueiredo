-- Provision the private `campaign-files` storage bucket used for campaign PDF
-- assets. Public consumption happens exclusively via server-generated signed
-- URLs; direct anon access is denied by omission (no anon policy).
insert into storage.buckets (id, name, public)
values ('campaign-files', 'campaign-files', false)
on conflict (id) do nothing;

-- Staff (via service role or authenticated staff role) may read/write objects.
-- is_staff() lives in public schema (see 20260414000004_rls_helpers.sql).
create policy "campaign-files staff all"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'campaign-files' and public.is_staff())
  with check (bucket_id = 'campaign-files' and public.is_staff());

-- No anon policy created → anon inserts/selects denied by default.
