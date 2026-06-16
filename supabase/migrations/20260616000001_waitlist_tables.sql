-- =============================================================================
-- MIGRATION: waitlist_tables — standalone waitlists feature (Fase 1).
-- =============================================================================
create table if not exists public.waitlists (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references public.sites(id) on delete restrict,
  slug         text not null,
  name         text not null,
  description  text,
  status       text not null default 'draft',
  campaign_id  uuid references public.campaigns(id) on delete set null,
  sender_name  text,
  sender_email text,
  reply_to     text,
  intro_mdx    text,
  launched_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint waitlists_status_check check (status in ('draft','open','closed','launching','launched','failed')),
  constraint waitlists_slug_site_key unique (site_id, slug),
  constraint waitlists_id_site_key   unique (id, site_id)
);

create table if not exists public.waitlist_signups (
  id                          uuid primary key default gen_random_uuid(),
  waitlist_id                 uuid not null,
  site_id                     uuid not null,
  email                       public.citext not null,
  locale                      text,
  consent_launch_notification boolean not null,
  consent_text_version        text not null,
  consent_grant_at            timestamptz not null default now(),
  suppression_reason          text,
  status                      text not null default 'pending',
  suppressed_at               timestamptz,
  source_surface              text,
  ip                          inet,
  user_agent                  text,
  anonymized_at               timestamptz,
  created_at                  timestamptz not null default now(),
  constraint waitlist_signups_status_check check (status in ('pending','suppressed')),
  constraint waitlist_signups_consent_required check (consent_launch_notification = true),
  constraint waitlist_signups_email_len check (length(email::text) between 5 and 320),
  constraint waitlist_signups_suppress_coherent check ((status = 'suppressed') = (suppressed_at is not null)),
  constraint waitlist_signups_suppress_reason_coherent check ((status = 'suppressed') = (suppression_reason is not null)),
  constraint waitlist_signups_suppress_reason_enum check (suppression_reason is null or suppression_reason in ('unsubscribe','bounce','complaint')),
  constraint waitlist_signups_source_surface_enum check (source_surface is null or source_surface in ('landing','embed','tiptap')),
  constraint waitlist_signups_parent_fk foreign key (waitlist_id, site_id) references public.waitlists (id, site_id) on delete cascade
);

create unique index if not exists waitlist_signups_email_unique
  on public.waitlist_signups (waitlist_id, email) where anonymized_at is null;
create index if not exists waitlist_signups_list
  on public.waitlist_signups (waitlist_id, created_at desc, id) where anonymized_at is null;
create index if not exists waitlist_signups_by_waitlist_status
  on public.waitlist_signups (waitlist_id, status, created_at desc, id) where anonymized_at is null;
create index if not exists waitlist_signups_sweep
  on public.waitlist_signups (site_id, status, created_at) where anonymized_at is null;
create index if not exists waitlists_site_status on public.waitlists (site_id, status);

create table if not exists public.waitlist_translations (
  id                   uuid primary key default gen_random_uuid(),
  waitlist_id          uuid not null references public.waitlists(id) on delete cascade,
  locale               text not null,
  headline             text,
  subheadline          text,
  consent_label        text not null default '',
  button_label         text,
  button_loading_label text,
  success_headline     text,
  success_body         text,
  duplicate_headline   text,
  duplicate_body       text,
  closed_message       text,
  launched_message     text,
  constraint waitlist_translations_waitlist_id_locale_key unique (waitlist_id, locale)
);

drop trigger if exists trg_waitlists_set_updated_at on public.waitlists;
create trigger trg_waitlists_set_updated_at
  before update on public.waitlists
  for each row execute function public.tg_set_updated_at();
