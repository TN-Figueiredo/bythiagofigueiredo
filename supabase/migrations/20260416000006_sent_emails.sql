create type public.email_provider as enum ('brevo');

create table public.sent_emails (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  template_name text not null,
  to_email citext not null,
  subject text not null,
  provider public.email_provider not null,
  provider_message_id text,
  status text not null check (status in ('queued','sent','bounced','complained','failed')),
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  error text,
  metadata jsonb
);

create index on public.sent_emails (to_email, sent_at desc);
create index on public.sent_emails (site_id, template_name, sent_at desc);
create index on public.sent_emails (provider_message_id) where provider_message_id is not null;

alter table public.sent_emails enable row level security;

drop policy if exists "sent_emails staff read" on public.sent_emails;
create policy "sent_emails staff read"
  on public.sent_emails for select to authenticated
  using (public.can_admin_site(site_id) or public.is_staff());

-- Insert/update only via service role (cron + server actions). No anon/authenticated write policy = denied.

comment on table public.sent_emails is
  'Audit log of transactional emails sent. Retention: 90 days (purge via cron in Sprint 4).';
