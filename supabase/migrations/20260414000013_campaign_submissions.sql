create table campaign_submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete restrict,
  email citext not null,
  name text,
  locale text not null,
  interest text,

  consent_marketing boolean not null,
  consent_text_version text not null,
  ip inet,
  user_agent text,

  brevo_contact_id text,
  brevo_sync_status text not null default 'pending',
  brevo_sync_error text,
  brevo_synced_at timestamptz,

  downloaded_at timestamptz,
  download_count int not null default 0,

  anonymized_at timestamptz,

  submitted_at timestamptz not null default now(),

  constraint campaign_submissions_sync_status_check
    check (brevo_sync_status in ('pending','synced','failed'))
);

create unique index campaign_submissions_email_unique
  on campaign_submissions (campaign_id, email)
  where anonymized_at is null;

create index on campaign_submissions (brevo_sync_status)
  where brevo_sync_status = 'pending';
