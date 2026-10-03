-- =============================================================================
-- MIGRATION:
-- =============================================================================

-- Observatório v2 — versões de título/thumbnail/descrição, registro diário de views por vídeo,
-- janela de cada troca. Histórico NÃO é podado (o ab-watchdog deixa de apagar competitor_changes).

create table if not exists competitor_video_versions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references competitor_videos(id) on delete cascade,
  field text not null check (field in ('title', 'thumb', 'desc')),
  value_text text,
  value_hash text not null,
  has_text boolean not null default true,
  thumb_etag text,
  thumb_dhash text,
  thumb_blob_url text,
  thumb_last_modified timestamptz,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  window_start timestamptz,
  precision text not null check (precision in ('min', '6h', '1d', 'first')),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_cvv_one_current
  on competitor_video_versions (video_id, field) where is_current;
create index if not exists idx_cvv_video_field_seen
  on competitor_video_versions (video_id, field, first_seen_at);

create table if not exists competitor_video_daily (
  video_id uuid not null references competitor_videos(id) on delete cascade,
  snap_date date not null,
  views bigint not null,
  likes bigint,
  comments bigint,
  taken_at timestamptz not null,
  primary key (video_id, snap_date)
);
create index if not exists idx_cvd_date on competitor_video_daily (snap_date);

alter table competitor_changes
  add column if not exists from_version_id uuid references competitor_video_versions(id) on delete set null,
  add column if not exists to_version_id uuid references competitor_video_versions(id) on delete set null,
  add column if not exists window_start timestamptz,
  add column if not exists window_end timestamptz,
  add column if not exists precision text;
alter table competitor_changes drop constraint if exists competitor_changes_precision_check;
alter table competitor_changes add constraint competitor_changes_precision_check
  check (precision is null or precision in ('min', '6h', '1d'));

alter table competitor_video_versions enable row level security;
drop policy if exists "competitor_video_versions_select" on competitor_video_versions;
create policy "competitor_video_versions_select" on competitor_video_versions for select
  using (exists (select 1 from competitor_videos v join competitor_channels c on c.id = v.competitor_channel_id
                 where v.id = competitor_video_versions.video_id and public.can_view_site(c.site_id)));

alter table competitor_video_daily enable row level security;
drop policy if exists "competitor_video_daily_select" on competitor_video_daily;
create policy "competitor_video_daily_select" on competitor_video_daily for select
  using (exists (select 1 from competitor_videos v join competitor_channels c on c.id = v.competitor_channel_id
                 where v.id = competitor_video_daily.video_id and public.can_view_site(c.site_id)));
