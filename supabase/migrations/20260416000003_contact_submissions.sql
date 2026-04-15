create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  name text not null check (length(name) between 2 and 200),
  email citext not null check (length(email) between 5 and 320),
  message text not null check (length(message) between 10 and 5000),

  consent_processing boolean not null,
  consent_processing_text_version text not null,
  consent_marketing boolean not null default false,
  consent_marketing_text_version text,

  ip inet,
  user_agent text,
  submitted_at timestamptz not null default now(),
  replied_at timestamptz,

  check (consent_marketing = false or consent_marketing_text_version is not null)
);

create index on public.contact_submissions (site_id, submitted_at desc);
create index on public.contact_submissions (email);

alter table public.contact_submissions enable row level security;

drop policy if exists "contact_submissions anon insert" on public.contact_submissions;
create policy "contact_submissions anon insert"
  on public.contact_submissions for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.sites s
      where s.id = site_id
        and (
          coalesce(nullif(current_setting('app.site_id', true), ''), '') = ''
          or s.id = nullif(current_setting('app.site_id', true), '')::uuid
        )
    )
  );

drop policy if exists "contact_submissions staff read" on public.contact_submissions;
create policy "contact_submissions staff read"
  on public.contact_submissions for select to authenticated
  using (public.can_admin_site(site_id) or public.is_staff());

drop policy if exists "contact_submissions staff update" on public.contact_submissions;
create policy "contact_submissions staff update"
  on public.contact_submissions for update to authenticated
  using (public.can_admin_site(site_id) or public.is_staff())
  with check (public.can_admin_site(site_id) or public.is_staff());
