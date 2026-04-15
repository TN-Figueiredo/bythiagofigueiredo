-- Private bucket for blog assets (images in MDX, cover images, etc).
-- Coexists with campaign-files (Sprint 1b). Public consumption via signed URLs.

insert into storage.buckets (id, name, public)
values ('content-files', 'content-files', false)
on conflict (id) do nothing;

-- Staff-only write access (global is_staff; ring-scoped check via can_admin_site
-- happens at application layer when generating signed URLs).
drop policy if exists "content-files staff all" on storage.objects;
create policy "content-files staff all"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'content-files' and public.is_staff())
  with check (bucket_id = 'content-files' and public.is_staff());
